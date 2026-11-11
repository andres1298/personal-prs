import 'server-only';
import { createHash } from 'node:crypto';
import { getPrisma } from './prisma.js';

const RETENTION_MS = 24 * 60 * 60 * 1000;

// Only the hash is stored, so the table never holds emails or IP addresses.
export function hashRateLimitKey(scope, subject) {
  return createHash('sha256').update(`${scope}:${subject}`).digest('hex');
}

// Each limit is { scope, subject, max, windowMs }; limits without a subject (an unknown IP) are skipped.
// Records one attempt against every limit and reports whether any of them is exceeded.
// Attempts are recorded before counting, so concurrent requests cannot all slip under the limit,
// and rejected attempts keep counting, so hammering an endpoint does not reopen it early.
// Serverless instances share no memory, which is why the counters live in Postgres.
export async function consumeRateLimits(limits, now = new Date()) {
  const active = limits.filter((limit) => limit.subject);
  if (!active.length) return false;
  const prisma = getPrisma();
  const keys = active.map(({ scope, subject }) => hashRateLimitKey(scope, subject));
  await prisma.rateLimitEvent.createMany({ data: keys.map((key) => ({ key, createdAt: now })) });
  const counts = await Promise.all(active.map(({ windowMs }, index) => prisma.rateLimitEvent.count({
    where: { key: keys[index], createdAt: { gt: new Date(now.getTime() - windowMs) } },
  })));
  await prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });
  return counts.some((count, index) => count > active[index].max);
}
