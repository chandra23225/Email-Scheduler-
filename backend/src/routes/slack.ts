import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getSlackAuthUrl,
  exchangeSlackCode,
} from '../lib/slack';
import { redis } from '../lib/redis';
import db from '../db';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const router = Router();

// ── Initiate Slack OAuth ──────────────────────────────────────────────────
router.get('/connect', authMiddleware, async (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state → userId mapping in Redis (10 min TTL)
  await redis.set(`slack_oauth_state:${state}`, req.user!.userId, 'EX', 600);
  const url = getSlackAuthUrl(state);
  res.json({ url });
});

// ── OAuth Callback ────────────────────────────────────────────────────────
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    logger.warn('Slack OAuth denied', { error });
    return res.redirect(`${frontendUrl}/dashboard?slack=denied`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/dashboard?slack=error`);
  }

  const userId = await redis.get(`slack_oauth_state:${state}`);
  if (!userId) {
    return res.redirect(`${frontendUrl}/dashboard?slack=invalid_state`);
  }

  try {
    const { accessToken, teamId, channelId, webhookUrl } = await exchangeSlackCode(code);

    await db('users').where({ id: userId }).update({
      slack_access_token: accessToken,
      slack_team_id: teamId,
      slack_channel_id: channelId,
      slack_webhook_url: webhookUrl || null,
      slack_connected: true,
      updated_at: new Date(),
    });

    await redis.del(`slack_oauth_state:${state}`);
    logger.info(`Slack connected for user ${userId}`);

    return res.redirect(`${frontendUrl}/dashboard?slack=connected`);
  } catch (err) {
    logger.error('Slack callback error', { err });
    return res.redirect(`${frontendUrl}/dashboard?slack=error`);
  }
});

// ── Disconnect Slack ──────────────────────────────────────────────────────
router.post('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  await db('users').where({ id: req.user!.userId }).update({
    slack_access_token: null,
    slack_team_id: null,
    slack_channel_id: null,
    slack_webhook_url: null,
    slack_connected: false,
    updated_at: new Date(),
  });
  res.json({ message: 'Slack disconnected' });
});

// ── Status ────────────────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const user = await db('users')
    .where({ id: req.user!.userId })
    .select('slack_connected', 'slack_team_id')
    .first();
  res.json({ connected: user?.slack_connected || false, teamId: user?.slack_team_id });
});

export default router;
