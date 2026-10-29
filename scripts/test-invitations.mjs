import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/invitations.js', import.meta.url), 'utf8');
const adminId = '11111111-1111-4111-8111-111111111111';
const otherAdminId = '33333333-3333-4333-8333-333333333333';
const newUserId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-17T12:00:00.000Z');
const week = 7 * 24 * 60 * 60 * 1000;

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('gt' in condition) return row[key] > condition.gt;
      throw new Error(`Unsupported condition on ${key}`);
    }
    const value = row[key] instanceof Date ? row[key].getTime() : row[key];
    return value === (condition instanceof Date ? condition.getTime() : condition);
  });
}

function fakeDatabase({ failProfile = false } = {}) {
  const invitations = [];
  const profiles = [{ id: adminId, email: 'admin@example.test' }];
  let sequence = 0;
  const db = {
    invitations, profiles,
    invitation: {
      create: async ({ data }) => { const row = { id: `inv-${++sequence}`, acceptedAt: null, acceptedProfileId: null, revokedAt: null, ...data }; invitations.push(row); return { ...row }; },
      findUnique: async ({ where }) => { const row = invitations.find((item) => matches(item, where)); return row ? { ...row } : null; },
      findMany: async ({ where }) => invitations.filter((item) => matches(item, where)).map((row) => ({ ...row })),
      updateMany: async ({ where, data }) => {
        const rows = invitations.filter((item) => matches(item, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }) => { const row = invitations.find((item) => matches(item, where)); Object.assign(row, data); return { ...row }; },
    },
    profile: {
      findUnique: async ({ where }) => profiles.find((item) => matches(item, where)) ?? null,
      create: async ({ data }) => {
        if (failProfile) throw new Error('Private profile failure');
        profiles.push({ ...data }); return { ...data };
      },
    },
    $transaction: async (work) => (Array.isArray(work) ? Promise.all(work) : work(db)),
  };
  return db;
}

async function service({ failProfile, authError, failDelete } = {}) {
  const db = fakeDatabase({ failProfile });
  const auth = { created: [], deleted: [] };
  const dependencies = {
    'server-only': {},
    'node:crypto': crypto,
    './prisma.js': { getPrisma: () => db },
    '../password-policy.js': { MIN_PASSWORD_LENGTH: 8 },
    './supabase-admin.js': {
      getAuthAdmin: () => ({
        createUser: async (attributes) => {
          auth.created.push(attributes);
          // Yield so concurrent acceptances interleave as they would over the network.
          await new Promise((resolve) => setTimeout(resolve, 5));
          return authError ? { data: { user: null }, error: authError } : { data: { user: { id: newUserId } }, error: null };
        },
        deleteUser: async (id) => { auth.deleted.push(id); if (failDelete) throw new Error('Private delete failure'); return { error: null }; },
      }),
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
  return { api: module.namespace, db, auth };
}

const code = (expected) => (error) => error?.code === expected;

test('stores only the token hash', async () => {
  const { api, db } = await service();
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  assert.equal(Buffer.from(token, 'base64url').length, 32);
  const [row] = db.invitations;
  assert.equal(row.tokenHash, api.hashToken(token));
  assert.equal(row.tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.ok(!Object.values(row).includes(token));
});

test('normalizes email on create and expires after seven days', async () => {
  const { api, db } = await service();
  const { invitation } = await api.createInvitation(adminId, { name: '  Ana  ', email: ' Ana@Example.TEST ' }, now);
  assert.equal(invitation.email, 'ana@example.test');
  assert.equal(invitation.name, 'Ana');
  assert.equal(db.invitations[0].invitedById, adminId);
  assert.equal(invitation.expiresAt.getTime() - now.getTime(), week);
});

test('rejects invalid name or email', async () => {
  const { api, db } = await service();
  for (const input of [{ name: '', email: 'a@b.co' }, { name: 'x'.repeat(81), email: 'a@b.co' }, { name: 'Ana', email: 'no-at' }, { name: 'Ana', email: `${'x'.repeat(250)}@b.co` }, { name: 7, email: 'a@b.co' }]) {
    await assert.rejects(api.createInvitation(adminId, input, now), code('invalid_input'));
  }
  assert.equal(db.invitations.length, 0);
});

test('rejects inviting an existing member', async () => {
  const { api, db } = await service();
  await assert.rejects(api.createInvitation(adminId, { name: 'Admin', email: 'ADMIN@example.test' }, now), code('already_member'));
  assert.equal(db.invitations.length, 0);
});

test('lists unaccepted, unrevoked invitations of the inviter and flags expired ones', async () => {
  const { api, db } = await service();
  await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  const { invitation: revoked } = await api.createInvitation(adminId, { name: 'Bea', email: 'bea@example.test' }, now);
  await api.createInvitation(adminId, { name: 'Old', email: 'old@example.test' }, new Date(now.getTime() - week));
  db.invitations.push({ ...db.invitations[0], id: 'foreign', invitedById: otherAdminId, tokenHash: 'foreign' });
  await api.revokeInvitation(adminId, revoked.id, now);
  const pending = await api.listPendingInvitations(adminId, now);
  assert.deepEqual(pending.map((item) => [item.email, item.expired]), [['ana@example.test', false], ['old@example.test', true]]);
  assert.deepEqual(Object.keys(pending[0]).sort(), ['email', 'expired', 'expiresAt', 'id', 'name']);
});

test('renewing a link invalidates the old token and restarts the expiry', async () => {
  const { api, db } = await service();
  const past = new Date(now.getTime() - week - 1);
  const { token: oldToken, invitation } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, past);
  assert.equal(await api.findValidInvitation(oldToken, now), null);
  const renewed = await api.renewInvitation(adminId, invitation.id, now);
  assert.notEqual(renewed.token, oldToken);
  assert.equal(renewed.expiresAt.getTime() - now.getTime(), week);
  assert.equal(db.invitations[0].tokenHash, api.hashToken(renewed.token));
  assert.equal(await api.findValidInvitation(oldToken, now), null);
  assert.deepEqual(await api.findValidInvitation(renewed.token, now), { name: 'Ana', email: 'ana@example.test' });
});

test('only the inviter can renew, and never accepted or revoked links', async () => {
  const { api } = await service();
  const { invitation } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  assert.equal(await api.renewInvitation(otherAdminId, invitation.id, now), null);
  const { token, invitation: accepted } = await api.createInvitation(adminId, { name: 'Bea', email: 'bea@example.test' }, now);
  await api.acceptInvitation(token, 'long-password', now);
  assert.equal(await api.renewInvitation(adminId, accepted.id, now), null);
  await api.revokeInvitation(adminId, invitation.id, now);
  assert.equal(await api.renewInvitation(adminId, invitation.id, now), null);
});

test('accepts once and creates profile with inviter', async () => {
  const { api, db, auth } = await service();
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  assert.deepEqual(await api.findValidInvitation(token, now), { name: 'Ana', email: 'ana@example.test' });
  assert.deepEqual(await api.acceptInvitation(token, 'long-password', now), { email: 'ana@example.test' });
  assert.deepEqual(auth.created, [{ email: 'ana@example.test', password: 'long-password', email_confirm: true, user_metadata: { name: 'Ana' } }]);
  assert.deepEqual(db.profiles.at(-1), { id: newUserId, displayName: 'Ana', email: 'ana@example.test', invitedById: adminId });
  assert.equal(db.invitations[0].acceptedProfileId, newUserId);
  assert.equal(await api.findValidInvitation(token, now), null);
  await assert.rejects(api.acceptInvitation(token, 'long-password', now), code('invalid_link'));
});

test('concurrent accepts create a single user', async () => {
  const { api, auth } = await service();
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  const results = await Promise.allSettled([api.acceptInvitation(token, 'long-password', now), api.acceptInvitation(token, 'long-password', now)]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'invalid_link');
  assert.equal(auth.created.length, 1);
});

test('expired at boundary, revoked and unknown tokens are invalid', async () => {
  const { api } = await service();
  const { token: expired } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, new Date(now.getTime() - week));
  const { token: revoked, invitation } = await api.createInvitation(adminId, { name: 'Bea', email: 'bea@example.test' }, now);
  assert.equal(await api.revokeInvitation(adminId, invitation.id, now), true);
  for (const token of [expired, revoked, 'unknown', '']) {
    assert.equal(await api.findValidInvitation(token, now), null);
    await assert.rejects(api.acceptInvitation(token, 'long-password', now), code('invalid_link'));
  }
});

test('auth failure releases the claim', async () => {
  const { api, db } = await service({ authError: { code: 'email_exists', message: 'Private auth diagnostic' } });
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  await assert.rejects(api.acceptInvitation(token, 'long-password', now), code('email_taken'));
  assert.equal(db.invitations[0].acceptedAt, null);
});

test('profile failure deletes the auth user and releases the claim', async () => {
  const { api, db, auth } = await service({ failProfile: true });
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  await assert.rejects(api.acceptInvitation(token, 'long-password', now));
  assert.deepEqual(auth.deleted, [newUserId]);
  assert.equal(db.invitations[0].acceptedAt, null);
  assert.equal(db.invitations[0].acceptedProfileId, null);
});

test('short password is rejected before claiming', async () => {
  const { api, db, auth } = await service();
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  for (const password of ['short', '', null]) {
    await assert.rejects(api.acceptInvitation(token, password, now), code('weak_password'));
  }
  assert.equal(api.MIN_PASSWORD_LENGTH, 8);
  assert.equal(db.invitations[0].acceptedAt, null);
  assert.equal(auth.created.length, 0);
});

test("revoke only affects the inviter's pending invitation", async () => {
  const { api } = await service();
  const { invitation, token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  assert.equal(await api.revokeInvitation(otherAdminId, invitation.id, now), false);
  await api.acceptInvitation(token, 'long-password', now);
  assert.equal(await api.revokeInvitation(adminId, invitation.id, now), false);
});

test('a failing auth cleanup still releases the claim and keeps the original error', async () => {
  const { api, db, auth } = await service({ failProfile: true, failDelete: true });
  const { token } = await api.createInvitation(adminId, { name: 'Ana', email: 'ana@example.test' }, now);
  await assert.rejects(api.acceptInvitation(token, 'long-password', now), /Private profile failure/);
  assert.deepEqual(auth.deleted, [newUserId]);
  assert.equal(db.invitations[0].acceptedAt, null);
});
