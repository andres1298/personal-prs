import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { ensureMemberProfile } from '../../../lib/server/records';
import { PASSWORD_RETRY_COOKIE, createPasswordRetry, passwordRetryCookieOptions, readPasswordRetry } from '../../../lib/server/signup-retry';

// Sign-up confirmation links only. Supabase's broader `email` type also verifies magic-link and recovery
// tokens, and none of those may create a member profile through here.
const CONFIRMATION_TYPE = 'signup';
// Supabase token hashes are hex digests, optionally prefixed with `pkce_`; anything else is not a link we sent.
const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;
const MIN_PASSWORD_LENGTH = 8;
// Supabase hashes passwords with bcrypt and rejects anything over 72 bytes (not characters): ñ or an accented
// letter takes two bytes in UTF-8. Checked here, before the link is used.
const MAX_PASSWORD_BYTES = 72;
// Provider answers about the chosen password itself; the person can fix them by choosing another one.
const PASSWORD_REJECTIONS = new Set(['weak_password', 'validation_failed']);
// The form field that marks a second attempt at the password after the link was already used.
const PASSWORD_STEP = 'password';

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function confirmPage(request, { tokenHash, type, step, notice } = {}) {
  const query = new URLSearchParams();
  if (tokenHash) query.set('token_hash', tokenHash);
  if (type) query.set('type', type);
  if (step) query.set('step', step);
  if (notice) query.set('notice', notice);
  const search = query.toString();
  return redirect(search ? `/auth/confirm?${search}` : '/auth/confirm', request);
}

function linkFailure(error) {
  return error?.code === 'otp_expired' ? 'link_expired' : 'link_invalid';
}

function validLink(tokenHash, type) {
  return typeof tokenHash === 'string' && TOKEN_HASH_PATTERN.test(tokenHash) && type === CONFIRMATION_TYPE;
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES;
}

// No status (network failure) or a 5xx is the provider being unavailable, not a verdict on the request.
function isTransient(error) {
  return !error?.status || error.status >= 500;
}

// The notice for a failure the person can recover from by trying again, or null when only an administrator can.
function retryNotice(error) {
  if (PASSWORD_REJECTIONS.has(error?.code)) return 'weak_password';
  if (error?.status === 429) return 'rate_limited';
  return isTransient(error) ? 'unavailable' : null;
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
  const retrying = form.get('step') === PASSWORD_STEP;
  const tokenHash = form.get('token_hash');
  const type = form.get('type');
  if (!retrying && !validLink(tokenHash, type)) return confirmPage(request, { notice: 'link_invalid' });
  const back = (notice) => confirmPage(request, retrying ? { step: PASSWORD_STEP, notice } : { tokenHash, type, notice });

  const password = form.get('password');
  if (!validPassword(password)) return back('invalid_password');
  if (password !== form.get('confirm')) return back('mismatch');

  const client = await createAuthClient();
  const cookieStore = await cookies();
  const { data: current } = await client.auth.getUser();
  const activation = { request, client, cookieStore, password };

  if (retrying) {
    // Only the browser that used the link holds both the verified session and the signed marker for it.
    const markedUserId = readPasswordRetry(cookieStore.get(PASSWORD_RETRY_COOKIE)?.value);
    if (!markedUserId || current?.user?.id !== markedUserId) return incomplete(activation);
    return activate({ ...activation, user: current.user });
  }

  // The page warns about an open session, but only this server-side check decides: whichever account it
  // belongs to, it is replaced only after the person explicitly agreed.
  if (current?.user && form.get('replace_session') !== '1') return back('session_open');

  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  if (verified.error || !verified.data?.user) {
    const status = verified.error ? verified.error.status : 400;
    if (status === 429) return back('rate_limited');
    // The token was not necessarily used: keep the form so the person can simply try again.
    if (verified.error && isTransient(verified.error)) return back('unavailable');
    return confirmPage(request, { notice: linkFailure(verified.error) });
  }
  return activate({ ...activation, user: verified.data.user });
}

function clearRetry({ request, cookieStore }) {
  if (cookieStore.get(PASSWORD_RETRY_COOKIE)) cookieStore.set(PASSWORD_RETRY_COOKIE, '', passwordRetryCookieOptions(request, 0));
}

// The link is spent and the account cannot be activated from this browser: no session and no profile are
// left behind, and an administrator resolves it (docs/AUTH.md).
async function incomplete(activation, scope = 'local') {
  clearRetry(activation);
  try { await activation.client.auth.signOut({ scope }); } catch {}
  return confirmPage(activation.request, { notice: 'incomplete' });
}

// Runs with the session the link (or a signed retry) proved belongs to the inbox owner.
async function activate(activation) {
  const { request, client, cookieStore, user, password } = activation;
  // A recoverable failure keeps the verified session and lets this browser choose the password again.
  const retry = (notice) => {
    const marker = createPasswordRetry(user.id);
    if (!marker) return incomplete(activation);
    cookieStore.set(PASSWORD_RETRY_COOKIE, marker, passwordRetryCookieOptions(request));
    return confirmPage(request, { step: PASSWORD_STEP, notice });
  };
  const failed = (error) => {
    const notice = retryNotice(error);
    return notice ? retry(notice) : incomplete(activation);
  };

  try {
    // `same_password` only happens on a retry after this person's password was already set.
    const chosen = await client.auth.updateUser({ password });
    if (chosen.error && chosen.error.code !== 'same_password') return failed(chosen.error);
    // Any session opened before the chosen password existed is revoked; only this one survives.
    const revoked = await client.auth.signOut({ scope: 'others' });
    if (revoked.error) return failed(revoked.error);
    // A session opened before the revocation could have changed the password in between. Setting it again
    // must answer `same_password`; success means someone else changed it, so fail closed and revoke everything.
    const check = await client.auth.updateUser({ password });
    if (!check.error) return incomplete(activation, 'global');
    if (check.error.code !== 'same_password') return failed(check.error);
    await ensureMemberProfile(user);
  } catch {
    return retry('unavailable');
  }
  clearRetry(activation);
  return redirect('/app', request);
}
