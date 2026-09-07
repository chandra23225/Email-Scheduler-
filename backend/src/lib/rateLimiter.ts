import { redis } from './redis';
import { logger } from './logger';

const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const MAX_EMAILS_PER_HOUR_PER_SENDER = parseInt(
  process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50'
);

/**
 * Returns the Redis key for the current hour window.
 * Key format: rate_limit:<sender_email>:<YYYYMMDDTHH>
 */
function getHourWindowKey(senderEmail: string): string {
  const now = new Date();
  const window = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate()
  ).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`;
  return `rate_limit:${senderEmail}:${window}`;
}

/**
 * Returns milliseconds until the start of the next hour (UTC).
 */
function msUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

/**
 * Checks if the given sender has capacity in the current hour window.
 * Uses a Redis INCR + EXPIRE atomic-ish approach.
 *
 * @returns { allowed: boolean, currentCount: number, limit: number, msUntilReset: number }
 */
export async function checkAndIncrementRateLimit(
  senderEmail: string,
  limitOverride?: number
): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  msUntilReset: number;
}> {
  const key = getHourWindowKey(senderEmail);
  const limit = limitOverride ?? MAX_EMAILS_PER_HOUR_PER_SENDER;

  // Use a Lua script for atomicity: only increment if below limit
  const luaScript = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])
    local current = redis.call('GET', key)
    if current == false then
      redis.call('SET', key, 1, 'PX', ttl)
      return {1, 1}
    end
    local count = tonumber(current)
    if count >= limit then
      return {0, count}
    end
    redis.call('INCR', key)
    return {1, count + 1}
  `;

  const ttlMs = msUntilNextHour();

  const result = (await redis.eval(luaScript, 1, key, limit, ttlMs)) as [
    number,
    number
  ];
  const allowed = result[0] === 1;
  const currentCount = result[1];

  if (!allowed) {
    logger.warn(`Rate limit hit for sender ${senderEmail}`, {
      currentCount,
      limit,
      msUntilReset: ttlMs,
    });
  }

  return { allowed, currentCount, limit, msUntilReset: ttlMs };
}

/**
 * Refund one reserved slot when the email was not sent.
 */
export async function releaseRateLimitReservation(senderEmail: string): Promise<void> {
  const key = getHourWindowKey(senderEmail);
  const luaScript = `
    local key = KEYS[1]
    local current = tonumber(redis.call('GET', key) or 0)
    if current <= 0 then
      return 0
    end
    return redis.call('DECR', key)
  `;

  await redis.eval(luaScript, 1, key);
}

/**
 * Peek at current count without incrementing.
 */
export async function getRateLimitCount(senderEmail: string): Promise<number> {
  const key = getHourWindowKey(senderEmail);
  const val = await redis.get(key);
  return val ? parseInt(val) : 0;
}

/**
 * Calculate the delay in ms before the job can be retried (next hour start).
 */
export function getDelayUntilNextHour(): number {
  return msUntilNextHour();
}

export { MAX_EMAILS_PER_HOUR, MAX_EMAILS_PER_HOUR_PER_SENDER };
