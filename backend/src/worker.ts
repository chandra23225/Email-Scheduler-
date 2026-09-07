/**
 * BullMQ Worker — runs as a separate process.
 * Processes email jobs with:
 *   - Configurable concurrency
 *   - Min delay between sends (rate throttle)
 *   - Per-sender hourly rate limiting (Redis backed)
 *   - Idempotency checks
 *   - Slack notifications on rate-limit hits
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { bullmqRedis, redis } from './lib/redis';
import { EmailJobData, EMAIL_QUEUE_NAME, emailQueue } from './lib/queue';
import { sendEmail } from './lib/mailer';
import {
  checkAndIncrementRateLimit,
  getDelayUntilNextHour,
  releaseRateLimitReservation,
} from './lib/rateLimiter';
import { updateEmailStatus } from './lib/elasticsearch';
import { sendSlackNotification, buildRateLimitMessage } from './lib/slack';
import db from './db';
import { logger } from './lib/logger';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_BETWEEN_SENDS_MS || '2000');

/** Redis key to track the timestamp of the last send (for min-delay enforcement). */
const LAST_SEND_KEY = 'email_worker:last_send_ts';

/**
 * Enforce minimum delay between individual email sends across all worker instances.
 * Uses Redis to share state between concurrent workers.
 */
async function enforceMinDelay(): Promise<void> {
  const luaScript = `
    local key = KEYS[1]
    local minDelay = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local last = tonumber(redis.call('GET', key) or 0)
    local diff = now - last
    if diff < minDelay then
      return minDelay - diff
    end
    redis.call('SET', key, now, 'EX', 3600)
    return 0
  `;

  const now = Date.now();
  const waitMs = (await redis.eval(luaScript, 1, LAST_SEND_KEY, MIN_DELAY_MS, now)) as number;

  if (waitMs > 0) {
    logger.debug(`Min-delay throttle: waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
    // After waiting, set the timestamp
    await redis.set(LAST_SEND_KEY, Date.now(), 'EX', 3600);
  }
}

/**
 * Notify the user via Slack if they have it connected.
 */
async function notifySlackIfConnected(
  userId: string,
  senderEmail: string,
  currentCount: number,
  limit: number,
  msUntilReset: number
): Promise<void> {
  try {
    const user = await db('users')
      .where({ id: userId })
      .select('slack_access_token', 'slack_channel_id', 'slack_webhook_url', 'slack_connected')
      .first();

    if (!user?.slack_connected || !user.slack_access_token) {
      logger.debug('Slack not connected for user, skipping notification');
      return;
    }

    const message = buildRateLimitMessage(senderEmail, currentCount, limit, msUntilReset);
    await sendSlackNotification(
      user.slack_access_token,
      user.slack_channel_id,
      message,
      user.slack_webhook_url || null
    );
  } catch (err) {
    logger.error('Error sending Slack notification', { err });
  }
}

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const {
      jobDbId,
      idempotencyKey,
      senderEmail,
      senderName,
      recipientEmail,
      subject,
      body,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      userId,
      hourlyLimit,
    } = job.data;

    logger.info(`Processing email job ${job.id}`, {
      jobDbId,
      recipientEmail,
      senderEmail,
    });

    // ─── 1. Idempotency check ──────────────────────────────────────────────
    // Use a short-lived Redis lock to prevent concurrent duplicate processing.
    // The database status is the durable idempotency guard, so retries after a
    // transient failure must be able to acquire the lock again.
    const idempotencyRedisKey = `idempotency:${idempotencyKey}`;
    const lockToken = `${process.pid}:${job.id}:${Date.now()}`;
    const acquired = await redis.set(idempotencyRedisKey, lockToken, 'PX', 15 * 60 * 1000, 'NX');
    if (!acquired) {
      logger.warn(`Duplicate job detected for idempotencyKey=${idempotencyKey}, skipping`);
      return { skipped: true };
    }

    // Also check DB status
    const existingJob = await db('email_jobs')
      .where({ id: jobDbId })
      .select('status')
      .first();

    if (existingJob?.status === 'sent' || existingJob?.status === 'cancelled') {
      logger.warn(`Job ${jobDbId} is already terminal (${existingJob.status}), skipping`);
      return { skipped: true };
    }

    // ─── 2. Rate limit check ───────────────────────────────────────────────
    const { allowed, currentCount, limit, msUntilReset } =
      await checkAndIncrementRateLimit(senderEmail, hourlyLimit);

    if (!allowed) {
      // Release the processing lock so the rescheduled job can re-acquire it.
      await releaseProcessingLock(idempotencyRedisKey, lockToken);

      const delayMs = getDelayUntilNextHour();
      logger.warn(`Rate limit hit for ${senderEmail}, rescheduling in ${delayMs}ms`);

      // Notify once per sender/hour window, even when many jobs hit the limit together.
      const window = new Date().toISOString().slice(0, 13).replace(/[-T]/g, '');
      const notificationKey = `rate_limit_notified:${senderEmail}:${window}`;
      const shouldNotify = await redis.set(notificationKey, '1', 'EX', 7200, 'NX');
      if (shouldNotify) {
        notifySlackIfConnected(userId, senderEmail, currentCount, limit, msUntilReset).catch(() => {});
      }

      // Re-enqueue with delay into next hour window
      const rescheduledJob = await emailQueue.add(
        'send-email',
        job.data,
        {
          delay: delayMs,
          jobId: `reschedule:${idempotencyKey}:${Date.now()}`,
        }
      );

      // Update DB to reflect rescheduling
      await db('email_jobs').where({ id: jobDbId }).update({
        status: 'scheduled',
        scheduled_at: new Date(Date.now() + delayMs),
        bullmq_job_id: rescheduledJob.id,
        updated_at: new Date(),
      });

      return { rescheduled: true, delayMs };
    }

    // ─── 3. Min delay throttle ─────────────────────────────────────────────
    let rateLimitReservationHeld = true;
    await enforceMinDelay();

    // ─── 4. Send the email ─────────────────────────────────────────────────
    try {
      const result = await sendEmail(
        {
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          senderEmail,
          senderName,
        },
        recipientEmail,
        subject,
        body
      );

      rateLimitReservationHeld = false;
      const sentAt = new Date();

      // ─── 5. Update DB ──────────────────────────────────────────────────
      await db('email_jobs').where({ id: jobDbId }).update({
        status: 'sent',
        sent_at: sentAt,
        updated_at: sentAt,
      });

      // ─── 6. Update Elasticsearch ───────────────────────────────────────
      await updateEmailStatus(jobDbId, 'sent', sentAt.toISOString());

      logger.info(`Email sent successfully`, {
        jobDbId,
        recipientEmail,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
      });

      return { sent: true, messageId: result.messageId, previewUrl: result.previewUrl };
    } catch (err) {
      logger.error(`Failed to send email`, { jobDbId, err });

      if (rateLimitReservationHeld) {
        await releaseRateLimitReservation(senderEmail);
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      await db('email_jobs').where({ id: jobDbId }).update({
        status: isFinalAttempt ? 'failed' : 'retrying',
        error_message: (err as Error).message,
        retry_count: db.raw('retry_count + 1'),
        updated_at: new Date(),
      });

      await updateEmailStatus(jobDbId, 'failed');
      throw err; // Let BullMQ handle retry
    } finally {
      await releaseProcessingLock(idempotencyRedisKey, lockToken);
    }
  },
  {
    connection: bullmqRedis,
    concurrency: WORKER_CONCURRENCY,
    // BullMQ limiter: max 1 job per MIN_DELAY_MS globally
    // (the in-worker Redis check handles cross-instance throttle)
    limiter: {
      max: 1,
      duration: MIN_DELAY_MS,
    },
  }
);

async function releaseProcessingLock(key: string, token: string): Promise<void> {
  const releaseScript = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    end
    return 0
  `;
  await redis.eval(releaseScript, 1, key, token);
}

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`, { result: job.returnvalue });
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, { err: err.message });
});

worker.on('error', (err) => {
  logger.error('Worker error', { err });
});

logger.info(`Email worker started`, {
  concurrency: WORKER_CONCURRENCY,
  minDelayMs: MIN_DELAY_MS,
  queue: EMAIL_QUEUE_NAME,
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Worker shutting down...');
  await worker.close();
  await emailQueue.close();
  await redis.quit();
  await bullmqRedis.quit();
  await db.destroy();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
