import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin, isAdminUser } from '../src/lib/server/access-policy.js';

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

async function accessFor(user, { admins = '', profile = null } = {}) {
  const calls = [];
  const source = await readFile(new URL('../src/lib/server/auth.js', import.meta.url), 'utf8');
  const dependencies = {
    'server-only': {},
    'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    './access-policy.js': await import('../src/lib/server/access-policy.js'),
    './records.js': {
      findProfile: async (id) => { calls.push(['find', id]); return profile; },
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
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable', SUPABASE_ADMIN_USER_IDS: admins });
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
