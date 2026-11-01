import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// After a sign-up link has been used, a password the provider rejects (or a transient failure) must not
// strand the account. The browser that used the link keeps its verified session plus this short-lived,
// HMAC-signed marker bound to the user id, and may choose the password again on the confirmation page.
// A session alone is not enough: anyone who knew a pending password could otherwise open one and finish.
export const PASSWORD_RETRY_COOKIE = 'signup_password_retry';
export const PASSWORD_RETRY_SECONDS = 30 * 60;
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRY_PATTERN = /^\d{1,12}$/;

// A purpose-specific key derived from the server secret, so the marker never reuses the raw API key.
function retryKey() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return secret ? createHmac('sha256', secret).update('signup-password-retry:v1').digest() : null;
}

function sign(key, userId, expiresAt) {
  return createHmac('sha256', key).update(`${userId}.${expiresAt}`).digest('base64url');
}

// Returns the cookie value, or null when no server secret is configured (the caller then fails closed).
export function createPasswordRetry(userId, now = Date.now()) {
  const key = retryKey();
  if (!key || typeof userId !== 'string' || !USER_ID_PATTERN.test(userId)) return null;
  const expiresAt = Math.floor(now / 1000) + PASSWORD_RETRY_SECONDS;
  return `${userId}.${expiresAt}.${sign(key, userId, expiresAt)}`;
}

// Returns the user id the marker was issued for, or null if it is missing, malformed, expired or forged.
export function readPasswordRetry(value, now = Date.now()) {
  const key = retryKey();
  if (!key || typeof value !== 'string') return null;
  const [userId, expiresAt, signature, ...rest] = value.split('.');
  if (rest.length || !USER_ID_PATTERN.test(userId ?? '') || !EXPIRY_PATTERN.test(expiresAt ?? '') || !signature) return null;
  if (Number(expiresAt) * 1000 <= now) return null;
  const expected = Buffer.from(sign(key, userId, expiresAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return userId;
}

export function passwordRetryCookieOptions(request, maxAge = PASSWORD_RETRY_SECONDS) {
  return { httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:', path: '/auth', maxAge };
}
