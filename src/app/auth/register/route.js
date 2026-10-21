import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { createSignupProof, matchesGymCode, PROOF_METADATA_KEY } from '../../../lib/server/signup-proof';
import { clientIp, siteOrigin } from '../../../lib/server/site-origin';
import { hasTurnstileConfiguration, verifyTurnstile } from '../../../lib/server/turnstile';
import { isValidPasswordLength } from '../../../lib/password-policy';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Identical for a new and an already registered email, so the response never reveals which one it was.
const CHECK_EMAIL = { ok: true };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function fail(error, status) {
  return json({ ok: false, error }, status);
}

function validatedInput(form) {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!name || name.length > 80) return { error: 'invalid_name' };
  if (email.length > 254 || !emailPattern.test(email)) return { error: 'invalid_email' };
  if (!isValidPasswordLength(password)) return { error: 'invalid_password' };
  return { name, email, password };
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  // Without the code or the CAPTCHA secret nobody may register; never fall back to an open sign-up.
  if (!hasAuthConfiguration() || !process.env.GYM_SIGNUP_CODE || !hasTurnstileConfiguration()) return fail('unavailable', 503);

  let form;
  try { form = await request.formData(); } catch { return fail('invalid_name', 400); }
  const input = validatedInput(form);
  if (input.error) return fail(input.error, 400);

  if (!matchesGymCode(String(form.get('code') ?? ''), process.env.GYM_SIGNUP_CODE)) return fail('wrong_code', 403);
  if (!await verifyTurnstile(String(form.get('cf-turnstile-response') ?? ''), clientIp(request))) return fail('captcha_failed', 400);

  const client = await createAuthClient();
  const { error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${siteOrigin(request)}/auth/callback`,
      data: { full_name: input.name, [PROOF_METADATA_KEY]: createSignupProof(input.email, process.env.GYM_SIGNUP_CODE) },
    },
  });
  if (!error) return json(CHECK_EMAIL);
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return json(CHECK_EMAIL);
  if (error.code === 'weak_password') return fail('invalid_password', 400);
  if (error.code === 'email_address_invalid') return fail('invalid_email', 400);
  if (error.status === 429 || error.code?.startsWith('over_')) return fail('rate_limited', 429);
  return fail('unknown', 502);
}
