import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  checkAndIncrementRateLimit,
  releaseRateLimitReservation,
} from './rateLimiter';
import { bullmqRedis, redis } from './redis';

const senderEmail = `rate-limit-test-${Date.now()}@example.com`;

test('refunds a rate-limit reservation so a retry can use the slot', async () => {
  const firstAttempt = await checkAndIncrementRateLimit(senderEmail, 1);
  assert.equal(firstAttempt.allowed, true);

  await releaseRateLimitReservation(senderEmail);

  const retryAttempt = await checkAndIncrementRateLimit(senderEmail, 1);
  assert.equal(retryAttempt.allowed, true);
  assert.equal(retryAttempt.currentCount, 1);
});

after(async () => {
  await redis.quit();
  await bullmqRedis.quit();
});