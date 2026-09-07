import 'dotenv/config';
import path from 'path';
import app from './app';
import db from './db';
import { bullmqRedis, redis } from './lib/redis';
import { emailQueue } from './lib/queue';
import { ensureEmailIndex } from './lib/elasticsearch';
import { logger } from './lib/logger';
import type { EmailJobData } from './lib/queue';

const PORT = parseInt(process.env.PORT || '4000');

async function reconcileScheduledJobs(): Promise<void> {
  const scheduledJobs = await db('email_jobs')
    .where({ status: 'scheduled' })
    .select(
      'id',
      'idempotency_key',
      'sender_email',
      'recipient_email',
      'subject',
      'body',
      'user_id',
      'scheduled_at',
      'batch_id',
      'bullmq_job_id',
      'sender_id'
    );

  for (const row of scheduledJobs) {
    const existing = row.bullmq_job_id ? await emailQueue.getJob(row.bullmq_job_id) : null;
    if (existing) continue;

    const [sender, batch] = await Promise.all([
      db('email_senders').where({ id: row.sender_id }).first(),
      row.batch_id
        ? db('email_batches').where('id', row.batch_id).select('hourly_limit').first()
        : Promise.resolve(undefined),
    ]);
    if (!sender) {
      logger.error('Cannot reconcile scheduled email without sender', { jobId: row.id });
      continue;
    }

    const data: EmailJobData = {
      jobDbId: row.id,
      idempotencyKey: row.idempotency_key,
      senderEmail: row.sender_email,
      senderName: sender.name,
      recipientEmail: row.recipient_email,
      subject: row.subject,
      body: row.body,
      smtpHost: sender.smtp_host,
      smtpPort: sender.smtp_port,
      smtpUser: sender.smtp_user,
      smtpPass: sender.smtp_pass,
      userId: row.user_id,
      scheduledAt: new Date(row.scheduled_at).toISOString(),
      batchId: row.batch_id || undefined,
      hourlyLimit: batch?.hourly_limit ?? undefined,
    };

    const job = await emailQueue.add('send-email', data, {
      delay: Math.max(0, new Date(row.scheduled_at).getTime() - Date.now()),
      jobId: `email:${row.idempotency_key}`,
    });
    await db('email_jobs').where({ id: row.id }).update({ bullmq_job_id: job.id, updated_at: new Date() });
    logger.info('Reconciled scheduled email job', { jobId: row.id, bullmqJobId: job.id });
  }
}

async function bootstrap() {
  // ── Run DB migrations ──────────────────────────────────────────────────
  try {
    await db.migrate.latest({
      directory: path.join(__dirname, 'db', 'migrations'),
      extension: __dirname.includes(`${path.sep}dist`) ? 'js' : 'ts',
    });
    logger.info('Database migrations applied');
  } catch (err) {
    logger.error('Migration failed', { err });
    throw err;
  }

  // ── Ensure Elasticsearch index ─────────────────────────────────────────
  await ensureEmailIndex();

  // ── Verify Redis connection ────────────────────────────────────────────
  await redis.ping();
  await bullmqRedis.ping();
  logger.info('Redis connections healthy');

  // ── Log queue stats on startup ─────────────────────────────────────────
  const [delayed, waiting] = await Promise.all([
    emailQueue.getDelayedCount(),
    emailQueue.getWaitingCount(),
  ]);
  logger.info(`Queue state on startup: delayed=${delayed}, waiting=${waiting}`);
  await reconcileScheduledJobs();

  // ── Start Express ─────────────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    logger.info(`Server started on http://localhost:${PORT}`);
    logger.info(`BullBoard available at http://localhost:${PORT}/admin/queues`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await emailQueue.close();
      await redis.quit();
      await bullmqRedis.quit();
      await db.destroy();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
