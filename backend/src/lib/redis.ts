import IORedis from 'ioredis';
import { logger } from './logger';

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

// Connection for BullMQ (must have maxRetriesPerRequest: null)
export const bullmqRedis = new IORedis(redisOptions);

// General purpose redis connection
export const redis = new IORedis({
  ...redisOptions,
  maxRetriesPerRequest: 3,
});

bullmqRedis.on('connect', () => logger.info('BullMQ Redis connected'));
bullmqRedis.on('error', (err) => logger.error('BullMQ Redis error', { err }));

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { err }));

export default redis;
