import { NextResponse } from 'next/server';
import { createAuthClient, hasSameOrigin } from '../../../lib/server/auth';
import { acceptInvitation, InvitationError } from '../../../lib/server/invitations';
import { captchaMode, readCaptchaToken } from '../../../lib/server/turnstile';

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  const invitationPage = `/invite/${encodeURIComponent(token)}`;
  if (password !== String(form.get('confirm') ?? '')) return redirect(`${invitationPage}?error=mismatch`, request);
  // With provider CAPTCHA on, the sign-in below needs the widget's token; without one, keep the link unused.
  const captchaToken = captchaMode() === 'provider' ? readCaptchaToken(form) : null;
  if (captchaToken === '') return redirect(`${invitationPage}?error=captcha_failed`, request);
  let email;
  try {
    ({ email } = await acceptInvitation(token, password));
  } catch (error) {
    // An unusable link renders the page's invalid state; other failures keep the form with a message.
    if (error instanceof InvitationError && error.code === 'invalid_link') return redirect(invitationPage, request);
    const code = error instanceof InvitationError ? error.code : 'unknown';
    return redirect(`${invitationPage}?error=${code}`, request);
  }
  const client = await createAuthClient();
  const { error } = await client.auth.signInWithPassword({ email, password, ...(captchaToken ? { options: { captchaToken } } : {}) });
  // The account already exists (for example, the CAPTCHA token was rejected): the person signs in normally.
  return redirect(error ? '/app?authError=account_created' : '/app', request);
}
