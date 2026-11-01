import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/auth/login/route.js', import.meta.url), 'utf8');
const origin = 'https://app.example.test';

async function login({ error = null, configured = true, mode = 'app' } = {}) {
  const calls = [];
  const dependencies = {
    '../../../lib/server/turnstile': {
      captchaMode: () => mode,
      readCaptchaToken: (body) => String(body.get('cf-turnstile-response') ?? ''),
    },
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

test('app CAPTCHA mode signs in without a captcha token, even if the form sends one', async () => {
  const { POST, calls } = await login();
  await POST(form({ email: 'ana@example.test', password: 'long-password', 'cf-turnstile-response': 'token' }));
  assert.deepEqual(calls, [{ email: 'ana@example.test', password: 'long-password' }]);
});

test('provider CAPTCHA mode forwards the token and maps provider rejections', async () => {
  const { POST, calls } = await login({ mode: 'provider' });
  const response = await POST(form({ email: 'ana@example.test', password: 'long-password', 'cf-turnstile-response': 'token' }));
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.deepEqual(calls, [{ email: 'ana@example.test', password: 'long-password', options: { captchaToken: 'token' } }]);

  const missing = await login({ mode: 'provider' });
  assert.equal((await missing.POST(form({ email: 'ana@example.test', password: 'long-password' }))).headers.get('Location'), `${origin}/app?authError=captcha_failed`);
  assert.deepEqual(missing.calls, []);

  const rejected = await login({ mode: 'provider', error: { code: 'captcha_failed', message: 'Private diagnostic' } });
  assert.equal((await rejected.POST(form({ email: 'ana@example.test', password: 'long-password', 'cf-turnstile-response': 'used' }))).headers.get('Location'), `${origin}/app?authError=captcha_failed`);
});

test('the login form shows the Turnstile widget only when given a provider site key', async () => {
  const loginForm = await readFile(new URL('../src/app/login-form.jsx', import.meta.url), 'utf8');
  assert.match(loginForm, /\{captchaSiteKey && <TurnstileWidget/);
  const page = await readFile(new URL('../src/app/app/page.jsx', import.meta.url), 'utf8');
  assert.match(page, /captchaSiteKey=\{providerCaptchaSiteKey\(\)\}/);
});

test('no Google OAuth flow remains', () => {
  assert.doesNotMatch(source, /OAuth|google/i);
});
