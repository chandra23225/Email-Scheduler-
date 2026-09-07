import nodemailer from 'nodemailer';
import { logger } from './logger';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  senderEmail: string;
  senderName: string;
}

/**
 * Create (or reuse) an Ethereal test account.
 * Returns SMTP credentials you can persist to the DB.
 */
export async function createEtherealAccount(): Promise<{
  user: string;
  pass: string;
  host: string;
  port: number;
  web: string;
}> {
  const configuredUser = process.env.ETHEREAL_USER;
  const configuredPass = process.env.ETHEREAL_PASS;
  if (configuredUser && configuredPass) {
    return {
      user: configuredUser,
      pass: configuredPass,
      host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.ETHEREAL_PORT || '587'),
      web: 'https://ethereal.email/messages',
    };
  }

  const testAccount = await nodemailer.createTestAccount();
  logger.info('Created Ethereal test account', { user: testAccount.user });
  return {
    user: testAccount.user,
    pass: testAccount.pass,
    host: 'smtp.ethereal.email',
    port: 587,
    web: `https://ethereal.email/messages`,
  };
}

/**
 * Send an email via any SMTP config (typically Ethereal).
 */
export async function sendEmail(
  smtp: SmtpConfig,
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl: string | false }> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: false,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    tls: { rejectUnauthorized: false },
  });

  const info = await transporter.sendMail({
    from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
    to,
    subject,
    html: body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  logger.info('Email sent', { messageId: info.messageId, previewUrl });

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
