import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn('[DB] WARNING: DATABASE_URL not set. Database features will not work.');
}

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/mailtrackr';

// Add SSL for remote databases like Supabase
const needsSSL = connectionString.includes('supabase') || 
                 connectionString.includes('render.com') || 
                 process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {})
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export default pool;
