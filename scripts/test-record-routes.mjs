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
  class RecordInputError extends Error {}
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../lib/server/auth': { getAccess: async () => access, hasSameOrigin },
    '../../../lib/server/records': {
      RecordInputError,
      upsertProfile: async (id) => calls.push(['profile', id]),
      listRecords: async (id) => { calls.push(['list', id]); return []; },
      createRecord: async (id, input) => {
        calls.push(['create', id, input]);
        if (failure === 'input') throw new RecordInputError('Private diagnostic');
        if (failure === 'database') throw new Error('Private database diagnostic');
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
  return { handlers: module.namespace, calls };
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
  const { handlers, calls } = await routes({ user: { id: ownerId }, authorized: true });
  const read = await handlers.GET();
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
  const created = await handlers.POST(post());
  assert.equal(created.status, 201);
  assert.deepEqual(calls, [
    ['list', ownerId], ['profile', ownerId],
    ['create', ownerId, { movementId: 'clean-and-jerk', value: 185, performedOn: '2026-10-03', repetitionMax: 3, notes: 'Test' }],
  ]);
});

test('owner injection, untrusted video references and invalid payloads do not write', async () => {
  const { handlers, calls } = await routes({ user: { id: ownerId }, authorized: true });
  for (const record of [null, [], { ...validRecord, profileId: ownerId }, { ...validRecord, videoUrl: 'https://other.example.test/video' }, { ...validRecord, notes: 'x'.repeat(5001) }]) {
    assert.equal((await handlers.POST(post(record))).status, 400);
  }
  assert.equal((await handlers.POST(post(validRecord, 'https://other.example.test'))).status, 403);
  assert.deepEqual(calls, []);
});

test('validation and database failures do not disclose private diagnostics', async () => {
  for (const [failure, status] of [['input', 400], ['database', 503]]) {
    const { handlers } = await routes({ user: { id: ownerId }, authorized: true }, failure);
    const response = await handlers.POST(post());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /Private/);
  }
});
