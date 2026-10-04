import 'server-only';
import { Pool } from 'pg';

let pool;

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada en el servidor.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: true },
    });
  }

  return pool;
}
