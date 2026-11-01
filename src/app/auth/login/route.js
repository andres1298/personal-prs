import { NextResponse } from 'next/server';
import { createAuthClient, hasAuthConfiguration, hasSameOrigin } from '../../../lib/server/auth';

function redirect(path, request) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return new Response('Invalid origin.', { status: 403 });
  if (!hasAuthConfiguration()) return redirect('/app?authError=configuration', request);
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return redirect('/app?authError=credentials', request);
  const client = await createAuthClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  return redirect(error ? '/app?authError=credentials' : '/app', request);
}
