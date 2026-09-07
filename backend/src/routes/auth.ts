import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import db from '../db';
import { logger } from '../lib/logger';

const router = Router();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your-super-secret-jwt-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

// ── Configure Google Strategy ───────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || '';
        const avatar = profile.photos?.[0]?.value || null;

        // Upsert user
        const existing = await db('users').where({ google_id: profile.id }).first();
        let user;

        if (existing) {
          await db('users')
            .where({ id: existing.id })
            .update({ name: profile.displayName, avatar, updated_at: new Date() });
          user = { ...existing, name: profile.displayName, avatar };

          const hasSender = await db('email_senders').where({ user_id: existing.id }).first();
          if (!hasSender) {
            await createDefaultSender(existing.id, profile.displayName, email);
          }
        } else {
          const [newUser] = await db('users')
            .insert({
              google_id: profile.id,
              email,
              name: profile.displayName,
              avatar,
            })
            .returning('*');
          user = newUser;

          // Create a default Ethereal sender for new users
          await createDefaultSender(user.id, profile.displayName, email);
        }

        return done(null, user);
      } catch (err) {
        logger.error('Google OAuth error', { err });
        return done(err as Error);
      }
    }
  )
);

async function createDefaultSender(userId: string, name: string, email: string) {
  try {
    const { createEtherealAccount } = await import('../lib/mailer');
    const account = await createEtherealAccount();

    await db('email_senders').insert({
      user_id: userId,
      name,
      email: account.user, // Use ethereal email as sender
      smtp_host: account.host,
      smtp_port: account.port,
      smtp_user: account.user,
      smtp_pass: account.pass,
      is_default: true,
    });

    logger.info(`Created default Ethereal sender for user ${userId}`);
  } catch (err) {
    logger.error('Failed to create default sender', { err });
  }
}

passport.serializeUser((user: Express.User, done) => done(null, user));
passport.deserializeUser((user: Express.User, done) => done(null, user));

// ── Routes ──────────────────────────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`,
  }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    let token: string;
    try {
      token = jwt.sign(
        { userId: user.id, email: user.email, name: user.name, avatar: user.avatar || null },
        getJwtSecret(),
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
      );
    } catch (err) {
      logger.error('JWT configuration error', { err });
      return res.redirect(`${frontendUrl}/login?error=server_config`);
    }

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.redirect(`${frontendUrl}/auth/callback`);
  }
);

router.get('/me', (req: Request, res: Response) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

export default router;
