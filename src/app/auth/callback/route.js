import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { ensureMemberProfile } from '../../../lib/server/records';

// Email confirmation links only; recovery and other flows must not sign someone in through here.
const CONFIRMATION_TYPES = new Set(['signup', 'email']);
// Supabase token hashes are hex digests, optionally prefixed with `pkce_`; anything else is not a link we sent.
const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;
const MIN_PASSWORD_LENGTH = 8;
// Supabase hashes passwords with bcrypt, which ignores everything past 72 bytes.
const MAX_PASSWORD_LENGTH = 72;

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function confirmPage(request, { tokenHash, type, notice } = {}) {
  const query = new URLSearchParams();
  if (tokenHash) query.set('token_hash', tokenHash);
  if (type) query.set('type', type);
  if (notice) query.set('notice', notice);
  const search = query.toString();
  return redirect(search ? `/auth/confirm?${search}` : '/auth/confirm', request);
}

function linkFailure(error) {
  return error?.code === 'otp_expired' ? 'link_expired' : 'link_invalid';
}

function validLink(tokenHash, type) {
  return typeof tokenHash === 'string' && TOKEN_HASH_PATTERN.test(tokenHash) && CONFIRMATION_TYPES.has(type);
}

// Opening the email link never calls Auth: mail scanners and link previews would otherwise consume it, and
// a session must only start after an explicit, same-origin action on the confirmation page.
export async function GET(request) {
  if (!hasAuthConfiguration()) return redirect('/app?authError=configuration', request);
  const params = new URL(request.url).searchParams;
  // Supabase reports its own verification failures here when it redirects before we see the token.
  if (params.get('error') || params.get('error_code')) return confirmPage(request, { notice: linkFailure({ code: params.get('error_code') }) });
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  // A PKCE `code` link would need the browser that registered and signs in on open; it is not accepted.
  if (!validLink(tokenHash, type)) return confirmPage(request, { notice: 'link_invalid' });
  return confirmPage(request, { tokenHash, type });
}

// The confirmation page posts here. Order matters: nothing touches Auth until the origin, the link format,
// the new password and the existing-session choice are valid, and the member profile is created only after
// the chosen password is in place and every other session of the account has been revoked.
export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!hasAuthConfiguration()) return redirect('/app?authError=configuration', request);

  let form;
  try { form = await request.formData(); } catch { return confirmPage(request, { notice: 'link_invalid' }); }
  const tokenHash = form.get('token_hash');
  const type = form.get('type');
  if (!validLink(tokenHash, type)) return confirmPage(request, { notice: 'link_invalid' });
  const back = (notice) => confirmPage(request, { tokenHash, type, notice });

  const password = form.get('password');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return back('invalid_password');
  if (password !== form.get('confirm')) return back('mismatch');

  const client = await createAuthClient();
  // The page warns about an open session, but only this server-side check decides: whichever account it
  // belongs to, it is replaced only after the person explicitly agreed.
  const { data: current } = await client.auth.getUser();
  if (current?.user && form.get('replace_session') !== '1') return back('session_open');

  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  if (verified.error || !verified.data?.user) {
    if (verified.error?.status === 429) return back('rate_limited');
    return confirmPage(request, { notice: linkFailure(verified.error) });
  }

  // From here the link is spent. If a step fails, the browser keeps no half-finished session and no profile
  // is created; the account stays without access until an administrator resolves it (docs/AUTH.md).
  const incomplete = async () => {
    try { await client.auth.signOut({ scope: 'local' }); } catch {}
    return confirmPage(request, { notice: 'incomplete' });
  };
  try {
    const updated = await client.auth.updateUser({ password });
    if (updated.error) return incomplete();
    // Any session opened before the chosen password existed is revoked; only this one survives.
    const revoked = await client.auth.signOut({ scope: 'others' });
    if (revoked.error) return incomplete();
    await ensureMemberProfile(verified.data.user);
  } catch {
    return incomplete();
  }
  return redirect('/app', request);
}
