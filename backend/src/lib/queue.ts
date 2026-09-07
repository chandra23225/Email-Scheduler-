import { Queue, QueueEvents } from 'bullmq';
import { bullmqRedis } from './redis';
import IORedis from 'ioredis';

export const EMAIL_QUEUE_NAME = 'email-jobs';

// Single queue instance used throughout the app
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: bullmqRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600 * 24 * 7, // keep completed jobs for 7 days
      count: 10000,
    },
    removeOnFail: {
      age: 3600 * 24 * 30, // keep failed jobs for 30 days
    },
  },
});

// Separate connection for QueueEvents (BullMQ requires its own connection)
const queueEventsRedis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: queueEventsRedis,
});

export interface EmailJobData {
  jobDbId: string;        // UUID in our DB
  idempotencyKey: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  userId: string;
  scheduledAt: string;   // ISO string
  batchId?: string;
  hourlyLimit?: number;  // per-batch override for rate limiting
}
