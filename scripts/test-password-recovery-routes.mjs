import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';
import * as passwordPolicy from '../src/lib/password-policy.js';
import * as siteOrigin from '../src/lib/server/site-origin.js';

const origin = 'https://app.example.test';
const forgotSource = await readFile(new URL('../src/app/auth/forgot-password/route.js', import.meta.url), 'utf8');
const resetSource = await readFile(new URL('../src/app/auth/reset-password/route.js', import.meta.url), 'utf8');

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
  NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) },
};

function post(path, fields, { requestOrigin = origin, ip = '203.0.113.7' } = {}) {
  const headers = { 'x-real-ip': ip };
  if (requestOrigin) headers.origin = requestOrigin;
  return new Request(`${origin}${path}`, { method: 'POST', headers, body: new URLSearchParams(fields) });
}

const location = (response) => new URL(response.headers.get('Location')).pathname + new URL(response.headers.get('Location')).search;

// Silences the route's operational logs while keeping them observable.
async function quietly(work) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try { return { result: await work(), logged }; } finally { console.error = original; }
}

async function forgot({ resetError = null, limited = false, limiterFails = false } = {}) {
  const resets = [];
  const limiterCalls = [];
  const { POST } = await load(forgotSource, {
    'next/server': nextServer,
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => true,
      createAuthClient: async () => ({ auth: { resetPasswordForEmail: async (email, options) => { resets.push({ email, options }); return { data: {}, error: resetError }; } } }),
    },
    '../../../lib/server/rate-limit': {
      consumeRateLimits: async (limits) => { limiterCalls.push(limits); if (limiterFails) throw new Error('Private database failure'); return limited; },
    },
    '../../../lib/server/site-origin': siteOrigin,
  });
  return { POST, resets, limiterCalls };
}

test('a recovery request sends one email to the public reset page and answers generically', async () => {
  const saved = process.env.SITE_URL;
  process.env.SITE_URL = 'https://public.example.test';
  try {
    const { POST, resets, limiterCalls } = await forgot();
    const response = await POST(post('/auth/forgot-password', { email: ' Ana@Example.TEST ' }));
    assert.equal(response.status, 303);
    assert.equal(location(response), '/forgot-password?sent=1');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(resets, [{ email: 'ana@example.test', options: { redirectTo: 'https://public.example.test/reset-password' } }]);
    assert.deepEqual(limiterCalls[0].map(({ scope, subject, max }) => [scope, subject, max]), [
      ['recovery:email', 'ana@example.test', 3],
      ['recovery:ip', '203.0.113.7', 10],
    ]);
  } finally {
    if (saved === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = saved;
  }
});

test('Auth errors never reveal whether the account exists', async () => {
  for (const resetError of [null, { status: 429, code: 'over_email_send_rate_limit' }, { status: 500, code: 'unexpected_failure' }]) {
    const { POST } = await forgot({ resetError });
    const { result: response, logged } = await quietly(() => POST(post('/auth/forgot-password', { email: 'ana@example.test' })));
    assert.equal(location(response), '/forgot-password?sent=1');
    assert.ok(logged.every((line) => !line.includes('ana@example.test')));
  }
});

test('rate-limited, invalid and cross-origin requests never reach Auth', async () => {
  const limited = await forgot({ limited: true });
  assert.equal(location(await limited.POST(post('/auth/forgot-password', { email: 'ana@example.test' }))), '/forgot-password?error=rate_limited');
  assert.deepEqual(limited.resets, []);

  const broken = await forgot({ limiterFails: true });
  assert.equal(location(await broken.POST(post('/auth/forgot-password', { email: 'ana@example.test' }))), '/forgot-password?error=unavailable');
  assert.deepEqual(broken.resets, []);

  const invalid = await forgot();
  for (const email of ['', 'not-an-email', `${'a'.repeat(250)}@x.io`]) {
    assert.equal(location(await invalid.POST(post('/auth/forgot-password', { email }))), '/forgot-password?error=invalid_email');
  }
  assert.equal((await invalid.POST(post('/auth/forgot-password', { email: 'ana@example.test' }, { requestOrigin: 'https://other.example.test' }))).status, 403);
  assert.equal((await invalid.POST(post('/auth/forgot-password', { email: 'ana@example.test' }, { requestOrigin: null }))).status, 403);
  assert.deepEqual([invalid.resets, invalid.limiterCalls], [[], []]);
});

async function reset({ verifyError = null, updateError = null } = {}) {
  const calls = [];
  const { POST } = await load(resetSource, {
    'next/server': nextServer,
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => true,
      createAuthClient: async () => ({
        auth: {
          verifyOtp: async (params) => { calls.push(['verifyOtp', params]); return { data: {}, error: verifyError }; },
          updateUser: async (attributes) => { calls.push(['updateUser', attributes]); return { data: {}, error: updateError }; },
          signOut: async (options) => { calls.push(['signOut', options]); return { error: null }; },
        },
      }),
    },
    '../../../lib/password-policy': passwordPolicy,
  });
  return { POST, calls };
}

const resetForm = (overrides = {}) => ({ token_hash: 'pkce_abc', password: 'new-password', confirm: 'new-password', ...overrides });

test('a valid link sets the new password, keeps this session and ends the others', async () => {
  const { POST, calls } = await reset();
  const response = await POST(post('/auth/reset-password', resetForm()));
  assert.equal(response.status, 303);
  assert.equal(location(response), '/');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [
    ['verifyOtp', { token_hash: 'pkce_abc', type: 'recovery' }],
    ['updateUser', { password: 'new-password' }],
    ['signOut', { scope: 'others' }],
  ]);
});

test('password mistakes return to the form without spending the link', async () => {
  const { POST, calls } = await reset();
  const short = 'a'.repeat(passwordPolicy.MIN_PASSWORD_LENGTH - 1);
  const long = 'a'.repeat(passwordPolicy.MAX_PASSWORD_LENGTH + 1);
  for (const [fields, error] of [
    [{ password: short, confirm: short }, 'invalid_password'],
    [{ password: long, confirm: long }, 'invalid_password'],
    [{ confirm: 'different-password' }, 'mismatch'],
  ]) {
    assert.equal(location(await POST(post('/auth/reset-password', resetForm(fields)))), `/reset-password?token_hash=pkce_abc&type=recovery&error=${error}`);
  }
  assert.equal(location(await POST(post('/auth/reset-password', resetForm({ token_hash: '' })))), '/reset-password?error=link_invalid');
  assert.deepEqual(calls, []);
});

test('expired and used links show a clear message and change nothing', async () => {
  for (const [verifyError, error] of [[{ code: 'otp_expired', status: 403 }, 'link_expired'], [{ code: 'bad_jwt', status: 403 }, 'link_invalid']]) {
    const { POST, calls } = await reset({ verifyError });
    assert.equal(location(await POST(post('/auth/reset-password', resetForm()))), `/reset-password?error=${error}`);
    assert.deepEqual(calls.map(([name]) => name), ['verifyOtp']);
  }
});

test('a failed update signs out the recovery session; reusing the same password still signs in', async () => {
  const failed = await reset({ updateError: { code: 'weak_password', status: 422 } });
  assert.equal(location(await failed.POST(post('/auth/reset-password', resetForm()))), '/reset-password?error=update_failed');
  assert.deepEqual(failed.calls.at(-1), ['signOut', { scope: 'local' }]);

  const same = await reset({ updateError: { code: 'same_password', status: 422 } });
  assert.equal(location(await same.POST(post('/auth/reset-password', resetForm()))), '/');
  assert.deepEqual(same.calls.at(-1), ['signOut', { scope: 'others' }]);
});

test('cross-origin reset submissions are rejected before any work', async () => {
  const { POST, calls } = await reset();
  assert.equal((await POST(post('/auth/reset-password', resetForm(), { requestOrigin: 'https://other.example.test' }))).status, 403);
  assert.equal((await POST(post('/auth/reset-password', resetForm(), { requestOrigin: null }))).status, 403);
  assert.deepEqual(calls, []);
});
