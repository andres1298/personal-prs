import { NextResponse } from 'next/server';
import { createAuthClient, expiredAuthCookies, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';
import { checkRateLimit, clientIp } from '../../../lib/server/rate-limit';

function toLandingPage(request) {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

// Signing out lands on the public landing page; an installed app is sent on to /app from there.
export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!(await checkRateLimit('logout', clientIp(request.headers))).allowed) {
    // The limit only spares the Auth call; it never keeps a session alive on this device.
    const response = toLandingPage(request);
    for (const cookie of expiredAuthCookies(request)) response.headers.append('Set-Cookie', cookie);
    return response;
  }
  if (hasAuthConfiguration()) {
    const client = await createAuthClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) return new Response('Unable to sign out.', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
  return toLandingPage(request);
}
