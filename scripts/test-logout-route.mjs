import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/logout/route.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';

async function logout({ error = null, configured = true, allowed = true } = {}) {
  const calls = [];
  const limits = [];
  const dependencies = {
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => configured,
      createAuthClient: async () => ({ auth: { signOut: async (options) => { calls.push(options); return { error }; } } }),
    },
    '../../../lib/server/rate-limit': {
      RATE_LIMIT_MESSAGE: 'Demasiadas solicitudes.',
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

const request = (requestOrigin = origin) => new Request(`${origin}/auth/logout`, { method: 'POST', headers: { origin: requestOrigin, 'x-real-ip': '203.0.113.7' } });

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

test('repeated sign-outs from one address are limited before reaching Auth', async () => {
  const { POST, calls } = await logout({ allowed: false });
  const response = await POST(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '42');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, []);
});
