import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const adminId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://app.example.test';
const admin = { user: { id: adminId }, authorized: true, isAdmin: true };
const member = { user: { id: adminId }, authorized: true, isAdmin: false };
const anonymous = { user: null, authorized: false, isAdmin: false };

async function load(path, prefix, access, failure) {
  const calls = [];
  class InvitationError extends Error { constructor(code) { super(code); this.code = code; } }
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    [`${prefix}lib/server/auth`]: { getAccess: async () => access, hasSameOrigin },
    [`${prefix}lib/server/invitations`]: {
      InvitationError,
      listPendingInvitations: async (id) => { calls.push(['list', id]); return [{ id: 'inv-1', name: 'Ana', email: 'ana@example.test' }]; },
      createInvitation: async (id, input) => {
        calls.push(['create', id, input]);
        if (failure === 'member') throw new InvitationError('already_member');
        if (failure === 'input') throw new InvitationError('invalid_input');
        if (failure === 'database') throw new Error('Private database diagnostic');
        return { token: 'secret-token', invitation: { id: 'inv-1', ...input } };
      },
      revokeInvitation: async (id, invitationId) => { calls.push(['revoke', id, invitationId]); return invitationId === 'inv-1'; },
      renewInvitation: async (id, invitationId) => {
        calls.push(['renew', id, invitationId]);
        if (failure === 'database') throw new Error('Private database diagnostic');
        return invitationId === 'inv-1' ? { token: 'fresh-token', expiresAt: new Date('2026-10-25T00:00:00.000Z') } : null;
      },
    },
  };
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'));
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return { handlers: module.namespace, calls };
}

const collection = (access, failure) => load('../src/app/api/invitations/route.js', '../../../', access, failure);
const item = (access, failure) => load('../src/app/api/invitations/[id]/route.js', '../../../../', access, failure);

function post(body = { name: 'Ana', email: 'ana@example.test' }, requestOrigin = origin) {
  return new Request(`${origin}/api/invitations`, {
    method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function remove(id = 'inv-1', requestOrigin = origin, method = 'DELETE') {
  return [new Request(`${origin}/api/invitations/${id}`, { method, headers: { origin: requestOrigin } }), { params: Promise.resolve({ id }) }];
}
const renew = (id = 'inv-1', requestOrigin = origin) => remove(id, requestOrigin, 'POST');

test('anonymous and non-admin sessions never reach the invitation service', async () => {
  for (const [access, status] of [[anonymous, 401], [member, 403]]) {
    const list = await collection(access);
    assert.equal((await list.handlers.GET()).status, status);
    assert.equal((await list.handlers.POST(post())).status, status);
    const single = await item(access);
    assert.equal((await single.handlers.DELETE(...remove())).status, status);
    assert.equal((await single.handlers.POST(...renew())).status, status);
    assert.deepEqual([...list.calls, ...single.calls], []);
  }
});

test('cross-origin writes are rejected before any service call', async () => {
  const list = await collection(admin);
  assert.equal((await list.handlers.POST(post(undefined, 'https://other.example.test'))).status, 403);
  const single = await item(admin);
  assert.equal((await single.handlers.DELETE(...remove('inv-1', 'https://other.example.test'))).status, 403);
  assert.equal((await single.handlers.POST(...renew('inv-1', 'https://other.example.test'))).status, 403);
  assert.deepEqual([...list.calls, ...single.calls], []);
});

test('admins list and create invitations with a private link', async () => {
  const { handlers, calls } = await collection(admin);
  const listed = await handlers.GET();
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await listed.json()).invitations.length, 1);
  const created = await handlers.POST(post());
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('Cache-Control'), 'private, no-store');
  const body = await created.json();
  assert.equal(body.url, `${origin}/invite/secret-token`);
  assert.equal(body.invitation.email, 'ana@example.test');
  assert.deepEqual(calls, [['list', adminId], ['create', adminId, { name: 'Ana', email: 'ana@example.test' }]]);
});

test('invalid payloads are rejected without creating invitations', async () => {
  const { handlers, calls } = await collection(admin);
  for (const body of [null, [], { name: 'Ana' }, { name: 'Ana', email: 'ana@example.test', invitedById: 'x' }, { name: 'Ana', email: 'x'.repeat(3000) }]) {
    assert.equal((await handlers.POST(post(body))).status, 400);
  }
  assert.deepEqual(calls, []);
});

test('service errors map to safe responses', async () => {
  for (const [failure, status] of [['member', 409], ['input', 400], ['database', 503]]) {
    const { handlers } = await collection(admin, failure);
    const response = await handlers.POST(post());
    assert.equal(response.status, status);
    const text = await response.text();
    assert.doesNotMatch(text, /Private/);
    if (failure === 'member') assert.match(text, /ya tiene acceso/);
  }
});

test('admins revoke their pending invitations', async () => {
  const { handlers, calls } = await item(admin);
  assert.equal((await handlers.DELETE(...remove('inv-1'))).status, 204);
  assert.equal((await handlers.DELETE(...remove('missing'))).status, 404);
  assert.deepEqual(calls, [['revoke', adminId, 'inv-1'], ['revoke', adminId, 'missing']]);
});

test('admins renew pending invitations into a fresh private link', async () => {
  const { handlers, calls } = await item(admin);
  const renewed = await handlers.POST(...renew('inv-1'));
  assert.equal(renewed.status, 200);
  assert.equal(renewed.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await renewed.json()).url, `${origin}/invite/fresh-token`);
  assert.equal((await handlers.POST(...renew('missing'))).status, 404);
  assert.deepEqual(calls, [['renew', adminId, 'inv-1'], ['renew', adminId, 'missing']]);
  const failing = await item(admin, 'database');
  const response = await failing.handlers.POST(...renew('inv-1'));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /Private/);
});
