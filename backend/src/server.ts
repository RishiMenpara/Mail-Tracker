import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { runMigration } from './database/migrate';
import pixelRouter from './routes/pixel';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Trust proxy (Railway/Render/Fly.io behind load balancer) ──────────────
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rate limiters ─────────────────────────────────────────────────────────
// Pixel endpoint: 300 req/min per IP (all from Gmail proxy expected in bursts)
const pixelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
});

// API endpoints: 100 req/15min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'test',
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/pixel', pixelLimiter, pixelRouter);
app.use('/api', apiLimiter, analyticsRouter);

// ── Root ping ─────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'MailTrackr API', version: '1.0.0', status: 'running' });
});

// ── Global error handler ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    console.log('[Server] Running database migration…');
    await runMigration();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] MailTrackr API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err);
    process.exit(1);
  }
}

start();

export default app;
