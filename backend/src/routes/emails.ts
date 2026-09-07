import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { emailQueue } from '../lib/queue';
import { indexEmail, searchEmails } from '../lib/elasticsearch';
import db from '../db';
import { logger } from '../lib/logger';
import type { EmailJobData } from '../lib/queue';
import { parseRecipients } from '../lib/recipientParser';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Schedule Emails ────────────────────────────────────────────────────────
router.post(
  '/schedule',
  authMiddleware,
  upload.single('recipients'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const {
        subject,
        body,
        startTime,           // ISO datetime string
        delayBetweenEmailsMs = '2000',
        hourlyLimit,
        senderId,
      } = req.body as {
        subject: string;
        body: string;
        startTime: string;
        delayBetweenEmailsMs?: string;
        hourlyLimit?: string;
        senderId?: string;
      };

      if (!subject || !body || !startTime) {
        res.status(400).json({ error: 'subject, body, and startTime are required' });
        return;
      }

      // ── Parse recipients ──────────────────────────────────────────────
      let recipientEmails: string[] = [];

      if (req.file) {
        const content = req.file.buffer.toString('utf-8');
        recipientEmails = parseRecipients(content, req.file.originalname.toLowerCase().endsWith('.csv'));
      } else if (req.body.recipients) {
        const raw: string = req.body.recipients;
        recipientEmails = parseRecipients(raw, false);
      }

      if (recipientEmails.length === 0) {
        res.status(400).json({ error: 'No valid recipient emails found' });
        return;
      }
      if (recipientEmails.length > 10000) {
        res.status(400).json({ error: 'A single campaign cannot contain more than 10000 recipients' });
        return;
      }

      // ── Get sender ────────────────────────────────────────────────────
      let sender;
      if (senderId) {
        sender = await db('email_senders')
          .where({ id: senderId, user_id: userId })
          .first();
      } else {
        sender = await db('email_senders')
          .where({ user_id: userId, is_default: true })
          .first();
      }

      if (!sender) {
        res.status(400).json({ error: 'No email sender configured' });
        return;
      }

      const delayMs = parseInt(delayBetweenEmailsMs);
      const startTs = new Date(startTime);

      if (!Number.isInteger(delayMs) || delayMs < 500 || delayMs > 24 * 60 * 60 * 1000) {
        res.status(400).json({ error: 'delayBetweenEmailsMs must be between 500 and 86400000' });
        return;
      }
      if (Number.isNaN(startTs.getTime())) {
        res.status(400).json({ error: 'startTime must be a valid ISO datetime' });
        return;
      }
      if (startTs.getTime() < Date.now() - 60_000) {
        res.status(400).json({ error: 'startTime must not be in the past' });
        return;
      }
      const parsedHourlyLimit = hourlyLimit ? parseInt(hourlyLimit) : undefined;
      if (parsedHourlyLimit !== undefined && (!Number.isInteger(parsedHourlyLimit) || parsedHourlyLimit < 1)) {
        res.status(400).json({ error: 'hourlyLimit must be a positive integer' });
        return;
      }

      const { batch, jobRecords } = await db.transaction(async (trx) => {
        const [createdBatch] = await trx('email_batches')
          .insert({
            user_id: userId,
            subject,
            body,
            total_recipients: recipientEmails.length,
            start_time: startTs,
            delay_between_emails_ms: delayMs,
            hourly_limit: parsedHourlyLimit ?? null,
          })
          .returning('*');

        const records: Array<{
          jobDbId: string;
          idempotencyKey: string;
          recipientEmail: string;
          scheduledAt: Date;
        }> = [];

        for (let i = 0; i < recipientEmails.length; i++) {
          const recipientEmail = recipientEmails[i];
          const jobDbId = uuidv4();
          const idempotencyKey = uuidv4();
          const scheduledAt = new Date(startTs.getTime() + i * delayMs);

          await trx('email_jobs').insert({
            id: jobDbId,
            user_id: userId,
            sender_id: sender.id,
            sender_email: sender.email,
            recipient_email: recipientEmail,
            subject,
            body,
            status: 'scheduled',
            scheduled_at: scheduledAt,
            idempotency_key: idempotencyKey,
            batch_id: createdBatch.id,
          });
          records.push({ jobDbId, idempotencyKey, recipientEmail, scheduledAt });
        }

        return { batch: createdBatch, jobRecords: records };
      });

      // Queue and index only after the database transaction commits.
      const jobs: { dbId: string; email: string; scheduledAt: Date }[] = [];
      for (const record of jobRecords) {
        const { jobDbId, idempotencyKey, recipientEmail, scheduledAt } = record;

        await indexEmail({
          id: jobDbId,
          userId,
          senderEmail: sender.email,
          recipientEmail,
          subject,
          body,
          status: 'scheduled',
          scheduledAt: scheduledAt.toISOString(),
          batchId: batch.id,
          createdAt: new Date().toISOString(),
        });

        const delay = scheduledAt.getTime() - Date.now();
        const jobData: EmailJobData = {
          jobDbId,
          idempotencyKey,
          senderEmail: sender.email,
          senderName: sender.name,
          recipientEmail,
          subject,
          body,
          smtpHost: sender.smtp_host,
          smtpPort: sender.smtp_port,
          smtpUser: sender.smtp_user,
          smtpPass: sender.smtp_pass,
          userId,
          scheduledAt: scheduledAt.toISOString(),
          batchId: batch.id,
          hourlyLimit: parsedHourlyLimit,
        };

        // Enqueue with delay — BullMQ persists this to Redis
        // If delay < 0 (overdue), send immediately
        const bullJob = await emailQueue.add('send-email', jobData, {
          delay: Math.max(0, delay),
          jobId: `email:${idempotencyKey}`, // deterministic jobId for idempotency
        });

        // Store BullMQ job ID in DB
        await db('email_jobs')
          .where({ id: jobDbId })
          .update({ bullmq_job_id: bullJob.id });

        jobs.push({ dbId: jobDbId, email: recipientEmail, scheduledAt });
      }

      // Update batch scheduled count
      await db('email_batches')
        .where({ id: batch.id })
        .update({ scheduled_count: recipientEmails.length });

      logger.info(`Scheduled ${recipientEmails.length} emails`, {
        batchId: batch.id,
        userId,
      });

      res.status(201).json({
        batchId: batch.id,
        totalScheduled: recipientEmails.length,
        startTime: startTs.toISOString(),
        jobs: jobs.slice(0, 10), // preview first 10
      });
    } catch (err) {
      logger.error('Error scheduling emails', { err });
      res.status(500).json({ error: 'Failed to schedule emails' });
    }
  }
);

// ─── List Scheduled Emails ──────────────────────────────────────────────────
router.get('/scheduled', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [jobs, [{ count }]] = await Promise.all([
      db('email_jobs')
        .where({ user_id: userId })
        .whereIn('status', ['scheduled', 'retrying'])
        .orderBy('scheduled_at', 'asc')
        .limit(limit)
        .offset(offset)
        .select(
          'id',
          'recipient_email',
          'subject',
          'scheduled_at',
          'status',
          'sender_email',
          'batch_id',
          'created_at'
        ),
      db('email_jobs')
        .where({ user_id: userId })
        .whereIn('status', ['scheduled', 'retrying'])
        .count('id as count'),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total: parseInt(count as string),
        totalPages: Math.ceil(parseInt(count as string) / limit),
      },
    });
  } catch (err) {
    logger.error('Error fetching scheduled emails', { err });
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// ─── List Sent Emails ───────────────────────────────────────────────────────
router.get('/sent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [jobs, [{ count }]] = await Promise.all([
      db('email_jobs')
        .where({ user_id: userId })
        .whereIn('status', ['sent', 'failed'])
        .orderBy('sent_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select(
          'id',
          'recipient_email',
          'subject',
          'sent_at',
          'status',
          'sender_email',
          'error_message',
          'batch_id',
          'created_at'
        ),
      db('email_jobs')
        .where({ user_id: userId })
        .whereIn('status', ['sent', 'failed'])
        .count('id as count'),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total: parseInt(count as string),
        totalPages: Math.ceil(parseInt(count as string) / limit),
      },
    });
  } catch (err) {
    logger.error('Error fetching sent emails', { err });
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// ─── Search Emails (Elasticsearch) ─────────────────────────────────────────
router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const query = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.limit as string) || 20;
    const from = (page - 1) * size;

    const result = await searchEmails(userId, query, status, from, size);

    if (!result.available) {
      const filtered = db('email_jobs').where({ user_id: userId });
      if (status) filtered.where({ status });
      if (query) {
        filtered.where((builder) => {
          builder
            .whereILike('subject', `%${query}%`)
            .orWhereILike('body', `%${query}%`)
            .orWhereILike('sender_email', `%${query}%`)
            .orWhereILike('recipient_email', `%${query}%`);
        });
      }

      const [jobs, [{ count }]] = await Promise.all([
        filtered.clone().orderBy('scheduled_at', 'desc').limit(size).offset(from).select(
          'id', 'recipient_email', 'subject', 'scheduled_at', 'sent_at', 'status',
          'sender_email', 'batch_id', 'created_at', 'error_message'
        ),
        filtered.clone().count('id as count'),
      ]);
      res.json({
        emails: jobs,
        pagination: {
          page,
          size,
          total: parseInt(count as string),
          totalPages: Math.ceil(parseInt(count as string) / size),
        },
        source: 'database-fallback',
      });
      return;
    }

    // Map ES documents to the same shape as the DB queries (snake_case)
    const emails = result.hits.map((doc) => ({
      id: doc.id,
      recipient_email: doc.recipientEmail,
      subject: doc.subject,
      scheduled_at: doc.scheduledAt,
      sent_at: doc.sentAt ?? null,
      status: doc.status,
      sender_email: doc.senderEmail,
      batch_id: doc.batchId ?? null,
      error_message: null,
      created_at: doc.createdAt,
    }));

    res.json({
      emails,
      pagination: {
        page,
        size,
        total: result.total,
        totalPages: Math.ceil(result.total / size),
      },
    });
  } catch (err) {
    logger.error('Email search error', { err });
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Cancel a scheduled email ───────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const job = await db('email_jobs')
      .where({ id, user_id: userId, status: 'scheduled' })
      .first();

    if (!job) {
      res.status(404).json({ error: 'Scheduled email not found' });
      return;
    }

    // Remove from BullMQ
    if (job.bullmq_job_id) {
      const bullJob = await emailQueue.getJob(job.bullmq_job_id);
      if (bullJob) await bullJob.remove();
    }

    await db('email_jobs').where({ id }).update({
      status: 'cancelled',
      updated_at: new Date(),
    });

    res.json({ message: 'Email cancelled' });
  } catch (err) {
    logger.error('Error cancelling email', { err });
    res.status(500).json({ error: 'Failed to cancel email' });
  }
});

// ─── Get Stats ──────────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rows = await db('email_jobs')
      .where({ user_id: userId })
      .groupBy('status')
      .select('status')
      .count('id as count');

    const stats: Record<string, number> = {
      scheduled: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
    };

    rows.forEach((r) => {
      stats[r.status as string] = parseInt(r.count as string);
    });

    // Queue stats
    const [waiting, delayed, active, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    res.json({
      db: stats,
      queue: { waiting, delayed, active, completed, failed },
    });
  } catch (err) {
    logger.error('Error fetching stats', { err });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Get Senders ────────────────────────────────────────────────────────────
router.get('/senders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const senders = await db('email_senders')
      .where({ user_id: req.user!.userId })
      .select('id', 'name', 'email', 'is_default', 'created_at');
    res.json({ senders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

// ─── Add Sender ─────────────────────────────────────────────────────────────
router.post('/senders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, email, smtpHost, smtpPort, smtpUser, smtpPass, isDefault } = req.body;
    if (!name || !email || !smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      res.status(400).json({ error: 'All sender fields are required' });
      return;
    }

    if (isDefault) {
      await db('email_senders')
        .where({ user_id: req.user!.userId })
        .update({ is_default: false });
    }

    const [sender] = await db('email_senders')
      .insert({
        user_id: req.user!.userId,
        name,
        email,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        is_default: isDefault || false,
      })
      .returning(['id', 'name', 'email', 'is_default', 'created_at']);

    res.status(201).json({ sender });
  } catch (err) {
    logger.error('Error adding sender', { err });
    res.status(500).json({ error: 'Failed to add sender' });
  }
});

// ─── Create Ethereal Sender ─────────────────────────────────────────────────
router.post('/senders/ethereal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { createEtherealAccount } = await import('../lib/mailer');
    const { name } = req.body;
    const account = await createEtherealAccount();

    const [sender] = await db('email_senders')
      .insert({
        user_id: req.user!.userId,
        name: name || 'Ethereal Sender',
        email: account.user,
        smtp_host: account.host,
        smtp_port: account.port,
        smtp_user: account.user,
        smtp_pass: account.pass,
        is_default: false,
      })
      .returning(['id', 'name', 'email', 'smtp_host', 'smtp_port', 'is_default', 'created_at']);

    res.status(201).json({ sender, webUrl: account.web });
  } catch (err) {
    logger.error('Error creating Ethereal sender', { err });
    res.status(500).json({ error: 'Failed to create Ethereal sender' });
  }
});

export default router;
