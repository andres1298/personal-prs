import 'server-only';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

// 'app' (default): the register route verifies the Turnstile token itself with the secret key.
// 'provider': Supabase Auth verifies it; the app only forwards the token as captchaToken.
// A Turnstile token can be redeemed once, so exactly one of the two may verify it.
export function captchaMode() {
  return process.env.AUTH_CAPTCHA_MODE?.trim().toLowerCase() === 'provider' ? 'provider' : 'app';
}

export function hasTurnstileConfiguration() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// What the active mode needs before registration may open: the secret to verify in the app,
// or the site key to render the widget whose token the provider verifies.
export function hasCaptchaConfiguration(mode = captchaMode()) {
  return mode === 'provider' ? Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) : hasTurnstileConfiguration();
}

// Login and invitation forms show the widget only when the provider checks those actions too.
export function providerCaptchaSiteKey() {
  return captchaMode() === 'provider' ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '' : '';
}

// The widget's token as a form posts it, or '' when it is missing or implausibly long.
export function readCaptchaToken(form) {
  const token = form.get('cf-turnstile-response');
  return typeof token === 'string' && token.length <= MAX_TURNSTILE_TOKEN_LENGTH ? token : '';
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
