import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration } from '../../../lib/server/auth';

// Email confirmation links only; recovery and other flows must not sign someone in through here.
const CONFIRMATION_TYPES = new Set(['signup', 'email']);

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function failure(error) {
  return error?.code === 'otp_expired' ? 'link_expired' : 'link_invalid';
}

// The home page creates the member profile (getAccess) once it sees the confirmed session.
export async function GET(request) {
  if (!hasAuthConfiguration()) return redirect('/app?authError=configuration', request);
  const params = new URL(request.url).searchParams;
  // Supabase reports its own verification failures here when it redirects before we see the token.
  if (params.get('error') || params.get('error_code')) return redirect(`/app?authError=${failure({ code: params.get('error_code') })}`, request);
  const client = await createAuthClient();
  const tokenHash = params.get('token_hash');
  const code = params.get('code');
  let result;
  // token_hash works when the link opens on another device; code needs the browser that registered.
  if (tokenHash && CONFIRMATION_TYPES.has(params.get('type'))) result = await client.auth.verifyOtp({ token_hash: tokenHash, type: params.get('type') });
  else if (code) result = await client.auth.exchangeCodeForSession(code);
  else return redirect('/app?authError=link_invalid', request);
  return redirect(result.error ? `/app?authError=${failure(result.error)}` : '/app', request);
}
