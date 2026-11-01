import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { getPrisma } from './prisma.js';

// Fixed-window limits. Vercel instances share no memory, so the counters live in Postgres
// (RateLimitBucket) and every instance sees the same budget. Public auth and invitation routes
// are limited per client IP; the authenticated API is limited per verified user, with separate
// budgets for reads and writes.
export const RATE_LIMITS = Object.freeze({
  login: { limit: 20, windowSeconds: 600, subject: 'ip' },
  logout: { limit: 30, windowSeconds: 600, subject: 'ip' },
  inviteAccept: { limit: 10, windowSeconds: 600, subject: 'ip' },
  invitePage: { limit: 60, windowSeconds: 600, subject: 'ip' },
  apiRead: { limit: 120, windowSeconds: 60, subject: 'user' },
  apiWrite: { limit: 30, windowSeconds: 60, subject: 'user' },
});

export const RATE_LIMIT_MESSAGE = 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
// Requests without a usable client address share one bucket instead of going unlimited.
export const UNKNOWN_CLIENT = 'unknown';
// About one call in a hundred also deletes expired buckets, so the table stays small without a cron job.
const PRUNE_PROBABILITY = 0.01;
const MAX_SUBJECT_LENGTH = 256;

// Keys are pseudonymous: raw IP addresses and user ids never reach the table, only a hash of the
// policy and the subject that expires with its window. With RATE_LIMIT_SECRET set the hash is an
// HMAC, so a leaked table cannot be matched back to addresses or accounts without that secret;
// without it a plain SHA-256 is used and the keys remain guessable for known subjects.
export function rateLimitKey(policyName, subject, secret = process.env.RATE_LIMIT_SECRET) {
  const value = typeof subject === 'string' && subject.trim() ? subject.trim().slice(0, MAX_SUBJECT_LENGTH) : UNKNOWN_CLIENT;
  const hash = secret ? createHmac('sha256', secret) : createHash('sha256');
  return hash.update(`${policyName}:${value}`).digest('hex');
}

// One IPv6 host usually controls a whole /64, so IPv6 clients share a bucket per /64 prefix instead of
// getting a fresh one for every address. IPv4-mapped addresses count as their IPv4 address; IPv4 and
// anything unparseable are returned unchanged.
export function ipSubject(address) {
  if (typeof address !== 'string') return address;
  const value = address.trim().replace(/^\[(.*)\]$/, '$1').split('%')[0];
  if (!isIPv6(value)) return address.trim();
  let text = value.toLowerCase();
  // A trailing dotted IPv4 part fills the last two hextets.
  const embedded = text.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (embedded) {
    const [a, b, c, d] = embedded.slice(2).map(Number);
    text = `${embedded[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array(8 - headParts.length - tailParts.length).fill('0');
  const hextets = [...headParts, ...fill, ...tailParts].map((part) => parseInt(part, 16));
  if (hextets.slice(0, 5).every((part) => part === 0) && hextets[5] === 0xffff) {
    return [hextets[6] >> 8, hextets[6] & 255, hextets[7] >> 8, hextets[7] & 255].join('.');
  }
  return `${hextets.slice(0, 4).map((part) => part.toString(16)).join(':')}::/64`;
}

// On Vercel, x-real-ip and x-forwarded-for are set by the platform, not by the client.
export function clientIp(headers) {
  const realIp = headers?.get('x-real-ip')?.trim();
  if (realIp) return ipSubject(realIp);
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0].trim();
  return forwarded ? ipSubject(forwarded) : UNKNOWN_CLIENT;
}

// Supabase answers HTTP 429 or an over_*_rate_limit code when its own limits are hit.
export function isProviderRateLimit(error) {
  return error?.status === 429 || (typeof error?.code === 'string' && error.code.startsWith('over_'));
}

function policyFor(policyName) {
  const policy = Object.hasOwn(RATE_LIMITS, policyName) ? RATE_LIMITS[policyName] : null;
  if (!policy) throw new Error(`Unknown rate limit policy: ${policyName}`);
  return policy;
}

/**
 * Counts one request against the policy's window for the subject and reports whether it may proceed.
 * Fails open: if the database is unreachable or the migration is not applied yet, the request is
 * allowed so sign-in keeps working; the Vercel Firewall rule and the provider's limits still apply.
 */
export async function checkRateLimit(policyName, subject, { random = Math.random, now = () => Date.now() } = {}) {
  const policy = policyFor(policyName);
  const key = rateLimitKey(policyName, subject);
  let row;
  try {
    const prisma = getPrisma();
    // One atomic statement: a new or expired bucket restarts at 1, otherwise the count grows.
    [row] = await prisma.$queryRaw`
      INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${policy.windowSeconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN EXCLUDED."expiresAt" ELSE "RateLimitBucket"."expiresAt" END
      RETURNING "count", "expiresAt"`;
    if (random() < PRUNE_PROBABILITY) {
      await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "expiresAt" < now()`;
    }
  } catch (error) {
    // Never log the subject or the key; the error code is enough to notice a missing migration.
    console.error('Rate limit check failed; allowing the request.', error?.code ?? error?.name ?? 'unknown');
    return { allowed: true, retryAfter: 0 };
  }
  const count = Number(row?.count);
  if (!Number.isFinite(count) || count <= policy.limit) return { allowed: true, retryAfter: 0 };
  const remaining = Math.ceil((new Date(row.expiresAt).getTime() - now()) / 1000);
  const retryAfter = Number.isFinite(remaining) ? Math.min(Math.max(remaining, 1), policy.windowSeconds) : policy.windowSeconds;
  return { allowed: false, retryAfter };
}

// For JSON API routes: null when the request may proceed, otherwise a 429 response with Retry-After.
export async function rateLimitResponse(policyName, subject) {
  const { allowed, retryAfter } = await checkRateLimit(policyName, subject);
  if (allowed) return null;
  return Response.json({ error: RATE_LIMIT_MESSAGE }, {
    status: 429,
    headers: { 'Cache-Control': 'private, no-store', 'Retry-After': String(retryAfter) },
  });
}
