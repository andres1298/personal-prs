import 'server-only';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

export function hasTurnstileConfiguration() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Fails closed: a missing token, an unreachable verifier or a malformed answer all count as failure.
export async function verifyTurnstile(token, remoteIp, fetchImpl = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== 'string' || !token || token.length > MAX_TURNSTILE_TOKEN_LENGTH) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const response = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true;
  } catch {
    return false;
  }
}
