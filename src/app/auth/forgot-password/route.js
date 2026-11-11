import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { consumeRateLimits } from '../../../lib/server/rate-limit';
import { clientIp, siteOrigin } from '../../../lib/server/site-origin';

const HOUR_MS = 60 * 60 * 1000;
// Per email: protects third parties from being flooded. Per IP: protects the sender's daily quota.
const RECOVERY_LIMITS = { email: 3, ip: 10, windowMs: HOUR_MS };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!hasAuthConfiguration()) return redirect('/forgot-password?error=unavailable', request);
  let form;
  try { form = await request.formData(); } catch { return redirect('/forgot-password?error=invalid_email', request); }
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) return redirect('/forgot-password?error=invalid_email', request);

  let limited;
  try {
    limited = await consumeRateLimits([
      { scope: 'recovery:email', subject: email, max: RECOVERY_LIMITS.email, windowMs: RECOVERY_LIMITS.windowMs },
      { scope: 'recovery:ip', subject: clientIp(request), max: RECOVERY_LIMITS.ip, windowMs: RECOVERY_LIMITS.windowMs },
    ]);
  } catch {
    // Without a working limiter, sending could be abused; fail closed.
    return redirect('/forgot-password?error=unavailable', request);
  }
  // The limiter counts every attempt, whether or not the account exists, so this reveals nothing.
  if (limited) return redirect('/forgot-password?error=rate_limited', request);

  const client = await createAuthClient();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteOrigin(request)}/reset-password` });
  // Supabase only tries to send (and can only fail) for existing accounts, so any error must look like success.
  if (error) console.error('Password recovery email was not sent:', error.code ?? error.status ?? 'unknown');
  return redirect('/forgot-password?sent=1', request);
}
