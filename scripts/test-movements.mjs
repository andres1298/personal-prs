import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../src/lib/server/movements.js', import.meta.url), 'utf8');
const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const shared = (id, name, measurementType = 'WEIGHT') => ({
  id, name, ownerId: null, measurementType, category: measurementType === 'WEIGHT' ? 'LIFT' : 'BENCHMARK', groupName: 'Squats',
});

// A small in-memory stand-in for the three tables the service touches.
function fakeDatabase({ movements = [], records = [], hidden = [] } = {}) {
  const db = { movements, records, hidden, transactions: [] };
  const matches = (where, row) => Object.entries(where).every(([key, value]) => row[key] === value);
  db.movement = {
    count: async ({ where }) => movements.filter((movement) => matches(where, movement)).length,
    findUnique: async ({ where }) => movements.find((movement) => movement.id === where.id) ?? null,
    findMany: async () => movements.map((movement) => ({
      ...movement, hiddenBy: hidden.filter((item) => item.movementId === movement.id && item.profileId === ownerId),
    })),
    findFirst: async ({ where }) => movements.find((movement) => where.OR.some((owner) => movement.ownerId === owner.ownerId) &&
      (where.name ? movement.name.toLowerCase() === where.name.equals.toLowerCase()
        : movement.category === where.category && movement.groupName.toLowerCase() === where.groupName.equals.toLowerCase())) ?? null,
    create: async ({ data }) => { movements.push({ ...data }); return { ...data }; },
    delete: async ({ where }) => { movements.splice(movements.findIndex((movement) => movement.id === where.id), 1); },
  };
  db.personalRecord = {
    count: async ({ where }) => records.filter((record) => matches(where, record)).length,
    deleteMany: async ({ where }) => { for (const record of records.filter((item) => matches(where, item))) records.splice(records.indexOf(record), 1); },
  };
  db.hiddenMovement = {
    upsert: async ({ create }) => { if (!hidden.some((item) => matches(create, item))) hidden.push({ ...create }); },
    deleteMany: async ({ where }) => { for (const item of hidden.filter((row) => matches(where, row))) hidden.splice(hidden.indexOf(item), 1); },
  };
  // Restores the snapshot when the callback throws, like a database transaction.
  db.$transaction = async (work, options) => {
    db.transactions.push(options);
    const snapshot = [[...movements], [...records]];
    try { return await work(db); } catch (error) {
      movements.splice(0, movements.length, ...snapshot[0]);
      records.splice(0, records.length, ...snapshot[1]);
      throw error;
    }
  };
  return db;
}

async function service(options) {
  const db = fakeDatabase(options);
  const dependencies = { 'server-only': {}, 'node:crypto': { randomUUID: () => `custom-${db.movements.length}` }, './prisma.js': { getPrisma: () => db } };
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

const base = () => [shared('back-squat', 'Back Squat'), shared('fran', 'Fran', 'TIME')];

test('creates private movements with a category from the measurement type', async () => {
  const { api, db } = await service({ movements: base() });
  const weight = await api.createMovement(ownerId, { name: '  Thruster ', measurementType: 'WEIGHT' });
  const time = await api.createMovement(ownerId, { name: 'Sled   Push', measurementType: 'TIME' });
  assert.deepEqual([weight.name, weight.category, weight.custom, weight.hidden], ['Thruster', 'LIFT', true, false]);
  assert.deepEqual([time.name, time.category], ['Sled Push', 'BENCHMARK']);
  assert.deepEqual(db.movements.filter((movement) => movement.ownerId === ownerId).map((movement) => movement.groupName), ['Custom', 'Custom']);
  assert.deepEqual(db.transactions, [{ isolationLevel: 'Serializable' }, { isolationLevel: 'Serializable' }]);
});

test('creates movements in a chosen section and group, reusing the spelling of an existing group', async () => {
  const { api, db } = await service({ movements: base() });
  const run = await api.createMovement(ownerId, { name: 'Sprint', category: 'CARDIO', groupName: '  Sprints ' });
  assert.deepEqual([run.category, run.measurementType, run.groupName], ['CARDIO', 'TIME', 'Sprints']);
  // An existing group in the same section keeps its spelling, shared or own.
  assert.equal((await api.createMovement(ownerId, { name: 'Box Squat', category: 'LIFT', groupName: 'squats' })).groupName, 'Squats');
  assert.equal((await api.createMovement(ownerId, { name: 'Hill Sprint', category: 'CARDIO', groupName: 'SPRINTS' })).groupName, 'Sprints');
  // The same name in another section is a different group.
  assert.equal((await api.createMovement(ownerId, { name: 'Tabata', category: 'BENCHMARK', groupName: 'sprints' })).groupName, 'sprints');
  // Without a group, own movements share the default one; a matching measurement type is accepted.
  assert.equal((await api.createMovement(ownerId, { name: 'Row Sprint', category: 'CARDIO', measurementType: 'TIME' })).groupName, 'Custom');
  // Gymnastics movements are measured in repetitions.
  const lunges = await api.createMovement(ownerId, { name: 'Wall Walks', category: 'GYMNASTICS' });
  assert.deepEqual([lunges.category, lunges.measurementType], ['GYMNASTICS', 'REPS']);
  // Another member's group never decides the spelling.
  db.movements.push({ ...shared('theirs', 'Their Move'), ownerId: otherId, groupName: 'Gymnastics' });
  assert.equal((await api.createMovement(ownerId, { name: 'Ring Dip', category: 'LIFT', groupName: 'GYMNASTICS' })).groupName, 'GYMNASTICS');
  for (const input of [
    { name: 'Bad', category: 'YOGA' }, { name: 'Bad', category: 'LIFT', measurementType: 'TIME' },
    { name: 'Bad', category: 'CARDIO', measurementType: 'WEIGHT' }, { name: 'Bad', category: 'GYMNASTICS', measurementType: 'WEIGHT' },
    { name: 'Bad', measurementType: 'REPS' }, { name: 'Bad', category: 'LIFT', groupName: '' },
    { name: 'Bad', category: 'LIFT', groupName: 'x'.repeat(api.GROUP_NAME_MAX + 1) }, { name: 'Bad', category: 'LIFT', groupName: 7 },
    { name: 'Bad', category: 'LIFT', groupName: 'Bell\u0007' },
  ]) await assert.rejects(api.createMovement(ownerId, input), api.MovementInputError);
});

test('rejects invalid, duplicate and excess movements', async () => {
  const { api, db } = await service({ movements: base() });
  for (const input of [
    null, { name: '', measurementType: 'WEIGHT' }, { name: 'x'.repeat(41), measurementType: 'WEIGHT' }, { name: 5, measurementType: 'WEIGHT' },
    { name: 'Bell\u0007', measurementType: 'WEIGHT' }, { name: 'Thruster', measurementType: 'DISTANCE' },
  ]) await assert.rejects(api.createMovement(ownerId, input), api.MovementInputError);
  await assert.rejects(api.createMovement(ownerId, { name: 'back squat', measurementType: 'WEIGHT' }), api.MovementConflictError);
  await api.createMovement(ownerId, { name: 'Thruster', measurementType: 'WEIGHT' });
  await assert.rejects(api.createMovement(ownerId, { name: 'THRUSTER', measurementType: 'TIME' }), api.MovementConflictError);
  // Another member may use the same name.
  await api.createMovement(otherId, { name: 'Thruster', measurementType: 'WEIGHT' });
  for (let index = 1; index < api.MAX_CUSTOM_MOVEMENTS; index += 1) db.movements.push({ ...shared(`m${index}`, `M${index}`), ownerId });
  await assert.rejects(api.createMovement(ownerId, { name: 'One more', measurementType: 'WEIGHT' }), api.MovementInputError);
  await assert.rejects(api.createMovement('not-a-uuid', { name: 'Ok', measurementType: 'WEIGHT' }), /verified Auth user ID/);
});

test('lists shared and own movements with the hidden flag, never another member\'s', async () => {
  const movements = [...base(), { ...shared('mine', 'Mine'), ownerId }];
  const { api } = await service({ movements, hidden: [{ profileId: ownerId, movementId: 'fran' }] });
  const listed = await api.listMovements(ownerId);
  assert.deepEqual(listed.map((movement) => [movement.name, movement.custom, movement.hidden]), [
    ['Back Squat', false, false], ['Fran', false, true], ['Mine', true, false],
  ]);
});

test('turning a shared movement off is personal, reversible and keeps records', async () => {
  const records = [{ profileId: ownerId, movementId: 'back-squat' }];
  const { api, db } = await service({ movements: [...base(), { ...shared('mine', 'Mine'), ownerId }], records });
  await api.setMovementHidden(ownerId, 'back-squat', true);
  await api.setMovementHidden(ownerId, 'back-squat', true);
  assert.deepEqual(db.hidden, [{ profileId: ownerId, movementId: 'back-squat' }]);
  await api.setMovementHidden(ownerId, 'back-squat', false);
  assert.deepEqual(db.hidden, []);
  assert.equal(db.records.length, 1);
  await assert.rejects(api.setMovementHidden(ownerId, 'mine', true), api.MovementInputError);
  await assert.rejects(api.setMovementHidden(ownerId, 'unknown', true), api.MovementNotFoundError);
});

test('shared and foreign movements cannot be deleted', async () => {
  const movements = [...base(), { ...shared('theirs', 'Theirs'), ownerId: otherId }];
  const { api, db } = await service({ movements });
  await assert.rejects(api.deleteMovement(ownerId, 'back-squat', true), api.MovementForbiddenError);
  await assert.rejects(api.deleteMovement(ownerId, 'theirs', true), api.MovementNotFoundError);
  await assert.rejects(api.deleteMovement(ownerId, 'unknown', true), api.MovementNotFoundError);
  assert.equal(db.movements.length, 3);
});

test('deleting an own movement without records needs no confirmation', async () => {
  const { api, db } = await service({ movements: [...base(), { ...shared('mine', 'Mine'), ownerId }] });
  assert.deepEqual(await api.deleteMovement(ownerId, 'mine'), { deletedRecords: 0 });
  assert.deepEqual(db.movements.map((movement) => movement.id), ['back-squat', 'fran']);
});

test('deleting an own movement with records reports the count until confirmed, then removes everything', async () => {
  const records = [
    { profileId: ownerId, movementId: 'mine' }, { profileId: ownerId, movementId: 'mine' }, { profileId: ownerId, movementId: 'back-squat' },
  ];
  const { api, db } = await service({ movements: [...base(), { ...shared('mine', 'Mine'), ownerId }], records });
  for (const confirmed of [undefined, false, 'yes']) {
    await assert.rejects(api.deleteMovement(ownerId, 'mine', confirmed), (error) => error instanceof api.MovementConfirmationError && error.recordCount === 2);
  }
  assert.equal(db.records.length, 3);
  assert.equal(db.movements.length, 3);
  assert.deepEqual(await api.deleteMovement(ownerId, 'mine', true), { deletedRecords: 2 });
  assert.deepEqual(db.records, [{ profileId: ownerId, movementId: 'back-squat' }]);
  assert.deepEqual(db.movements.map((movement) => movement.id), ['back-squat', 'fran']);
});
