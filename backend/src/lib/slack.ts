import axios from 'axios';
import { logger } from './logger';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || 'http://localhost:4000/slack/callback';

/**
 * Build the Slack OAuth authorization URL.
 */
export function getSlackAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: 'chat:write,incoming-webhook',
    redirect_uri: SLACK_REDIRECT_URI,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange the code for an access token via Slack OAuth.
 */
export async function exchangeSlackCode(code: string): Promise<{
  accessToken: string;
  teamId: string;
  channelId: string;
  webhookUrl?: string;
}> {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      code,
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id || '',
    channelId:
      data.incoming_webhook?.channel_id ||
      data.authed_user?.id ||
      '',
    webhookUrl: data.incoming_webhook?.url,
  };
}

/**
 * Send a Slack notification. Uses incoming webhook URL if present,
 * otherwise falls back to chat.postMessage with a channel ID.
 */
export async function sendSlackNotification(
  accessToken: string,
  channelId: string,
  message: string,
  webhookUrl?: string | null
): Promise<void> {
  try {
    if (webhookUrl) {
      await axios.post(webhookUrl, { text: message });
    } else {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        { channel: channelId, text: message },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    logger.info('Slack notification sent');
  } catch (err) {
    logger.error('Failed to send Slack notification', { err });
  }
}

/**
 * Build a rate-limit hit message.
 */
export function buildRateLimitMessage(
  senderEmail: string,
  currentCount: number,
  limit: number,
  msUntilReset: number
): string {
  const minutesUntilReset = Math.ceil(msUntilReset / 60000);
  return (
    `⚠️ *Rate limit reached* for sender \`${senderEmail}\`\n` +
    `Sent *${currentCount}/${limit}* emails this hour.\n` +
    `Next window opens in *${minutesUntilReset} minutes*. ` +
    `Affected emails have been rescheduled to the next hour.`
  );
}
