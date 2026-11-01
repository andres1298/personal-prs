import assert from 'node:assert/strict';
import * as nodeCrypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const origin = 'https://app.example.test';
const source = await readFile(new URL('../src/app/auth/callback/route.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/app/auth/confirm/page.jsx', import.meta.url), 'utf8');
const tokenHash = 'a'.repeat(56);
const confirmedUser = { id: '22222222-2222-4222-8222-222222222222', email: 'ana@example.test', email_confirmed_at: '2026-11-01T10:00:00Z', user_metadata: { full_name: 'Ana' } };

const nextServer = {
  NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }) },
};

process.env.SUPABASE_SECRET_KEY = 'test-only-server-secret';
const retrySource = await readFile(new URL('../src/lib/server/signup-retry.js', import.meta.url), 'utf8');
const retryModule = new SourceTextModule(retrySource);
await retryModule.link((specifier) => {
  if (specifier === 'server-only') return new SyntheticModule([], () => {});
  if (specifier !== 'node:crypto') throw new Error(`Unexpected dependency: ${specifier}`);
  return new SyntheticModule(Object.keys(nodeCrypto), function () {
    for (const [name, value] of Object.entries(nodeCrypto)) this.setExport(name, value);
  });
});
await retryModule.evaluate();
const signupRetry = retryModule.namespace;
const { PASSWORD_RETRY_COOKIE, createPasswordRetry } = signupRetry;

// A cookie store like next/headers' one: reads the incoming cookies and records what the route sets.
function cookieJar(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    get: (name) => (values.has(name) ? { name, value: values.get(name) } : undefined),
    set: (name, value, options) => { writes.push([name, value, options]); values.set(name, value); },
  };
}

// Every Auth and profile call is recorded in order. `fail` names the step that returns a default error and
// `errors` gives a step its exact error. The second updateUser (`updateUser:check`) answers `same_password`
// unless told otherwise, as Supabase does when the password is unchanged.
async function confirmRoute({ sessionUser = null, fail = null, errors = {}, configured = true, cookies = {} } = {}) {
  const calls = [];
  const jar = cookieJar(cookies);
  const defaults = { 'updateUser:check': { code: 'same_password', status: 422, message: 'Private Auth diagnostic' } };
  const errorFor = (step) => {
    if (step in errors) return errors[step];
    if (fail === step) return { code: step === 'verifyOtp' ? 'otp_expired' : 'unexpected_failure', status: 400, message: 'Private Auth diagnostic' };
    return defaults[step] ?? null;
  };
  const result = (step, data = {}) => {
    const error = errorFor(step);
    return error ? { data: {}, error } : { data, error: null };
  };
  let passwordUpdates = 0;
  const auth = {
    getUser: async () => { calls.push(['getUser']); return sessionUser ? { data: { user: sessionUser }, error: null } : { data: { user: null }, error: { name: 'AuthSessionMissingError' } }; },
    verifyOtp: async (payload) => { calls.push(['verifyOtp', payload]); return result('verifyOtp', { user: confirmedUser, session: {} }); },
    updateUser: async (attributes) => {
      calls.push(['updateUser', attributes]);
      passwordUpdates += 1;
      return result(passwordUpdates === 1 ? 'updateUser' : 'updateUser:check', { user: confirmedUser });
    },
    signOut: async (options) => { calls.push(['signOut', options]); return result(`signOut:${options?.scope}`); },
    exchangeCodeForSession: async (code) => { calls.push(['exchangeCodeForSession', code]); return result('exchange'); },
  };
  const dependencies = {
    'next/server': nextServer,
    'next/headers': { cookies: async () => jar },
    '../../../lib/server/auth': {
      hasSameOrigin,
      hasAuthConfiguration: () => configured,
      createAuthClient: async () => { calls.push(['createAuthClient']); return { auth }; },
    },
    '../../../lib/server/records': {
      ensureMemberProfile: async (user) => {
        calls.push(['ensureMemberProfile', user.id]);
        if (fail === 'ensureMemberProfile') throw new Error('Private database failure');
      },
    },
    '../../../lib/server/signup-retry': signupRetry,
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
  return { ...module.namespace, calls, cookieWrites: jar.writes };
}

const link = (query) => new Request(`${origin}/auth/callback?${query}`);
const confirmUrl = (query) => `${origin}/auth/confirm?${new URLSearchParams(query)}`;
const valid = { token_hash: tokenHash, type: 'signup', password: 'chosen-password', confirm: 'chosen-password' };

function submit(fields, requestOrigin = origin) {
  const headers = requestOrigin == null ? {} : { origin: requestOrigin };
  return new Request(`${origin}/auth/callback`, { method: 'POST', headers, body: new URLSearchParams(fields) });
}

const names = (calls) => calls.map(([name, argument]) => (name === 'signOut' ? `signOut:${argument.scope}` : name));

test('opening the email link makes no Auth calls and forwards the token to the confirmation page', async () => {
  const { GET, calls } = await confirmRoute();
  const response = await GET(link(`token_hash=${tokenHash}&type=signup`));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), confirmUrl({ token_hash: tokenHash, type: 'signup' }));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, []);
});

test('the email link accepts pkce-prefixed token hashes', async () => {
  const { GET, calls } = await confirmRoute();
  const response = await GET(link(`token_hash=pkce_${tokenHash}&type=signup`));
  assert.equal(response.headers.get('Location'), confirmUrl({ token_hash: `pkce_${tokenHash}`, type: 'signup' }));
  assert.deepEqual(calls, []);
});

test('malformed, foreign-type and code-only links are invalid without touching Auth', async () => {
  const { GET, calls } = await confirmRoute();
  const invalid = confirmUrl({ notice: 'link_invalid' });
  const queries = [
    '', 'code=xyz', `token_hash=${tokenHash}`, `token_hash=${tokenHash}&type=recovery`, `token_hash=${tokenHash}&type=magiclink`, `token_hash=${tokenHash}&type=email`,
    `token_hash=${tokenHash}&type=invite`, 'token_hash=short&type=signup', `token_hash=${encodeURIComponent('abc"><script>x</script>'.repeat(3))}&type=signup`,
    `token_hash=${'a'.repeat(257)}&type=signup`,
  ];
  for (const query of queries) assert.equal((await GET(link(query))).headers.get('Location'), invalid, query);
  assert.deepEqual(calls, []);
});

test('provider-reported link errors show the matching notice', async () => {
  const { GET, calls } = await confirmRoute();
  assert.equal((await GET(link('error=access_denied&error_code=otp_expired'))).headers.get('Location'), confirmUrl({ notice: 'link_expired' }));
  assert.equal((await GET(link('error=server_error'))).headers.get('Location'), confirmUrl({ notice: 'link_invalid' }));
  assert.deepEqual(calls, []);
});

test('confirming verifies the link, sets the password, revokes other sessions, re-checks the password, then creates the profile', async () => {
  const { POST, calls, cookieWrites } = await confirmRoute();
  const response = await POST(submit(valid));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [
    ['createAuthClient'],
    ['getUser'],
    ['verifyOtp', { token_hash: tokenHash, type: 'signup' }],
    ['updateUser', { password: 'chosen-password' }],
    ['signOut', { scope: 'others' }],
    ['updateUser', { password: 'chosen-password' }],
    ['ensureMemberProfile', confirmedUser.id],
  ]);
  assert.ok(!calls.some(([name]) => name === 'exchangeCodeForSession'));
  assert.deepEqual(cookieWrites, []);
});

test('cross-origin and missing-origin submissions are rejected before any work', async () => {
  const { POST, calls } = await confirmRoute();
  for (const requestOrigin of ['https://other.example.test', 'null', null]) assert.equal((await POST(submit(valid, requestOrigin))).status, 403);
  assert.deepEqual(calls, []);
});

test('invalid links, passwords and mismatches return to the page before Auth is contacted', async () => {
  const cases = [
    [{ ...valid, type: 'recovery' }, confirmUrl({ notice: 'link_invalid' })],
    [{ ...valid, type: 'email' }, confirmUrl({ notice: 'link_invalid' })],
    // 37 characters but 74 bytes in UTF-8: Supabase would reject it after the link is spent.
    [{ ...valid, password: 'ñ'.repeat(37), confirm: 'ñ'.repeat(37) }, confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'invalid_password' })],
    [{ ...valid, token_hash: 'bad hash' }, confirmUrl({ notice: 'link_invalid' })],
    [{ ...valid, password: 'short', confirm: 'short' }, confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'invalid_password' })],
    [{ ...valid, password: 'x'.repeat(73), confirm: 'x'.repeat(73) }, confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'invalid_password' })],
    [{ ...valid, confirm: 'other-password' }, confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'mismatch' })],
  ];
  for (const [fields, location] of cases) {
    const { POST, calls } = await confirmRoute();
    const response = await POST(submit(fields));
    assert.equal(response.headers.get('Location'), location);
    assert.deepEqual(calls, []);
  }
});

test('an open session blocks confirmation until the person explicitly agrees to replace it', async () => {
  const otherAccount = { id: '33333333-3333-4333-8333-333333333333', email: 'other@example.test' };
  const blocked = await confirmRoute({ sessionUser: otherAccount });
  const response = await blocked.POST(submit(valid));
  assert.equal(response.headers.get('Location'), confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'session_open' }));
  assert.deepEqual(names(blocked.calls), ['createAuthClient', 'getUser']);
  const wrongValue = await confirmRoute({ sessionUser: otherAccount });
  await wrongValue.POST(submit({ ...valid, replace_session: 'yes' }));
  assert.deepEqual(names(wrongValue.calls), ['createAuthClient', 'getUser']);

  const agreed = await confirmRoute({ sessionUser: otherAccount });
  const accepted = await agreed.POST(submit({ ...valid, replace_session: '1' }));
  assert.equal(accepted.headers.get('Location'), `${origin}/app`);
  assert.deepEqual(names(agreed.calls), ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'updateUser', 'ensureMemberProfile']);
});

test('a spent or expired link creates no session work and no profile', async () => {
  const { POST, calls } = await confirmRoute({ fail: 'verifyOtp' });
  const response = await POST(submit(valid));
  assert.equal(response.headers.get('Location'), confirmUrl({ notice: 'link_expired' }));
  assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp']);
});

test('a non-recoverable failure after verification creates no profile and drops the half-made session', async () => {
  const expectations = {
    updateUser: ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:local'],
    'signOut:others': ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'signOut:local'],
    'updateUser:check': ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'updateUser', 'signOut:local'],
  };
  for (const [step, expected] of Object.entries(expectations)) {
    const { POST, calls, cookieWrites } = await confirmRoute({ fail: step });
    const response = await POST(submit(valid));
    const location = response.headers.get('Location');
    assert.equal(location, confirmUrl({ notice: 'incomplete' }), step);
    assert.doesNotMatch(location, /Private|diagnostic/i);
    assert.deepEqual(names(calls), expected, step);
    assert.ok(!calls.some(([name]) => name === 'ensureMemberProfile'), step);
    assert.deepEqual(cookieWrites, [], step);
  }
});

test('a password changed by another session before the revocation fails closed and revokes every session', async () => {
  // The re-check succeeding means the password was no longer the chosen one.
  const { POST, calls } = await confirmRoute({ errors: { 'updateUser:check': null } });
  const response = await POST(submit(valid));
  assert.equal(response.headers.get('Location'), confirmUrl({ notice: 'incomplete' }));
  assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'updateUser', 'signOut:global']);
});

function retryCookie(cookieWrites) {
  const writes = cookieWrites.filter(([name]) => name === PASSWORD_RETRY_COOKIE);
  return writes.at(-1);
}

test('a password the provider rejects keeps the verified session and asks for another one', async () => {
  for (const code of ['weak_password', 'validation_failed']) {
    const { POST, calls, cookieWrites } = await confirmRoute({ errors: { updateUser: { code, status: 422, message: 'Private Auth diagnostic' } } });
    const response = await POST(submit(valid));
    assert.equal(response.headers.get('Location'), confirmUrl({ step: 'password', notice: 'weak_password' }), code);
    assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser'], code);
    const [, value, options] = retryCookie(cookieWrites);
    assert.equal(signupRetry.readPasswordRetry(value), confirmedUser.id);
    assert.deepEqual(options, { httpOnly: true, sameSite: 'strict', secure: true, path: '/auth', maxAge: 30 * 60 });
  }
});

test('transient failures after verification also keep the session for another attempt', async () => {
  const cases = [
    [{ errors: { updateUser: { name: 'AuthRetryableFetchError', status: 0 } } }, 'unavailable', ['updateUser']],
    [{ errors: { updateUser: { code: 'over_request_rate_limit', status: 429 } } }, 'rate_limited', ['updateUser']],
    [{ errors: { 'signOut:others': { status: 503 } } }, 'unavailable', ['updateUser', 'signOut:others']],
    [{ fail: 'ensureMemberProfile' }, 'unavailable', ['updateUser', 'signOut:others', 'updateUser', 'ensureMemberProfile']],
  ];
  for (const [options, notice, steps] of cases) {
    const { POST, calls, cookieWrites } = await confirmRoute(options);
    const response = await POST(submit(valid));
    assert.equal(response.headers.get('Location'), confirmUrl({ step: 'password', notice }), notice);
    assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp', ...steps]);
    assert.ok(retryCookie(cookieWrites));
  }
});

test('without the server secret a rejected password cannot be retried and fails closed', async () => {
  const secret = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    const { POST, calls, cookieWrites } = await confirmRoute({ errors: { updateUser: { code: 'weak_password', status: 422 } } });
    const response = await POST(submit(valid));
    assert.equal(response.headers.get('Location'), confirmUrl({ notice: 'incomplete' }));
    assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:local']);
    assert.deepEqual(cookieWrites, []);
  } finally {
    process.env.SUPABASE_SECRET_KEY = secret;
  }
});

const retryFields = { step: 'password', password: 'better-password', confirm: 'better-password' };

test('the retry step finishes activation with the verified session and its signed marker', async () => {
  const marker = createPasswordRetry(confirmedUser.id);
  const { POST, calls, cookieWrites } = await confirmRoute({ sessionUser: confirmedUser, cookies: { [PASSWORD_RETRY_COOKIE]: marker } });
  const response = await POST(submit(retryFields));
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.deepEqual(calls, [
    ['createAuthClient'],
    ['getUser'],
    ['updateUser', { password: 'better-password' }],
    ['signOut', { scope: 'others' }],
    ['updateUser', { password: 'better-password' }],
    ['ensureMemberProfile', confirmedUser.id],
  ]);
  const [, value, options] = retryCookie(cookieWrites);
  assert.equal(value, '');
  assert.equal(options.maxAge, 0);
});

test('a retry with the password already set (an earlier step failed later) still finishes', async () => {
  const marker = createPasswordRetry(confirmedUser.id);
  const { POST, calls } = await confirmRoute({
    sessionUser: confirmedUser,
    cookies: { [PASSWORD_RETRY_COOKIE]: marker },
    errors: { updateUser: { code: 'same_password', status: 422 } },
  });
  const response = await POST(submit(retryFields));
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'updateUser', 'signOut:others', 'updateUser', 'ensureMemberProfile']);
});

test('a retry without a valid marker for the signed-in account never touches the password', async () => {
  const otherAccount = { id: '33333333-3333-4333-8333-333333333333', email: 'other@example.test' };
  const marker = createPasswordRetry(confirmedUser.id);
  const [userId, expiresAt] = marker.split('.');
  const cases = [
    [{ sessionUser: confirmedUser }, 'no marker'],
    [{ sessionUser: confirmedUser, cookies: { [PASSWORD_RETRY_COOKIE]: `${userId}.${expiresAt}.forged` } }, 'forged'],
    [{ sessionUser: confirmedUser, cookies: { [PASSWORD_RETRY_COOKIE]: createPasswordRetry(confirmedUser.id, Date.now() - 31 * 60 * 1000) } }, 'expired'],
    [{ sessionUser: otherAccount, cookies: { [PASSWORD_RETRY_COOKIE]: marker } }, 'other account'],
    [{ cookies: { [PASSWORD_RETRY_COOKIE]: marker } }, 'no session'],
  ];
  for (const [options, label] of cases) {
    const { POST, calls } = await confirmRoute(options);
    const response = await POST(submit(retryFields));
    assert.equal(response.headers.get('Location'), confirmUrl({ notice: 'incomplete' }), label);
    assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'signOut:local'], label);
  }
});

test('retry passwords are validated before Auth is contacted', async () => {
  const marker = createPasswordRetry(confirmedUser.id);
  const { POST, calls } = await confirmRoute({ sessionUser: confirmedUser, cookies: { [PASSWORD_RETRY_COOKIE]: marker } });
  const response = await POST(submit({ ...retryFields, confirm: 'other-password' }));
  assert.equal(response.headers.get('Location'), confirmUrl({ step: 'password', notice: 'mismatch' }));
  assert.deepEqual(calls, []);
});

test('a provider outage while verifying keeps the link and the form', async () => {
  for (const error of [{ name: 'AuthRetryableFetchError', status: 0 }, { name: 'AuthUnknownError' }, { code: 'unexpected_failure', status: 503 }]) {
    const { POST, calls } = await confirmRoute({ errors: { verifyOtp: error } });
    const response = await POST(submit(valid));
    assert.equal(response.headers.get('Location'), confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'unavailable' }));
    assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp']);
  }
  const rejected = await confirmRoute({ errors: { verifyOtp: { code: 'bad_jwt', status: 403 } } });
  assert.equal((await rejected.POST(submit(valid))).headers.get('Location'), confirmUrl({ notice: 'link_invalid' }));
  const limited = await confirmRoute({ errors: { verifyOtp: { code: 'over_request_rate_limit', status: 429 } } });
  assert.equal((await limited.POST(submit(valid))).headers.get('Location'), confirmUrl({ token_hash: tokenHash, type: 'signup', notice: 'rate_limited' }));
});

test('a 72-byte multibyte password is accepted', async () => {
  const password = 'ñ'.repeat(36);
  const { POST, calls } = await confirmRoute();
  const response = await POST(submit({ ...valid, password, confirm: password }));
  assert.equal(response.headers.get('Location'), `${origin}/app`);
  assert.deepEqual(calls[3], ['updateUser', { password }]);
});

test('an unconfigured deployment never reaches Auth', async () => {
  const { GET, POST, calls } = await confirmRoute({ configured: false });
  assert.equal((await GET(link(`token_hash=${tokenHash}&type=signup`))).headers.get('Location'), `${origin}/app?authError=configuration`);
  assert.equal((await POST(submit(valid))).headers.get('Location'), `${origin}/app?authError=configuration`);
  assert.deepEqual(calls, []);
});

test('the confirmation page keeps the token private, loads no third-party scripts and asks for an explicit action', () => {
  const policy = pageSource.match(/referrer:\s*'([^']+)'/)?.[1];
  assert.equal(policy, 'same-origin');
  assert.doesNotMatch(pageSource, /<script|next\/script|Turnstile|https?:\/\//i);
  assert.match(pageSource, /action="\/auth\/callback" method="post"/);
  for (const text of ['Contraseña', 'Repite la contraseña', 'Continuar', 'Hay una sesión abierta como', 'name="replace_session" value="1"', 'name="step"']) {
    assert.ok(pageSource.includes(text), `missing ${text}`);
  }
});
