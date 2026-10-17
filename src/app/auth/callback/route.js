import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration } from '../../../lib/server/auth';

export async function GET(request) {
  const code = new URL(request.url).searchParams.get('code');
  let succeeded = false;
  if (code && hasAuthConfiguration()) {
    const client = await createAuthClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    succeeded = !error;
  }
  // Only a fixed local destination is allowed; query parameters cannot redirect elsewhere.
  const response = NextResponse.redirect(new URL(succeeded ? '/' : '/?authError=callback', request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
