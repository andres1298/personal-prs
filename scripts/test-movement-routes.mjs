import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://app.example.test';

class MovementInputError extends Error {}
class MovementConflictError extends Error {}
class MovementNotFoundError extends Error {}
class MovementForbiddenError extends Error {}
class MovementConfirmationError extends Error {
  constructor(recordCount) { super('confirm'); this.recordCount = recordCount; }
}

async function load(path, access, failure) {
  const calls = [];
  const fail = () => { if (failure) throw failure; };
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../lib/server/auth': { getAccess: async () => access, hasSameOrigin },
    '../../../../lib/server/auth': { getAccess: async () => access, hasSameOrigin },
    '../../../lib/server/movements': {
      MovementConflictError, MovementInputError,
      listMovements: async (id) => { calls.push(['list', id]); fail(); return [{ id: 'm' }]; },
      createMovement: async (id, input) => { calls.push(['create', id, input]); fail(); return { id: 'new', ...input }; },
    },
    '../../../../lib/server/movements': {
      MovementConfirmationError, MovementForbiddenError, MovementInputError, MovementNotFoundError,
      setMovementHidden: async (id, movementId, hidden) => { calls.push(['hide', id, movementId, hidden]); fail(); },
      deleteMovement: async (id, movementId, confirmed) => { calls.push(['delete', id, movementId, confirmed]); fail(); return { deletedRecords: 0 }; },
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

const collection = (access, failure) => load('../src/app/api/movements/route.js', access, failure);
const item = (access, failure) => load('../src/app/api/movements/[id]/route.js', access, failure);
const allowed = { user: { id: ownerId }, authorized: true };
const send = (method, url, body, requestOrigin = origin) => new Request(`${origin}${url}`, {
  method, headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const params = (id = 'm1') => ({ params: Promise.resolve({ id }) });

test('anonymous and unapproved sessions never reach persistence', async () => {
  for (const [access, status] of [[{ user: null, authorized: false }, 401], [{ user: { id: ownerId }, authorized: false }, 403]]) {
    const list = await collection(access);
    assert.equal((await list.handlers.GET()).status, status);
    assert.equal((await list.handlers.POST(send('POST', '/api/movements', { name: 'A', measurementType: 'WEIGHT' }))).status, status);
    const single = await item(access);
    assert.equal((await single.handlers.PATCH(send('PATCH', '/api/movements/m1', { hidden: true }), params())).status, status);
    assert.equal((await single.handlers.DELETE(send('DELETE', '/api/movements/m1'), params())).status, status);
    assert.deepEqual([...list.calls, ...single.calls], []);
  }
});

test('reads, creation, hiding and deletion use only the verified identity', async () => {
  const list = await collection(allowed);
  const read = await list.handlers.GET();
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await list.handlers.POST(send('POST', '/api/movements', { name: 'Thruster', measurementType: 'WEIGHT' }))).status, 201);
  assert.deepEqual(list.calls, [['list', ownerId], ['create', ownerId, { name: 'Thruster', measurementType: 'WEIGHT' }]]);
  const single = await item(allowed);
  assert.equal((await single.handlers.PATCH(send('PATCH', '/api/movements/m1', { hidden: true }), params())).status, 200);
  assert.equal((await single.handlers.DELETE(send('DELETE', '/api/movements/m1'), params())).status, 200);
  assert.equal((await single.handlers.DELETE(send('DELETE', '/api/movements/m1?confirm=true'), params())).status, 200);
  assert.deepEqual(single.calls, [['hide', ownerId, 'm1', true], ['delete', ownerId, 'm1', false], ['delete', ownerId, 'm1', true]]);
});

test('owner injection, bad payloads and cross-origin requests do not write', async () => {
  const list = await collection(allowed);
  for (const body of [null, [], { name: 'A', measurementType: 'WEIGHT', ownerId }, { name: 'A', measurementType: 'WEIGHT', id: 'x' }]) {
    assert.equal((await list.handlers.POST(send('POST', '/api/movements', body))).status, 400);
  }
  assert.equal((await list.handlers.POST(send('POST', '/api/movements', { name: 'x'.repeat(1001), measurementType: 'WEIGHT' }))).status, 400);
  assert.equal((await list.handlers.POST(send('POST', '/api/movements', { name: 'A', measurementType: 'WEIGHT' }, 'https://other.example.test'))).status, 403);
  const single = await item(allowed);
  for (const body of [null, [], {}, { hidden: 'yes' }, { hidden: true, ownerId }]) {
    assert.equal((await single.handlers.PATCH(send('PATCH', '/api/movements/m1', body), params())).status, 400);
  }
  assert.equal((await single.handlers.PATCH(send('PATCH', '/api/movements/m1', { hidden: true }, 'https://other.example.test'), params())).status, 403);
  assert.equal((await single.handlers.DELETE(send('DELETE', '/api/movements/m1', undefined, 'https://other.example.test'), params())).status, 403);
  assert.deepEqual([...list.calls, ...single.calls], []);
});

test('deleting a movement with records answers 409 with the count and nothing else', async () => {
  const single = await item(allowed, new MovementConfirmationError(4));
  const response = await single.handlers.DELETE(send('DELETE', '/api/movements/m1'), params());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).recordCount, 4);
});

test('errors map to statuses without private diagnostics', async () => {
  const cases = [
    [new MovementForbiddenError('Private'), 403], [new MovementNotFoundError('Private'), 404],
    [new MovementInputError('Private'), 400], [new Error('Private database diagnostic'), 503],
  ];
  for (const [failure, status] of cases) {
    const single = await item(allowed, failure);
    for (const response of [
      await single.handlers.DELETE(send('DELETE', '/api/movements/m1'), params()),
      await single.handlers.PATCH(send('PATCH', '/api/movements/m1', { hidden: true }), params()),
    ]) {
      assert.equal(response.status, status);
      assert.doesNotMatch(JSON.stringify(await response.json()), /Private/);
    }
  }
  for (const [failure, status] of [[new MovementConflictError('Private'), 409], [new MovementInputError('Private'), 400], [new Error('Private'), 503]]) {
    const list = await collection(allowed, failure);
    const response = await list.handlers.POST(send('POST', '/api/movements', { name: 'A', measurementType: 'WEIGHT' }));
    assert.equal(response.status, status);
    assert.doesNotMatch(JSON.stringify(await response.json()), /Private/);
  }
});
