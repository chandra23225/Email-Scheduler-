import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import passport from 'passport';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './lib/queue';
import authRouter from './routes/auth';
import emailsRouter from './routes/emails';
import slackRouter from './routes/slack';
import { logger } from './lib/logger';
import { authMiddleware } from './middleware/auth';

const app = express();

// ── Security & utility middleware ─────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Relax for BullBoard
  })
);
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(passport.initialize());

// ── BullBoard queue dashboard ─────────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});
app.use('/admin/queues', authMiddleware, serverAdapter.getRouter());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/emails', emailsRouter);
app.use('/slack', slackRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'outbox',
  });
});

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { err });
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
