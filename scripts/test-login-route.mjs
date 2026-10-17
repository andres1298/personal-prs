import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/login/route.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';

async function login({ error = null, configured = true } = {}) {
  const calls = [];
  const dependencies = {
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) } },
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => configured,
      createAuthClient: async () => ({ auth: { signInWithPassword: async (credentials) => { calls.push(credentials); return { data: {}, error }; } } }),
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

function form(fields, requestOrigin = origin) {
  return new Request(`${origin}/auth/login`, { method: 'POST', headers: { origin: requestOrigin }, body: new URLSearchParams(fields) });
}

test('valid credentials sign in with a normalized email', async () => {
  const { POST, calls } = await login();
  const response = await POST(form({ email: ' Ana@Example.TEST ', password: 'long-password' }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [{ email: 'ana@example.test', password: 'long-password' }]);
});

test('wrong or missing credentials return to the login form', async () => {
  const failed = await login({ error: { message: 'Private auth diagnostic' } });
  assert.equal((await failed.POST(form({ email: 'ana@example.test', password: 'wrong-password' }))).headers.get('Location'), `${origin}/?authError=credentials`);
  const missing = await login();
  assert.equal((await missing.POST(form({ email: 'ana@example.test' }))).headers.get('Location'), `${origin}/?authError=credentials`);
  assert.deepEqual(missing.calls, []);
});

test('cross-origin and unconfigured logins never reach Auth', async () => {
  const crossOrigin = await login();
  assert.equal((await crossOrigin.POST(form({ email: 'a@b.co', password: 'long-password' }, 'https://other.example.test'))).status, 403);
  const unconfigured = await login({ configured: false });
  assert.equal((await unconfigured.POST(form({ email: 'a@b.co', password: 'long-password' }))).headers.get('Location'), `${origin}/?authError=configuration`);
  assert.deepEqual([...crossOrigin.calls, ...unconfigured.calls], []);
});

test('no Google OAuth flow remains', () => {
  assert.doesNotMatch(source, /OAuth|google/i);
});
