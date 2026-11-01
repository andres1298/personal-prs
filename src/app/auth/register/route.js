import { randomBytes, randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { captchaMode, hasCaptchaConfiguration, readCaptchaToken, verifyTurnstile } from '../../../lib/server/turnstile';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Identical for a new and an already registered email, so the response never reveals which one it was.
const CHECK_EMAIL = { ok: true };
const PASSWORD_CLASSES = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789', '!#$%&*+-=?@^_~'];

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function fail(error, status) {
  return json({ ok: false, error }, status);
}

// Confirmation links must open the public site, not whichever deployment or alias served the form:
// Vercel puts preview and deployment URLs behind its own login. Local development has neither variable.
function siteOrigin(request) {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : new URL(request.url).origin;
}

function clientIp(request) {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
}

function validatedInput(form) {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!name || name.length > 80) return { error: 'invalid_name' };
  if (email.length > 254 || !emailPattern.test(email)) return { error: 'invalid_email' };
  return { name, email };
}

// The account is created with a password nobody knows, not even the person registering: the real one is
// chosen on the confirmation page by whoever controls the inbox. 256 random bits, plus one character of
// each class so any provider password policy accepts it; 47 characters stays under bcrypt's 72 bytes.
function pendingPassword() {
  return randomBytes(32).toString('base64url') + PASSWORD_CLASSES.map((chars) => chars[randomInt(chars.length)]).join('');
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  const mode = captchaMode();
  // Without what the CAPTCHA mode needs, registration stays closed instead of running unprotected.
  if (!hasAuthConfiguration() || !hasCaptchaConfiguration(mode)) return fail('unavailable', 503);

  let form;
  try { form = await request.formData(); } catch { return fail('invalid_name', 400); }
  const input = validatedInput(form);
  if (input.error) return fail(input.error, 400);

  const captchaToken = readCaptchaToken(form);
  if (mode === 'provider') {
    // Supabase redeems the token; an empty one would only spend a request on a certain rejection.
    if (!captchaToken) return fail('captcha_failed', 400);
  } else if (!await verifyTurnstile(captchaToken, clientIp(request))) {
    return fail('captcha_failed', 400);
  }

  const client = await createAuthClient();
  const { error } = await client.auth.signUp({
    email: input.email,
    password: pendingPassword(),
    options: {
      emailRedirectTo: `${siteOrigin(request)}/auth/callback`,
      data: { full_name: input.name },
      ...(mode === 'provider' ? { captchaToken } : {}),
    },
  });
  if (!error) return json(CHECK_EMAIL);
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return json(CHECK_EMAIL);
  if (error.code === 'captcha_failed') return fail('captcha_failed', 400);
  if (error.code === 'email_address_invalid') return fail('invalid_email', 400);
  if (error.status === 429 || error.code?.startsWith('over_')) return fail('rate_limited', 429);
  return fail('unknown', 502);
}
