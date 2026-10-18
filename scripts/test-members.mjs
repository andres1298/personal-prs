import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const adminId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const missingId = '33333333-3333-4333-8333-333333333333';
const origin = 'https://app.example.test';
const now = new Date('2026-10-18T12:00:00.000Z');

async function link(path, dependencies) {
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'));
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

function fakeDatabase() {
  const profiles = [
    { id: adminId, displayName: null, email: 'admin@example.test', createdAt: now, disabledAt: null, disabledById: null, records: [{ value: '225.000' }] },
    { id: memberId, displayName: 'Ana', email: 'ana@example.test', createdAt: now, disabledAt: null, disabledById: null, records: [{ value: '135.000' }, { value: '185.000' }] },
  ];
  const queries = [];
  return {
    profiles, queries,
    profile: {
      findMany: async (query) => {
        queries.push(query);
        return profiles.map(({ records, ...row }) => {
          const picked = Object.fromEntries(Object.keys(query.select).filter((key) => key !== '_count').map((key) => [key, row[key]]));
          return { ...picked, _count: { records: records.length } };
        });
      },
      updateMany: async ({ where, data }) => {
        const rows = profiles.filter((row) => row.id === where.id);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
  };
}

async function service() {
  const db = fakeDatabase();
  const api = await link('../src/lib/server/members.js', { 'server-only': {}, './prisma.js': { getPrisma: () => db } });
  return { api, db };
}

const code = (expected) => (error) => error?.code === expected;

test('members list exposes a record count and never record values', async () => {
  const { api, db } = await service();
  const members = await api.listMembers(` ${adminId.toUpperCase()} `);
  assert.deepEqual(members.map((member) => [member.email, member.isAdmin, member.recordCount]),
    [['admin@example.test', true, 1], ['ana@example.test', false, 2]]);
  assert.deepEqual(Object.keys(members[1]).sort(), ['createdAt', 'disabledAt', 'email', 'id', 'isAdmin', 'name', 'recordCount']);
  assert.doesNotMatch(JSON.stringify(members), /135|185|225/);
  assert.equal('records' in db.queries[0].select, false);
});

test('disabling records the actor and enabling clears it', async () => {
  const { api, db } = await service();
  await api.setMemberDisabled(adminId, memberId, true, adminId, now);
  assert.deepEqual([db.profiles[1].disabledAt, db.profiles[1].disabledById], [now, adminId]);
  await api.setMemberDisabled(adminId, memberId, false, adminId, now);
  assert.deepEqual([db.profiles[1].disabledAt, db.profiles[1].disabledById], [null, null]);
});

test('admins cannot be disabled and unknown or malformed ids are rejected', async () => {
  const { api, db } = await service();
  await assert.rejects(api.setMemberDisabled(adminId, adminId, true, `${memberId},${adminId}`, now), code('admin'));
  await assert.rejects(api.setMemberDisabled(adminId, missingId, true, adminId, now), code('not_found'));
  await assert.rejects(api.setMemberDisabled(adminId, 'not-a-uuid', true, adminId, now), code('not_found'));
  await assert.rejects(api.setMemberDisabled(adminId, memberId, 'yes', adminId, now), code('invalid_input'));
  assert.ok(db.profiles.every((row) => row.disabledAt === null));
});

const admin = { user: { id: adminId }, authorized: true, isAdmin: true };
const member = { user: { id: memberId }, authorized: true, isAdmin: false };
const anonymous = { user: null, authorized: false, isAdmin: false };

async function routes(access, failure) {
  const calls = [];
  class MemberError extends Error { constructor(errorCode) { super(errorCode); this.code = errorCode; } }
  const dependencies = (prefix) => ({
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    [`${prefix}lib/server/auth`]: { getAccess: async () => access, hasSameOrigin },
    [`${prefix}lib/server/members`]: {
      MemberError,
      listMembers: async () => { calls.push(['list']); return [{ id: memberId, recordCount: 2 }]; },
      setMemberDisabled: async (actorId, id, disabled) => {
        calls.push(['set', actorId, id, disabled]);
        if (failure === 'admin') throw new MemberError('admin');
        if (failure === 'missing') throw new MemberError('not_found');
        if (failure === 'database') throw new Error('Private database diagnostic');
      },
    },
  });
  const collection = await link('../src/app/api/members/route.js', dependencies('../../../'));
  const single = await link('../src/app/api/members/[id]/route.js', dependencies('../../../../'));
  return { collection, single, calls };
}

function patch(body = { disabled: true }, requestOrigin = origin) {
  return [new Request(`${origin}/api/members/${memberId}`, {
    method: 'PATCH', headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: memberId }) }];
}

test('anonymous and non-admin sessions never reach the members service', async () => {
  for (const [access, status] of [[anonymous, 401], [member, 403]]) {
    const { collection, single, calls } = await routes(access);
    assert.equal((await collection.GET()).status, status);
    assert.equal((await single.PATCH(...patch())).status, status);
    assert.deepEqual(calls, []);
  }
});

test('admins list members and toggle access with private responses', async () => {
  const { collection, single, calls } = await routes(admin);
  const listed = await collection.GET();
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await listed.json()).members[0].recordCount, 2);
  const updated = await single.PATCH(...patch({ disabled: true }));
  assert.equal(updated.status, 200);
  assert.equal(updated.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls, [['list'], ['set', adminId, memberId, true]]);
});

test('cross-origin and malformed updates are rejected before any service call', async () => {
  const { single, calls } = await routes(admin);
  assert.equal((await single.PATCH(...patch(undefined, 'https://other.example.test'))).status, 403);
  for (const body of [null, [], {}, { disabled: 'true' }, { disabled: true, disabledById: adminId }]) {
    assert.equal((await single.PATCH(...patch(body))).status, 400);
  }
  assert.deepEqual(calls, []);
});

test('service errors map to safe responses', async () => {
  for (const [failure, status] of [['admin', 409], ['missing', 404], ['database', 503]]) {
    const { single } = await routes(admin, failure);
    const response = await single.PATCH(...patch());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /Private/);
  }
});
