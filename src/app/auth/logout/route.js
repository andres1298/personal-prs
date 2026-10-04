import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (hasAuthConfiguration()) {
    const client = await createAuthClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) return new Response('Unable to sign out.', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
