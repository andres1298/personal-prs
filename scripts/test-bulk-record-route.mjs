import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { hasSameOrigin } from '../src/lib/server/access-policy.js';

const source = await readFile(new URL('../src/app/api/records/bulk/route.js', import.meta.url), 'utf8');
const ownerId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://app.example.test';
const validBatch = { records: [
  { move: 'Clean & Jerk', value: 185, date: '2026-10-17', rm: 1 },
  { move: 'Back Squat', value: 225.5, date: '2026-10-17', rm: 5 },
] };

async function routes(access, failure) {
  const calls = [];
  class RecordInputError extends Error {}
  class RecordConflictError extends Error {}
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../../lib/server/auth': { getAccess: async () => access, hasSameOrigin },
    '../../../../lib/server/records': {
      MAX_BULK_RECORDS: 63,
      RecordInputError,
      RecordConflictError,
      createRecords: async (id, inputs) => {
        calls.push(['createRecords', id, inputs]);
        if (failure === 'input') throw new RecordInputError('Private diagnostic');
        if (failure === 'conflict') throw new RecordConflictError('Private diagnostic');
        if (failure === 'database') throw new Error('Private database diagnostic');
        return inputs;
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

function post(body = validBatch, requestOrigin = origin) {
  return new Request(`${origin}/api/records/bulk`, {
    method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('anonymous and unapproved sessions never reach persistence', async () => {
  for (const [access, status] of [[{ user: null, authorized: false }, 401], [{ user: { id: ownerId }, authorized: false }, 403]]) {
    const { handlers, calls } = await routes(access);
    assert.equal((await handlers.POST(post())).status, status);
    assert.deepEqual(calls, []);
  }
});

test('authorized batches are created with the verified server identity', async () => {
  const { handlers, calls } = await routes({ user: { id: ownerId }, authorized: true });
  const response = await handlers.POST(post());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await response.json()).records.length, 2);
  assert.deepEqual(calls, [['createRecords', ownerId, [
    { movementId: 'clean-and-jerk', value: 185, performedOn: '2026-10-17', repetitionMax: 1 },
    { movementId: 'back-squat', value: 225.5, performedOn: '2026-10-17', repetitionMax: 5 },
  ]]]);
});

test('cross-origin, malformed, oversized and injected payloads do not write', async () => {
  const { handlers, calls } = await routes({ user: { id: ownerId }, authorized: true });
  assert.equal((await handlers.POST(post(validBatch, 'https://other.example.test'))).status, 403);
  for (const body of [
    'not json', null, [], {}, { records: [] }, { records: {} }, { records: [null] },
    { records: validBatch.records, profileId: ownerId },
    { records: [{ ...validBatch.records[0], profileId: ownerId }] },
    { records: [{ ...validBatch.records[0], notes: 'x' }] },
    { records: [{ ...validBatch.records[0], value: '185' }] },
    { records: [{ ...validBatch.records[0], move: 'x'.repeat(101) }] },
    { records: Array.from({ length: 64 }, () => validBatch.records[0]) },
  ]) {
    assert.equal((await handlers.POST(post(body))).status, 400, JSON.stringify(body)?.slice(0, 80));
  }
  assert.equal((await handlers.POST(post('x'.repeat(16001)))).status, 413);
  assert.deepEqual(calls, []);
});

test('validation, conflict and database failures do not disclose private diagnostics', async () => {
  for (const [failure, status] of [['input', 400], ['conflict', 409], ['database', 503]]) {
    const { handlers } = await routes({ user: { id: ownerId }, authorized: true }, failure);
    const response = await handlers.POST(post());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /Private/);
  }
});
