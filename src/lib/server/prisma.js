import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.ts';

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for server persistence.');
  }

  if (!globalThis.personalPrsPrisma) {
    const connectionUrl = new URL(process.env.DATABASE_URL);
    const localWithoutTls = process.env.DATABASE_SSL === 'disable' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(connectionUrl.hostname);
    // pg URL SSL parameters replace the explicit SSL object; keep trust settings authoritative.
    for (const parameter of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) {
      connectionUrl.searchParams.delete(parameter);
    }
    const adapter = new PrismaPg({
      connectionString: connectionUrl.toString(),
      max: 1,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
      // A disposable loopback database can explicitly opt out of TLS.
      ssl: localWithoutTls ? false : { rejectUnauthorized: true },
    });
    globalThis.personalPrsPrisma = new PrismaClient({ adapter });
  }

  return globalThis.personalPrsPrisma;
}
