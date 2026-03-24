import pool from './db';

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS emails (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_email  TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '(no subject)',
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at DESC);

CREATE TABLE IF NOT EXISTS viewers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viewers_email ON viewers(recipient_email);

CREATE TABLE IF NOT EXISTS open_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id    UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  viewer_id   UUID NOT NULL REFERENCES viewers(id) ON DELETE CASCADE,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT,
  is_proxy    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_open_events_email   ON open_events(email_id);
CREATE INDEX IF NOT EXISTS idx_open_events_viewer  ON open_events(viewer_id);
CREATE INDEX IF NOT EXISTS idx_open_events_opened  ON open_events(opened_at DESC);

CREATE TABLE IF NOT EXISTS open_aggregates (
  email_id         UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  viewer_id        UUID NOT NULL REFERENCES viewers(id) ON DELETE CASCADE,
  first_opened_at  TIMESTAMPTZ NOT NULL,
  last_opened_at   TIMESTAMPTZ NOT NULL,
  total_opens      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (email_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_open_agg_email  ON open_aggregates(email_id);
`;

export async function runMigration(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn('[Migration] Skipped (DATABASE_URL not set)');
    return;
  }
  
  await pool.query(SCHEMA_SQL);
  console.log('[Migration] Database schema applied successfully');
}

