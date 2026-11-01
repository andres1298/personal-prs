import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/login/route.js', import.meta.url), 'utf8');
const limiterSource = await readFile(new URL('../src/lib/server/rate-limit.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';

async function link(code, dependencies) {
  const module = new SourceTextModule(code);
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return module.namespace;
}

// The real limiter over a fake bucket table that reports `count` requests in the current window.
async function limiter(count, keys) {
  const prisma = {
    $queryRaw: async (strings, key) => { keys.push(key); return [{ count, expiresAt: new Date(Date.now() + 60_000) }]; },
    $executeRaw: async () => 0,
  };
  return link(limiterSource, { 'server-only': {}, 'node:crypto': { createHash }, './prisma.js': { getPrisma: () => prisma } });
}

async function login({ error = null, configured = true, requestCount = 1 } = {}) {
  const calls = [];
  const keys = [];
  const dependencies = {
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => configured,
      createAuthClient: async () => ({ auth: { signInWithPassword: async (credentials) => { calls.push(credentials); return { data: {}, error }; } } }),
    },
    '../../../lib/server/rate-limit': await limiter(requestCount, keys),
  };
  const { POST } = await link(source, dependencies);
  return { POST, calls, keys };
}

function form(fields, requestOrigin = origin) {
  return new Request(`${origin}/auth/login`, {
    method: 'POST', headers: { origin: requestOrigin, 'x-real-ip': '203.0.113.7' }, body: new URLSearchParams(fields),
  });
}

test('valid credentials sign in with a normalized email', async () => {
  const { POST, calls } = await login();
  const response = await POST(form({ email: ' Ana@Example.TEST ', password: 'long-password' }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [{ email: 'ana@example.test', password: 'long-password' }]);
});

test('wrong or missing credentials return to the login form', async () => {
  const failed = await login({ error: { message: 'Private auth diagnostic' } });
  assert.equal((await failed.POST(form({ email: 'ana@example.test', password: 'wrong-password' }))).headers.get('Location'), `${origin}/app?authError=credentials`);
  const missing = await login();
  assert.equal((await missing.POST(form({ email: 'ana@example.test' }))).headers.get('Location'), `${origin}/app?authError=credentials`);
  assert.deepEqual(missing.calls, []);
});

test('cross-origin and unconfigured logins never reach Auth', async () => {
  const crossOrigin = await login();
  assert.equal((await crossOrigin.POST(form({ email: 'a@b.co', password: 'long-password' }, 'https://other.example.test'))).status, 403);
  const unconfigured = await login({ configured: false });
  assert.equal((await unconfigured.POST(form({ email: 'a@b.co', password: 'long-password' }))).headers.get('Location'), `${origin}/app?authError=configuration`);
  assert.deepEqual([...crossOrigin.calls, ...unconfigured.calls], []);
});

test('no Google OAuth flow remains', () => {
  assert.doesNotMatch(source, /OAuth|google/i);
});

test('too many attempts from one address stop before Auth and say so', async () => {
  const { POST, calls, keys } = await login({ requestCount: 21 });
  const response = await POST(form({ email: 'ana@example.test', password: 'long-password' }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/app?authError=rate_limited`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, []);
  // The bucket is keyed by a hash of the policy and the client address, never the address itself.
  assert.deepEqual(keys, [createHash('sha256').update('login:203.0.113.7').digest('hex')]);
});

test('provider rate limits are reported as rate limited, not as wrong credentials', async () => {
  for (const error of [
    { status: 429, code: 'over_request_rate_limit', message: 'Private auth diagnostic' },
    { status: 400, code: 'over_email_send_rate_limit', message: 'Private auth diagnostic' },
  ]) {
    const { POST, calls } = await login({ error });
    const response = await POST(form({ email: 'ana@example.test', password: 'long-password' }));
    assert.equal(response.headers.get('Location'), `${origin}/app?authError=rate_limited`);
    assert.equal(calls.length, 1);
  }
  const wrong = await login({ error: { status: 400, code: 'invalid_credentials' } });
  assert.equal((await wrong.POST(form({ email: 'ana@example.test', password: 'wrong' }))).headers.get('Location'), `${origin}/app?authError=credentials`);
});

test('the sign-in screen explains a rate limit', async () => {
  const panel = await readFile(new URL('../src/app/auth-panel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /rate_limited: 'Demasiados intentos/);
});
