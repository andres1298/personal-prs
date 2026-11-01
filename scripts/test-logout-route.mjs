import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/logout/route.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';

async function logout({ error = null, configured = true } = {}) {
  const calls = [];
  const dependencies = {
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => configured,
      createAuthClient: async () => ({ auth: { signOut: async (options) => { calls.push(options); return { error }; } } }),
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
  return { POST: module.namespace.POST, calls };
}

const request = (requestOrigin = origin) => new Request(`${origin}/auth/logout`, { method: 'POST', headers: { origin: requestOrigin } });

test('signing out ends the local session and lands on the landing page', async () => {
  const { POST, calls } = await logout();
  const response = await POST(request());
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
