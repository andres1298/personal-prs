import assert from 'node:assert/strict';
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

// Every Auth and profile call is recorded in order; `fail` names the step that returns an error.
async function confirmRoute({ sessionUser = null, fail = null, configured = true } = {}) {
  const calls = [];
  const result = (step, data = {}) => (fail === step ? { data: {}, error: { code: step === 'verifyOtp' ? 'otp_expired' : 'unexpected_failure', status: 400, message: 'Private Auth diagnostic' } } : { data, error: null });
  const auth = {
    getUser: async () => { calls.push(['getUser']); return sessionUser ? { data: { user: sessionUser }, error: null } : { data: { user: null }, error: { name: 'AuthSessionMissingError' } }; },
    verifyOtp: async (payload) => { calls.push(['verifyOtp', payload]); return result('verifyOtp', { user: confirmedUser, session: {} }); },
    updateUser: async (attributes) => { calls.push(['updateUser', attributes]); return result('updateUser', { user: confirmedUser }); },
    signOut: async (options) => { calls.push(['signOut', options]); return result(`signOut:${options?.scope}`); },
    exchangeCodeForSession: async (code) => { calls.push(['exchangeCodeForSession', code]); return result('exchange'); },
  };
  const dependencies = {
    'next/server': nextServer,
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
  return { ...module.namespace, calls };
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
  for (const type of ['signup', 'email']) {
    const { GET, calls } = await confirmRoute();
    const response = await GET(link(`token_hash=${tokenHash}&type=${type}`));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), confirmUrl({ token_hash: tokenHash, type }));
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(calls, []);
  }
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
    '', 'code=xyz', `token_hash=${tokenHash}`, `token_hash=${tokenHash}&type=recovery`, `token_hash=${tokenHash}&type=magiclink`,
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

test('confirming verifies the link, sets the password, revokes other sessions, then creates the profile', async () => {
  const { POST, calls } = await confirmRoute();
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
    ['ensureMemberProfile', confirmedUser.id],
  ]);
  assert.ok(!calls.some(([name]) => name === 'exchangeCodeForSession'));
});

test('cross-origin and missing-origin submissions are rejected before any work', async () => {
  const { POST, calls } = await confirmRoute();
  for (const requestOrigin of ['https://other.example.test', 'null', null]) assert.equal((await POST(submit(valid, requestOrigin))).status, 403);
  assert.deepEqual(calls, []);
});

test('invalid links, passwords and mismatches return to the page before Auth is contacted', async () => {
  const cases = [
    [{ ...valid, type: 'recovery' }, confirmUrl({ notice: 'link_invalid' })],
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
  assert.deepEqual(names(agreed.calls), ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'ensureMemberProfile']);
});

test('a spent or expired link creates no session work and no profile', async () => {
  const { POST, calls } = await confirmRoute({ fail: 'verifyOtp' });
  const response = await POST(submit(valid));
  assert.equal(response.headers.get('Location'), confirmUrl({ notice: 'link_expired' }));
  assert.deepEqual(names(calls), ['createAuthClient', 'getUser', 'verifyOtp']);
});

test('no profile is created when any step after verification fails, and the half-made session is dropped', async () => {
  const expectations = {
    updateUser: ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:local'],
    'signOut:others': ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'signOut:local'],
    ensureMemberProfile: ['createAuthClient', 'getUser', 'verifyOtp', 'updateUser', 'signOut:others', 'ensureMemberProfile', 'signOut:local'],
  };
  for (const [step, expected] of Object.entries(expectations)) {
    const { POST, calls } = await confirmRoute({ fail: step });
    const response = await POST(submit(valid));
    const location = response.headers.get('Location');
    assert.equal(location, confirmUrl({ notice: 'incomplete' }), step);
    assert.doesNotMatch(location, /Private|diagnostic/i);
    assert.deepEqual(names(calls), expected, step);
    if (step !== 'ensureMemberProfile') assert.ok(!calls.some(([name]) => name === 'ensureMemberProfile'), step);
  }
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
  for (const text of ['Contraseña', 'Repite la contraseña', 'Continuar', 'Hay una sesión abierta como', 'name="replace_session" value="1"']) {
    assert.ok(pageSource.includes(text), `missing ${text}`);
  }
});
