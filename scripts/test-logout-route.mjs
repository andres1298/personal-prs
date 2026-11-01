import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { expiredAuthCookies, hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/logout/route.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';

async function logout({ error = null, configured = true, allowed = true } = {}) {
  const calls = [];
  const limits = [];
  const dependencies = {
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    '../../../lib/server/auth': {
      hasSameOrigin,
      expiredAuthCookies,
      hasAuthConfiguration: () => configured,
      createAuthClient: async () => ({ auth: { signOut: async (options) => { calls.push(options); return { error }; } } }),
    },
    '../../../lib/server/rate-limit': {
      clientIp: (headers) => headers.get('x-real-ip') ?? 'unknown',
      checkRateLimit: async (policy, subject) => { limits.push([policy, subject]); return allowed ? { allowed, retryAfter: 0 } : { allowed, retryAfter: 42 }; },
    },
  };
  const module = new SourceTextModule(source);
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return { POST: module.namespace.POST, calls, limits };
}

const request = (requestOrigin = origin, cookie) => new Request(`${origin}/auth/logout`, {
  method: 'POST',
  headers: { origin: requestOrigin, 'x-real-ip': '203.0.113.7', ...(cookie ? { cookie } : {}) },
});

test('signing out ends the local session and lands on the landing page', async () => {
  const { POST, calls, limits } = await logout();
  const response = await POST(request());
  assert.deepEqual(limits, [['logout', '203.0.113.7']]);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [{ scope: 'local' }]);
});

test('a failed sign-out stays put and cross-origin requests never reach Auth', async () => {
  const failed = await logout({ error: { message: 'Private auth diagnostic' } });
  const response = await failed.POST(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Location'), null);
  const crossOrigin = await logout();
  assert.equal((await crossOrigin.POST(request('https://other.example.test'))).status, 403);
  assert.deepEqual(crossOrigin.calls, []);
});

test('a limited sign-out skips Auth but still clears the session cookies on this device', async () => {
  const { POST, calls } = await logout({ allowed: false });
  const cookie = 'theme=dark; sb-abc123-auth-token.0=part0; sb-abc123-auth-token.1=part1; sb-abc123-auth-token-code-verifier=v; other-auth-token=x';
  const response = await POST(request(origin, cookie));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, []);
  const cleared = response.headers.getSetCookie();
  assert.deepEqual(cleared.map((value) => value.split('=')[0]), ['sb-abc123-auth-token.0', 'sb-abc123-auth-token.1', 'sb-abc123-auth-token-code-verifier']);
  for (const value of cleared) {
    assert.match(value, /=; Path=\/; Max-Age=0; SameSite=Lax; Secure$/);
    assert.doesNotMatch(value, /part0|part1/);
  }
});

test('expired auth cookies cover the unchunked session cookie and skip unrelated cookies', () => {
  const plain = new Request('http://localhost:3000/auth/logout', { headers: { cookie: 'sb-xyz-auth-token=base64-abc; sb-xyz-auth-token=dup; session=1' } });
  assert.deepEqual(expiredAuthCookies(plain), ['sb-xyz-auth-token=; Path=/; Max-Age=0; SameSite=Lax']);
  assert.deepEqual(expiredAuthCookies(new Request('https://app.example.test/auth/logout')), []);
});
