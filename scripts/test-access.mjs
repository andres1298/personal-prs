import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin, isAdminUser } from '../src/lib/server/access-policy.js';
import { createSignupProof } from '../src/lib/server/signup-proof.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

test('access stays closed without a verified user or explicit authorization', () => {
  assert.equal(isAdminUser(null, ownerId), false);
  assert.equal(isAdminUser({ id: ownerId }), false);
  assert.equal(isAdminUser({ id: otherId }, ownerId), false);
  assert.equal(isAdminUser({ id: ownerId, is_anonymous: true }, ownerId), false);
});

test('editable metadata cannot grant access and revocation takes effect immediately', () => {
  const user = { id: otherId, user_metadata: { authorized: true, role: 'admin', id: ownerId } };
  assert.equal(isAdminUser(user, ownerId), false);
  assert.equal(isAdminUser({ id: ownerId }, ` ${ownerId}, ${otherId} `), true);
  assert.equal(isAdminUser({ id: ownerId }, otherId), false);
});

test('mutations reject cross-origin requests and missing origins', () => {
  const request = (origin) => new Request('https://app.example.test/api/records', {
    method: 'POST', headers: origin == null ? {} : { origin },
  });
  assert.equal(hasSameOrigin(request('https://app.example.test')), true);
  for (const origin of [null, 'null', 'https://other.example.test', 'https://app.example.test.attacker.test', 'http://app.example.test']) {
    assert.equal(hasSameOrigin(request(origin)), false);
  }
});

async function accessFor(user, { admins = '', profile = null, gymCode = '' } = {}) {
  const calls = [];
  const source = await readFile(new URL('../src/lib/server/auth.js', import.meta.url), 'utf8');
  const dependencies = {
    'server-only': {},
    'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    './access-policy.js': await import('../src/lib/server/access-policy.js'),
    './signup-proof.js': await import('../src/lib/server/signup-proof.js'),
    './records.js': {
      findProfile: async (id) => { calls.push(['find', id]); return profile; },
      ensureMemberProfile: async (memberUser) => { calls.push(['ensureMember', memberUser.id]); profile = { id: memberUser.id, disabledAt: null }; },
      ensureAdminProfile: async (adminUser) => { calls.push(['ensureAdmin', adminUser.id]); },
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
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable', SUPABASE_ADMIN_USER_IDS: admins, GYM_SIGNUP_CODE: gymCode });
  return { access: await module.namespace.getAccess(), calls };
}

test('admins are authorized and get a profile created lazily', async () => {
  const { access, calls } = await accessFor({ id: ownerId }, { admins: ownerId });
  assert.deepEqual([access.authorized, access.isAdmin], [true, true]);
  assert.deepEqual(calls, [['ensureAdmin', ownerId]]);
});

test('members need an invited profile and are never admins', async () => {
  const member = await accessFor({ id: otherId }, { admins: ownerId, profile: { id: otherId } });
  assert.deepEqual([member.access.authorized, member.access.isAdmin], [true, false]);
  const stranger = await accessFor({ id: otherId }, { admins: ownerId });
  assert.deepEqual([stranger.access.authorized, stranger.access.isAdmin], [false, false]);
  assert.deepEqual(stranger.calls, [['find', otherId]]);
  const anonymous = await accessFor({ id: otherId, is_anonymous: true }, { profile: { id: otherId } });
  assert.equal(anonymous.access.authorized, false);
});

test('a disabled profile loses access while keeping its session', async () => {
  const disabled = await accessFor({ id: otherId }, { admins: ownerId, profile: { id: otherId, disabledAt: new Date() } });
  assert.equal(disabled.access.user.id, otherId);
  assert.deepEqual([disabled.access.authorized, disabled.access.isAdmin], [false, false]);
  const enabled = await accessFor({ id: otherId }, { admins: ownerId, profile: { id: otherId, disabledAt: null } });
  assert.equal(enabled.access.authorized, true);
});

const gymCode = 'Gym-Code-2026';
const memberEmail = 'ana@example.test';

function signedUp(overrides = {}) {
  return {
    id: otherId,
    email: memberEmail,
    email_confirmed_at: '2026-10-20T10:00:00Z',
    user_metadata: { gym_signup_proof: createSignupProof(memberEmail, gymCode) },
    ...overrides,
  };
}

test('a confirmed gym sign-up gets a profile on first access', async () => {
  const { access, calls } = await accessFor(signedUp(), { gymCode });
  assert.deepEqual([access.authorized, access.isAdmin], [true, false]);
  assert.deepEqual(calls, [['find', otherId], ['ensureMember', otherId], ['find', otherId]]);
});

test('no profile is created before the email is confirmed', async () => {
  const { access, calls } = await accessFor(signedUp({ email_confirmed_at: null }), { gymCode });
  assert.equal(access.authorized, false);
  assert.deepEqual(calls, [['find', otherId]]);
});

test('a direct Supabase sign-up without a valid proof never gets access', async () => {
  const forged = [
    {},
    { gym_signup_proof: 'forged' },
    { gym_signup_proof: createSignupProof('other@example.test', gymCode) },
    { gym_signup_proof: createSignupProof(memberEmail, 'Another-Code') },
  ];
  for (const user_metadata of forged) {
    const { access, calls } = await accessFor(signedUp({ user_metadata }), { gymCode });
    assert.equal(access.authorized, false);
    assert.equal(calls.some(([name]) => name === 'ensureMember'), false);
  }
});

test('rotating the code, an unset code and anonymous users close the gym sign-up path', async () => {
  assert.equal((await accessFor(signedUp(), { gymCode: 'Rotated-Code' })).access.authorized, false);
  assert.equal((await accessFor(signedUp(), { gymCode: '' })).access.authorized, false);
  assert.equal((await accessFor(signedUp({ is_anonymous: true }), { gymCode })).access.authorized, false);
});

test('a disabled member is not re-enabled by the sign-up proof', async () => {
  const { access, calls } = await accessFor(signedUp(), { gymCode, profile: { id: otherId, disabledAt: new Date() } });
  assert.equal(access.authorized, false);
  assert.equal(calls.some(([name]) => name === 'ensureMember'), false);
});
