import { Router, Request, Response } from 'express';
import { recordOpenEvent } from '../services/tracking';

const router = Router();

// 1×1 transparent PNG (hardcoded bytes — no disk read, no caching risk)
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * GET /pixel/:emailId/:viewerId
 * Returns a 1×1 transparent PNG with strict no-cache headers.
 * Records the open event asynchronously (so pixel is returned immediately).
 */
router.get('/:emailId/:viewerId', (req: Request, res: Response) => {
  const { emailId, viewerId } = req.params;

  // ── CRITICAL: Strict no-cache headers ──
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', '*');
  // ────────────────────────────────────────

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', TRANSPARENT_PNG.length);
  res.status(200).send(TRANSPARENT_PNG);

  // Record asynchronously AFTER responding — pixel delivery is never blocked
  if (emailId && viewerId) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '0.0.0.0';
    const userAgent = req.headers['user-agent'] || '';

    recordOpenEvent(emailId, viewerId, ip, userAgent).catch((err) => {
      console.error('[Pixel] Background record failed:', err.message);
    });
  }
});

export default router;
