import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { isValidPasswordLength } from '../../../lib/password-policy';

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

// The link is verified only here, on submit: verifying on page load would let mail scanners that
// open links spend the single-use token before the person sees the form.
export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!hasAuthConfiguration()) return redirect('/reset-password?error=unavailable', request);
  let form;
  try { form = await request.formData(); } catch { return redirect('/reset-password?error=link_invalid', request); }
  const tokenHash = String(form.get('token_hash') ?? '');
  const password = String(form.get('password') ?? '');
  if (!tokenHash) return redirect('/reset-password?error=link_invalid', request);
  // Input mistakes return to the form with the link intact, before the token is spent.
  const resetPage = `/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
  if (!isValidPasswordLength(password)) return redirect(`${resetPage}&error=invalid_password`, request);
  if (password !== String(form.get('confirm') ?? '')) return redirect(`${resetPage}&error=mismatch`, request);

  const client = await createAuthClient();
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (verified.error) {
    return redirect(`/reset-password?error=${verified.error.code === 'otp_expired' ? 'link_expired' : 'link_invalid'}`, request);
  }
  const { error } = await client.auth.updateUser({ password });
  // Reusing the current password proves nothing new but is harmless: the person is already verified.
  if (error && error.code !== 'same_password') {
    // The link is spent, so do not leave a session behind whose password was never set.
    await client.auth.signOut({ scope: 'local' });
    return redirect('/reset-password?error=update_failed', request);
  }
  // End every other session of this account (stolen devices included); this one stays signed in.
  const { error: signOutError } = await client.auth.signOut({ scope: 'others' });
  if (signOutError) console.error('Other sessions were not revoked after a password reset:', signOutError.code ?? signOutError.status ?? 'unknown');
  return redirect('/', request);
}
