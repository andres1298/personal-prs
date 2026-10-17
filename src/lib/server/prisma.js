import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.ts';
import { databaseCertificateAuthorities, getDatabaseUrl } from './database-config.js';

export function getPrisma() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL is required for server persistence.');
  }

  if (!globalThis.personalPrsPrisma) {
    const connectionUrl = new URL(databaseUrl);
    const localWithoutTls = process.env.DATABASE_SSL === 'disable' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(connectionUrl.hostname);
    // pg URL SSL parameters replace the explicit SSL object; keep trust settings authoritative.
    // pgbouncer is a Prisma engine hint from integration URLs; the pg adapter does not use it.
    for (const parameter of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'pgbouncer']) {
      connectionUrl.searchParams.delete(parameter);
    }
    const adapter = new PrismaPg({
      connectionString: connectionUrl.toString(),
      max: 1,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
      // A disposable loopback database can explicitly opt out of TLS.
      ssl: localWithoutTls ? false : { ca: databaseCertificateAuthorities, rejectUnauthorized: true },
    });
    globalThis.personalPrsPrisma = new PrismaClient({ adapter });
  }

  return globalThis.personalPrsPrisma;
}
