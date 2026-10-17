import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!hasAuthConfiguration()) return NextResponse.redirect(new URL('/?authError=configuration', request.url), 303);
  const client = await createAuthClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL('/auth/callback', request.url).href, skipBrowserRedirect: true },
  });
  const response = NextResponse.redirect(error || !data.url ? new URL('/?authError=login', request.url) : data.url, 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
