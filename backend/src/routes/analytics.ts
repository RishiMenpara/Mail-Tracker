import { Router, Request, Response, NextFunction } from 'express';
import pool from '../database/db';
import { parseUserAgent } from '../services/tracking';

const router = Router();

// ── POST /api/emails ──────────────────────────────────────────────────────
// Register a new tracked email (called by Chrome extension on send)
router.post('/emails', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sender_email, subject, viewer_id, recipient_email } = req.body as {
      sender_email: string;
      subject: string;
      viewer_id: string;
      recipient_email: string;
    };

    if (!sender_email || !viewer_id || !recipient_email) {
      res.status(400).json({ error: 'sender_email, viewer_id, and recipient_email are required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert viewer
      await client.query(
        `INSERT INTO viewers (id, recipient_email)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [viewer_id, recipient_email],
      );

      // Create email record
      const emailResult = await client.query(
        `INSERT INTO emails (sender_email, subject)
         VALUES ($1, $2)
         RETURNING id, sender_email, subject, sent_at`,
        [sender_email, subject || '(no subject)'],
      );

      await client.query('COMMIT');
      res.status(201).json(emailResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ── GET /api/emails ───────────────────────────────────────────────────────
// List emails by sender, with aggregate open counts
router.get('/emails', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sender } = req.query as { sender?: string };
    if (!sender) {
      res.status(400).json({ error: 'sender query parameter is required' });
      return;
    }

    const result = await pool.query(
      `SELECT
         e.id,
         e.sender_email,
         e.subject,
         e.sent_at,
         COUNT(DISTINCT oa.viewer_id)                  AS total_recipients_opened,
         COALESCE(SUM(oa.total_opens), 0)::int         AS total_opens,
         MIN(oa.first_opened_at)                       AS first_opened_at
       FROM emails e
       LEFT JOIN open_aggregates oa ON oa.email_id = e.id
       WHERE e.sender_email = $1
       GROUP BY e.id
       ORDER BY e.sent_at DESC
       LIMIT 100`,
      [sender],
    );

    // Also fetch total viewers per email (everyone it was sent to)
    const emailIds = result.rows.map((r) => r.id);
    let viewerCounts: Record<string, number> = {};
    if (emailIds.length > 0) {
      const vcResult = await pool.query(
        `SELECT email_id, COUNT(DISTINCT viewer_id)::int AS cnt
         FROM open_aggregates
         WHERE email_id = ANY($1)
         GROUP BY email_id`,
        [emailIds],
      );
      vcResult.rows.forEach((r) => {
        viewerCounts[r.email_id] = r.cnt;
      });
    }

    const emails = result.rows.map((r) => ({
      ...r,
      recipient_open_count: viewerCounts[r.id] || 0,
    }));

    res.json({ emails, count: emails.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/emails/:id ───────────────────────────────────────────────────
// Single email with per-viewer aggregates
router.get('/emails/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const emailResult = await pool.query(
      `SELECT id, sender_email, subject, sent_at FROM emails WHERE id = $1`,
      [id],
    );
    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];

    const aggregates = await pool.query(
      `SELECT
         v.recipient_email,
         oa.viewer_id,
         oa.first_opened_at,
         oa.last_opened_at,
         oa.total_opens
       FROM open_aggregates oa
       JOIN viewers v ON v.id = oa.viewer_id
       WHERE oa.email_id = $1
       ORDER BY oa.first_opened_at ASC`,
      [id],
    );

    const summary = {
      total_opens: aggregates.rows.reduce((sum, r) => sum + Number(r.total_opens), 0),
      total_viewers_opened: aggregates.rows.length,
      first_opened_at: aggregates.rows[0]?.first_opened_at || null,
      last_opened_at:
        aggregates.rows.length > 0
          ? new Date(Math.max(...aggregates.rows.map((r) => new Date(r.last_opened_at).getTime())))
          : null,
    };

    res.json({ email, aggregates: aggregates.rows, summary });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/emails/:id/opens ─────────────────────────────────────────────
// Raw open event log for an email
router.get('/emails/:id/opens', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT
         oe.id,
         oe.opened_at,
         oe.ip_address,
         oe.user_agent,
         oe.is_proxy,
         v.recipient_email
       FROM open_events oe
       JOIN viewers v ON v.id = oe.viewer_id
       WHERE oe.email_id = $1
       ORDER BY oe.opened_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    );

    const events = result.rows.map((row) => ({
      ...row,
      ...parseUserAgent(row.user_agent || ''),
    }));

    res.json({ events, count: events.length, limit, offset });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/health ───────────────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

export default router;
