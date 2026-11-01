import { NextResponse } from 'next/server';
import { createAuthClient, hasSameOrigin } from '../../../lib/server/auth';
import { acceptInvitation, InvitationError } from '../../../lib/server/invitations';

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
  await client.auth.signInWithPassword({ email, password });
  return redirect('/app', request);
}
