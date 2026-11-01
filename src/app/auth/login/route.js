import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { captchaMode, readCaptchaToken } from '../../../lib/server/turnstile';

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!hasAuthConfiguration()) return redirect('/app?authError=configuration', request);
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return redirect('/app?authError=credentials', request);
  // With provider CAPTCHA on, Supabase also checks the widget's token on password sign-in.
  const captchaToken = captchaMode() === 'provider' ? readCaptchaToken(form) : null;
  if (captchaToken === '') return redirect('/app?authError=captcha_failed', request);
  const client = await createAuthClient();
  const { error } = await client.auth.signInWithPassword({ email, password, ...(captchaToken ? { options: { captchaToken } } : {}) });
  if (error?.code === 'captcha_failed') return redirect('/app?authError=captcha_failed', request);
  return redirect(error ? '/app?authError=credentials' : '/app', request);
}
