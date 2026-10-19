import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/server/prisma.js';
import {
  completeTour, createRecord, deleteRecord, hasPendingTour, listRecords, toLegacyRecord, updateRecord, upsertProfile,
} from '../src/lib/server/records.js';
import {
  createMovement, deleteMovement, MovementConfirmationError, MovementForbiddenError, setMovementHidden,
} from '../src/lib/server/movements.js';
import { movementCatalog, seedMovements } from '../prisma/catalog.mjs';

// Require a deliberate choice of a disposable database; never run against live data.
if (process.env.PRISMA_TEST_DATABASE !== 'disposable') {
  throw new Error('Set PRISMA_TEST_DATABASE=disposable only for an isolated test database.');
}

const prisma = getPrisma();
const ownerId = randomUUID();
const otherId = randomUUID();
const input = {
  movementId: 'back-squat', value: '225.125', performedOn: '2026-02-28', repetitionMax: 3,
  notes: 'Test record',
};

try {
  await seedMovements(prisma);
  await seedMovements(prisma);
  assert.equal(await prisma.movement.count(), movementCatalog.length);
  await upsertProfile(ownerId, 'Test owner');
  await upsertProfile(ownerId, 'Updated owner');
  await upsertProfile(otherId, 'Other owner');
  // New members have a pending tour; completing it is per member and keeps the first time.
  assert.equal(await hasPendingTour(ownerId), true);
  assert.equal(await hasPendingTour(randomUUID()), false);
  const firstCompletion = new Date('2026-03-01T00:00:00Z');
  await completeTour(ownerId, firstCompletion);
  await completeTour(ownerId);
  assert.equal(await hasPendingTour(ownerId), false);
  assert.equal(await hasPendingTour(otherId), true);
  assert.equal((await prisma.profile.findUnique({ where: { id: ownerId } })).tourCompletedAt.toISOString(), firstCompletion.toISOString());
  const created = await createRecord(ownerId, input);
  assert.equal(created.value, '225.125');
  assert.equal(created.performedOn, input.performedOn);
  assert.deepEqual(toLegacyRecord(created), {
    move: 'Back Squat', value: 225.125, date: input.performedOn, rm: 3,
    notes: input.notes,
  });
  assert.equal((await listRecords(ownerId)).length, 1);
  assert.equal((await listRecords(otherId)).length, 0);
  await assert.rejects(updateRecord(otherId, created.id, input));
  await assert.rejects(deleteRecord(otherId, created.id));
  for (const invalid of [
    { value: '0' }, { value: '-1' }, { value: '1.2345' }, { value: '1000000000' },
    { performedOn: '2026-02-30' }, { repetitionMax: 2 },
    { movementId: 'unknown-movement' },
  ]) await assert.rejects(createRecord(ownerId, { ...input, ...invalid }));

  const updated = await updateRecord(ownerId, created.id, { ...input, value: '230.500' });
  assert.equal(updated.value, '230.500');
  // Multiple valid records on the same date must remain possible.
  await createRecord(ownerId, input);
  const time = await createRecord(ownerId, {
    movementId: 'fran', value: '285.250', performedOn: '2026-03-01',
  });
  assert.equal(time.repetitionMax, null);
  assert.equal(time.measurementType, 'TIME');
  assert.equal(toLegacyRecord(time).rm, undefined);
  await assert.rejects(createRecord(ownerId, {
    movementId: 'fran', value: 285, performedOn: '2026-03-01', repetitionMax: 1,
  }));

  const directData = {
    profileId: ownerId, movementId: 'back-squat', measurementType: 'WEIGHT',
    value: '225', performedOn: new Date('2026-02-28T00:00:00Z'), repetitionMax: 1,
  };
  // Bypass input validation to prove the database enforces its own constraints.
  for (const invalid of [
    { value: 0 }, { value: -1 }, { repetitionMax: null }, { repetitionMax: 2 },
    { measurementType: 'TIME', repetitionMax: null }, { profileId: randomUUID() },
    { movementId: 'fran', measurementType: 'TIME', repetitionMax: 1 },
  ]) await assert.rejects(prisma.personalRecord.create({ data: { ...directData, ...invalid } }));
  await assert.rejects(prisma.profile.delete({ where: { id: ownerId } }));
  await assert.rejects(prisma.movement.delete({ where: { id: 'back-squat' } }));
  const protections = await prisma.$queryRaw`
    SELECT relname FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
      AND relname IN ('Profile', 'Movement', 'PersonalRecord')
  `;
  assert.equal(protections.length, 3);
  await deleteRecord(ownerId, created.id);
  assert.equal((await listRecords(ownerId)).some((record) => record.id === created.id), false);

  // Custom movements are private, can be hidden or deleted by their owner, and shared ones cannot be deleted.
  const custom = await createMovement(ownerId, { name: 'Test Thruster', measurementType: 'WEIGHT' });
  const theirs = await createMovement(otherId, { name: 'Test Thruster', measurementType: 'WEIGHT' });
  assert.notEqual(custom.id, theirs.id);
  const customRecord = { movementName: 'Test Thruster', value: '95', performedOn: '2026-03-02', repetitionMax: 5 };
  assert.equal((await createRecord(ownerId, customRecord)).movementId, custom.id);
  assert.equal((await createRecord(otherId, customRecord)).movementId, theirs.id);
  await assert.rejects(createRecord(otherId, { ...customRecord, movementName: undefined, movementId: custom.id }));
  await assert.rejects(createRecord(ownerId, { ...customRecord, repetitionMax: 2 }));
  await assert.rejects(prisma.movement.create({
    data: { id: 'duplicate-squat', name: 'Back Squat', category: 'LIFT', groupName: 'Squats', measurementType: 'WEIGHT' },
  }));
  await setMovementHidden(ownerId, 'back-squat', true);
  await assert.rejects(createRecord(ownerId, input));
  await createRecord(otherId, input);
  await setMovementHidden(ownerId, 'back-squat', false);
  await createRecord(ownerId, input);
  await assert.rejects(deleteMovement(ownerId, custom.id), MovementConfirmationError);
  await assert.rejects(deleteMovement(ownerId, 'back-squat', true), MovementForbiddenError);
  assert.deepEqual(await deleteMovement(ownerId, custom.id, true), { deletedRecords: 1 });
  assert.equal(await prisma.movement.count({ where: { id: custom.id } }), 0);
  assert.equal((await listRecords(otherId)).some((record) => record.movementId === theirs.id), true);
  console.log('Prisma integration checks passed: catalog, CRUD, ownership filters, constraints, serialization, tour state and custom movements.');
} catch {
  console.error('Prisma integration checks failed. Inspect the isolated test environment privately.');
  process.exitCode = 1;
} finally {
  await prisma.personalRecord.deleteMany({ where: { profileId: { in: [ownerId, otherId] } } });
  await prisma.hiddenMovement.deleteMany({ where: { profileId: { in: [ownerId, otherId] } } });
  await prisma.movement.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } });
  await prisma.profile.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
  await prisma.$disconnect();
}
