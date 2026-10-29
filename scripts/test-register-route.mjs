import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';
import * as passwordPolicy from '../src/lib/password-policy.js';
import * as siteOrigin from '../src/lib/server/site-origin.js';

const origin = 'https://app.example.test';
const registerSource = await readFile(new URL('../src/app/auth/register/route.js', import.meta.url), 'utf8');
const callbackSource = await readFile(new URL('../src/app/auth/callback/route.js', import.meta.url), 'utf8');

async function load(source, dependencies) {
  const module = new SourceTextModule(source);
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

const nextServer = {
  NextResponse: {
    json: (body, init) => new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'Content-Type': 'application/json', ...init?.headers } }),
    redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }),
  },
};

async function register({ signUpError = null, turnstileOk = true, configured = true } = {}) {
  process.env.TURNSTILE_SECRET_KEY = configured ? 'turnstile-secret' : '';
  const signUps = [];
  const verifications = [];
  const { POST } = await load(registerSource, {
    'next/server': nextServer,
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => true,
      createAuthClient: async () => ({ auth: { signUp: async (payload) => { signUps.push(payload); return { data: {}, error: signUpError }; } } }),
    },
    '../../../lib/server/site-origin': siteOrigin,
    '../../../lib/password-policy': passwordPolicy,
    '../../../lib/server/turnstile': {
      hasTurnstileConfiguration: () => Boolean(process.env.TURNSTILE_SECRET_KEY),
      verifyTurnstile: async (token, ip) => { verifications.push([token, ip]); return turnstileOk; },
    },
  });
  return { POST, signUps, verifications };
}

function form(overrides = {}, requestOrigin = origin) {
  const fields = { name: ' Ana ', email: ' Ana@Example.TEST ', password: 'long-password', 'cf-turnstile-response': 'token', ...overrides };
  return new Request(`${origin}/auth/register`, { method: 'POST', headers: { origin: requestOrigin, 'x-real-ip': '203.0.113.7' }, body: new URLSearchParams(fields) });
}

test('a valid sign-up calls signUp once with the normalized email and the confirmation redirect', async () => {
  const { POST, signUps, verifications } = await register();
  const response = await POST(form());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(verifications, [['token', '203.0.113.7']]);
  assert.equal(signUps.length, 1);
  const [{ email, password, options }] = signUps;
  assert.equal(email, 'ana@example.test');
  assert.equal(password, 'long-password');
  assert.equal(options.emailRedirectTo, `${origin}/auth/callback`);
  assert.equal(options.data.full_name, 'Ana');
  assert.deepEqual(options.data, { full_name: 'Ana' });
});

test('the confirmation link targets the public site, not the deployment that served the form', async () => {
  const saved = [process.env.SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL];
  try {
    delete process.env.SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.example.test';
    const viaVercel = await register();
    await viaVercel.POST(new Request('https://deployment-abc.vercel.app/auth/register', { method: 'POST', headers: { origin: 'https://deployment-abc.vercel.app' }, body: new URLSearchParams({ name: 'Ana', email: 'ana@example.test', password: 'long-password', 'cf-turnstile-response': 't' }) }));
    assert.equal(viaVercel.signUps[0].options.emailRedirectTo, 'https://app.example.test/auth/callback');
    process.env.SITE_URL = 'https://custom.example.test/ignored/path';
    const explicit = await register();
    await explicit.POST(form());
    assert.equal(explicit.signUps[0].options.emailRedirectTo, 'https://custom.example.test/auth/callback');
  } finally {
    for (const [name, value] of [['SITE_URL', saved[0]], ['VERCEL_PROJECT_PRODUCTION_URL', saved[1]]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('a failed Turnstile check never reaches Auth', async () => {
  const { POST, signUps } = await register({ turnstileOk: false });
  const response = await POST(form());
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'captcha_failed' });
  assert.deepEqual(signUps, []);
});

test('cross-origin and missing-origin requests are rejected before any work', async () => {
  const { POST, signUps, verifications } = await register();
  assert.equal((await POST(form({}, 'https://other.example.test'))).status, 403);
  const noOrigin = new Request(`${origin}/auth/register`, { method: 'POST', body: new URLSearchParams({ name: 'Ana' }) });
  assert.equal((await POST(noOrigin)).status, 403);
  assert.deepEqual([signUps, verifications], [[], []]);
});

test('an already registered email gets the same response as a new one', async () => {
  const fresh = await (await (await register()).POST(form())).json();
  for (const code of ['user_already_exists', 'email_exists']) {
    const existing = await register({ signUpError: { code, status: 422 } });
    const response = await existing.POST(form());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), fresh);
  }
});

test('invalid inputs are rejected without verifying the CAPTCHA', async () => {
  const cases = [
    [{ name: '' }, 'invalid_name'], [{ name: 'x'.repeat(81) }, 'invalid_name'],
    [{ email: 'not-an-email' }, 'invalid_email'], [{ password: 'short' }, 'invalid_password'], [{ password: 'x'.repeat(73) }, 'invalid_password'],
  ];
  for (const [overrides, error] of cases) {
    const { POST, signUps, verifications } = await register();
    const response = await POST(form(overrides));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error });
    assert.deepEqual([signUps, verifications], [[], []]);
  }
});

test('Auth rate limits and other failures surface generic errors', async () => {
  const limited = await register({ signUpError: { code: 'over_email_send_rate_limit', status: 429 } });
  const response = await limited.POST(form());
  assert.deepEqual([response.status, (await response.json()).error], [429, 'rate_limited']);
  const broken = await register({ signUpError: { message: 'Private Auth diagnostic', status: 500 } });
  const failed = await broken.POST(form());
  assert.deepEqual(await failed.json(), { ok: false, error: 'unknown' });
});

test('registration stays closed when Turnstile is not configured', async () => {
  const { POST, signUps } = await register({ configured: false });
  const response = await POST(form());
  assert.equal(response.status, 503);
  assert.deepEqual(signUps, []);
});

async function callback(auth = {}) {
  const calls = [];
  const { GET } = await load(callbackSource, {
    'next/server': nextServer,
    '../../../lib/server/auth': {
      hasAuthConfiguration: () => true,
      createAuthClient: async () => ({ auth: {
        verifyOtp: async (payload) => { calls.push(['verifyOtp', payload]); return { error: auth.error ?? null }; },
        exchangeCodeForSession: async (code) => { calls.push(['exchange', code]); return { error: auth.error ?? null }; },
      } }),
    },
  });
  return { GET, calls };
}

const link = (query) => new Request(`${origin}/auth/callback?${query}`);

test('a valid confirmation link signs the user in and opens the app', async () => {
  const { GET, calls } = await callback();
  const response = await GET(link('token_hash=abc&type=signup'));
  assert.equal(response.headers.get('Location'), `${origin}/`);
  assert.deepEqual(calls, [['verifyOtp', { token_hash: 'abc', type: 'signup' }]]);
  const pkce = await callback();
  assert.equal((await pkce.GET(link('code=xyz'))).headers.get('Location'), `${origin}/`);
  assert.deepEqual(pkce.calls, [['exchange', 'xyz']]);
});

test('expired and invalid links show clear messages', async () => {
  const expired = await callback({ error: { code: 'otp_expired' } });
  assert.equal((await expired.GET(link('token_hash=abc&type=signup'))).headers.get('Location'), `${origin}/?authError=link_expired`);
  const invalid = await callback({ error: { code: 'validation_failed' } });
  assert.equal((await invalid.GET(link('token_hash=abc&type=signup'))).headers.get('Location'), `${origin}/?authError=link_invalid`);
  const bounced = await callback();
  assert.equal((await bounced.GET(link('error=access_denied&error_code=otp_expired'))).headers.get('Location'), `${origin}/?authError=link_expired`);
  assert.equal((await bounced.GET(link(''))).headers.get('Location'), `${origin}/?authError=link_invalid`);
  assert.deepEqual(bounced.calls, []);
});

test('only confirmation link types can sign someone in', async () => {
  const { GET, calls } = await callback();
  for (const type of ['recovery', 'magiclink', 'invite']) {
    assert.equal((await GET(link(`token_hash=abc&type=${type}`))).headers.get('Location'), `${origin}/?authError=link_invalid`);
  }
  assert.deepEqual(calls, []);
});
