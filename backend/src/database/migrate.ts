import fs from 'fs';
import path from 'path';
import pool from './db';

export async function runMigration(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    // In production, schema.sql is bundled next to the compiled JS
    const altPath = path.join(__dirname, '../../src/database/schema.sql');
    if (!fs.existsSync(altPath)) {
      console.error('[Migration] schema.sql not found at:', schemaPath);
      throw new Error('schema.sql not found');
    }
    const sql = fs.readFileSync(altPath, 'utf8');
    await pool.query(sql);
  } else {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
  }

  console.log('[Migration] Database schema applied successfully');
}
