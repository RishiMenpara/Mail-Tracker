import pool from '../database/db';
import UAParser from 'ua-parser-js';

// Known Gmail image proxy IP prefixes
const GMAIL_PROXY_PREFIXES = [
  '66.102.',
  '66.249.',
  '72.14.',
  '74.125.',
  '209.85.',
  '216.58.',
  '216.239.',
  '172.217.',
  '173.194.',
  '142.250.',
  '108.177.',
];

export function isGmailProxy(ip: string): boolean {
  return GMAIL_PROXY_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  return {
    browser: [result.browser.name, result.browser.version].filter(Boolean).join(' ') || 'Unknown',
    os: [result.os.name, result.os.version].filter(Boolean).join(' ') || 'Unknown',
    device: result.device.type || 'desktop',
  };
}

export async function recordOpenEvent(
  emailId: string,
  viewerId: string,
  ip: string,
  userAgent: string,
): Promise<void> {
  const isProxy = isGmailProxy(ip);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert raw open event
    await client.query(
      `INSERT INTO open_events (email_id, viewer_id, ip_address, user_agent, is_proxy)
       VALUES ($1, $2, $3, $4, $5)`,
      [emailId, viewerId, ip, userAgent, isProxy],
    );

    // 2. Upsert open_aggregates
    const existing = await client.query(
      `SELECT first_opened_at FROM open_aggregates WHERE email_id = $1 AND viewer_id = $2`,
      [emailId, viewerId],
    );

    if (existing.rows.length === 0) {
      // First open
      await client.query(
        `INSERT INTO open_aggregates (email_id, viewer_id, first_opened_at, last_opened_at, total_opens)
         VALUES ($1, $2, NOW(), NOW(), 1)`,
        [emailId, viewerId],
      );
    } else {
      // Subsequent open
      await client.query(
        `UPDATE open_aggregates
         SET last_opened_at = NOW(), total_opens = total_opens + 1
         WHERE email_id = $1 AND viewer_id = $2`,
        [emailId, viewerId],
      );
    }

    await client.query('COMMIT');
    console.log(`[Tracking] Open recorded: email=${emailId}, viewer=${viewerId}, proxy=${isProxy}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Tracking] Failed to record open event:', err);
    throw err;
  } finally {
    client.release();
  }
}
