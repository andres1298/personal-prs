import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/api/records/route.js', import.meta.url), 'utf8');
const ownerId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://app.example.test';
const validRecord = { move: 'Clean & Jerk', value: 185, date: '2026-10-03', rm: 3, notes: 'Test' };

async function routes(access, failure) {
  const calls = [];
  const limits = [];
  class RecordInputError extends Error {}
  class RecordConflictError extends Error {}
  class RecordLimitError extends Error { constructor() { super('Private diagnostic'); this.limit = 5000; } }
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../lib/server/auth': { getAccess: async () => access, hasSameOrigin },
    '../../../lib/server/rate-limit': {
      rateLimitResponse: async (policy, subject) => {
        limits.push([policy, subject]);
        return failure === 'limited' ? Response.json({ error: 'Demasiadas solicitudes.' }, { status: 429, headers: { 'Retry-After': '30' } }) : null;
      },
    },
    '../../../lib/server/records': {
      NOTES_MAX: 1000,
      RecordConflictError,
      RecordInputError,
      RecordLimitError,
      listRecords: async (id) => { calls.push(['list', id]); return []; },
      createRecord: async (id, input) => {
        calls.push(['create', id, input]);
        if (failure === 'input') throw new RecordInputError('Private diagnostic');
        if (failure === 'database') throw new Error('Private database diagnostic');
        if (failure === 'quota') throw new RecordLimitError();
        if (failure === 'conflict') throw new RecordConflictError('Private diagnostic');
        return input;
      },
      toLegacyRecord: (record) => record,
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
  return { handlers: module.namespace, calls, limits };
}

function post(record = validRecord, requestOrigin = origin) {
  return new Request(`${origin}/api/records`, {
    method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(record),
  });
}

test('anonymous and unapproved sessions never reach persistence', async () => {
  for (const [access, status] of [[{ user: null, authorized: false }, 401], [{ user: { id: ownerId }, authorized: false }, 403]]) {
    const { handlers, calls } = await routes(access);
    assert.equal((await handlers.GET()).status, status);
    assert.equal((await handlers.POST(post())).status, status);
    assert.deepEqual(calls, []);
  }
});

test('authorized reads and creation use only the verified server identity', async () => {
  const { handlers, calls, limits } = await routes({ user: { id: ownerId }, authorized: true });
  const read = await handlers.GET();
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
  const created = await handlers.POST(post());
  assert.equal(created.status, 201);
  assert.deepEqual(calls, [
    ['list', ownerId],
    ['create', ownerId, { movementName: 'Clean & Jerk', value: 185, performedOn: '2026-10-03', repetitionMax: 3, notes: 'Test' }],
  ]);
  // Reads and writes use separate per-user budgets.
  assert.deepEqual(limits, [['apiRead', ownerId], ['apiWrite', ownerId]]);
});

test('owner injection and invalid payloads do not write', async () => {
  const { handlers, calls } = await routes({ user: { id: ownerId }, authorized: true });
  for (const record of [null, [], { ...validRecord, profileId: ownerId }, { ...validRecord, notes: 'x'.repeat(1001) }]) {
    assert.equal((await handlers.POST(post(record))).status, 400);
  }
  assert.equal((await handlers.POST(post(validRecord, 'https://other.example.test'))).status, 403);
  assert.deepEqual(calls, []);
});

test('validation and database failures do not disclose private diagnostics', async () => {
  for (const [failure, status] of [['input', 400], ['conflict', 409], ['database', 503]]) {
    const { handlers } = await routes({ user: { id: ownerId }, authorized: true }, failure);
    const response = await handlers.POST(post());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /Private/);
  }
});

test('a rate-limited user gets 429 with Retry-After and never reaches persistence', async () => {
  const { handlers, calls } = await routes({ user: { id: ownerId }, authorized: true }, 'limited');
  for (const response of [await handlers.GET(), await handlers.POST(post())]) {
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '30');
    assert.match((await response.json()).error, /Demasiadas solicitudes/);
  }
  assert.deepEqual(calls, []);
});

test('the account record quota answers 409 with a clear message', async () => {
  const { handlers } = await routes({ user: { id: ownerId }, authorized: true }, 'quota');
  const response = await handlers.POST(post());
  assert.equal(response.status, 409);
  const { error } = await response.json();
  assert.match(error, /límite de 5000 registros/);
  assert.doesNotMatch(error, /Private/);
});
