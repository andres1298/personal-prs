import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/records.js', import.meta.url), 'utf8');
const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const movements = [
  { id: 'snatch', name: 'Snatch', measurementType: 'WEIGHT' },
  { id: 'back-squat', name: 'Back Squat', measurementType: 'WEIGHT' },
  { id: 'fran', name: 'Fran', measurementType: 'TIME' },
];

function fakeDatabase({ records = [], failCreateAt = null, serializationFailure = false } = {}) {
  let creates = 0;
  const db = {
    records,
    transactionOptions: [],
    movement: { findUnique: async ({ where }) => movements.find((movement) => movement.id === where.id) ?? null },
    personalRecord: {
      findFirst: async ({ where }) => records.find((record) => record.profileId === where.profileId &&
        where.OR.some((pair) => pair.movementId === record.movementId && pair.repetitionMax === record.repetitionMax)) ?? null,
      create: async ({ data }) => {
        if (++creates === failCreateAt) throw new Error('Private create failure');
        const movement = movements.find((item) => item.id === data.movementId);
        const row = { id: `rec-${creates}`, notes: null, videoUrl: null, videoId: null, ...data, movement };
        row.value = { toFixed: (digits) => Number(data.value).toFixed(digits) };
        return row;
      },
    },
    // Rolls back by restoring the snapshot when the callback throws, like a database transaction.
    $transaction: async (work, options) => {
      db.transactionOptions.push(options);
      if (serializationFailure) throw Object.assign(new Error('Private serialization failure'), { code: 'P2034' });
      const snapshot = [...records];
      const staged = [];
      const tx = { ...db, personalRecord: { ...db.personalRecord, create: async (args) => { const row = await db.personalRecord.create(args); staged.push(row); return row; } } };
      try {
        const result = await work(tx);
        records.push(...staged);
        return result;
      } catch (error) {
        records.splice(0, records.length, ...snapshot);
        throw error;
      }
    },
  };
  return db;
}

async function service(options) {
  const db = fakeDatabase(options);
  const dependencies = { 'server-only': {}, './prisma.js': { getPrisma: () => db } };
  const module = new SourceTextModule(source);
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return { api: module.namespace, db };
}

const snatch = { movementId: 'snatch', value: 135, performedOn: '2026-10-17', repetitionMax: 1 };
const squat = { movementId: 'back-squat', value: 225, performedOn: '2026-10-17', repetitionMax: 3 };

test('creates every weight record for the verified owner in one serializable transaction', async () => {
  const { api, db } = await service();
  const created = await api.createRecords(ownerId, [snatch, squat]);
  assert.deepEqual(created.map((record) => [record.movementId, record.repetitionMax, record.value, record.performedOn]), [
    ['snatch', 1, '135.000', '2026-10-17'],
    ['back-squat', 3, '225.000', '2026-10-17'],
  ]);
  assert.deepEqual(db.records.map((record) => record.profileId), [ownerId, ownerId]);
  assert.deepEqual(db.transactionOptions, [{ isolationLevel: 'Serializable' }]);
});

test('rejects empty, oversized, time-based, repeated and invalid batches before writing', async () => {
  const { api, db } = await service();
  for (const batch of [
    [], null, { ...snatch }, Array.from({ length: 64 }, () => snatch),
    [{ movementId: 'fran', value: 300, performedOn: '2026-10-17', repetitionMax: null }],
    [snatch, { ...snatch, value: 140 }],
    [snatch, { ...squat, value: -5 }],
    [{ ...snatch, repetitionMax: 2 }],
    [{ ...snatch, movementId: 'unknown' }],
  ]) {
    await assert.rejects(api.createRecords(ownerId, batch), api.RecordInputError);
  }
  assert.deepEqual(db.records, []);
});

test('an existing record for the same movement and repetitions rejects the whole batch', async () => {
  const existing = { id: 'old', profileId: ownerId, movementId: 'back-squat', repetitionMax: 3 };
  const { api, db } = await service({ records: [existing] });
  await assert.rejects(api.createRecords(ownerId, [snatch, squat]), api.RecordConflictError);
  assert.deepEqual(db.records, [existing]);
});

test('records owned by another account or with other repetitions do not conflict', async () => {
  const { api, db } = await service({ records: [
    { id: 'other', profileId: otherId, movementId: 'snatch', repetitionMax: 1 },
    { id: 'mine', profileId: ownerId, movementId: 'snatch', repetitionMax: 3 },
  ] });
  await api.createRecords(ownerId, [snatch]);
  assert.equal(db.records.length, 3);
});

test('a failed insert leaves no partial batch and concurrent saves surface as conflicts', async () => {
  const failing = await service({ failCreateAt: 2 });
  await assert.rejects(failing.api.createRecords(ownerId, [snatch, squat]), /Private create failure/);
  assert.deepEqual(failing.db.records, []);
  const racing = await service({ serializationFailure: true });
  await assert.rejects(racing.api.createRecords(ownerId, [snatch]), racing.api.RecordConflictError);
});

test('requires a verified owner identity', async () => {
  const { api } = await service();
  await assert.rejects(api.createRecords('not-a-uuid', [snatch]), /verified Auth user ID/);
});
