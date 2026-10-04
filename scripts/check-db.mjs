import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Falta DATABASE_URL en .env.local. Consulta docs/SUPABASE.md.');
  process.exitCode = 1;
} else {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 8000,
    ssl: { rejectUnauthorized: true },
  });

  try {
    const result = await pool.query('SELECT 1 AS connected');
    if (result.rows[0]?.connected !== 1) {
      throw new Error('La consulta de prueba devolvió un resultado inesperado.');
    }
    console.log('Conexión de servidor a Supabase Postgres verificada.');
  } catch (error) {
    console.error(`No se pudo conectar a Supabase Postgres: ${error.code ?? error.name}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
