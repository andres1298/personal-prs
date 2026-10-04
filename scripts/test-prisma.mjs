import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/server/prisma.js';
import { createRecord, listRecords, updateRecord, deleteRecord, upsertProfile, toLegacyRecord } from '../src/lib/server/records.js';
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
  notes: 'Test record', videoUrl: 'https://example.com/test-video', videoId: 'test-video',
};

try {
  await seedMovements(prisma);
  await seedMovements(prisma);
  assert.equal(await prisma.movement.count(), movementCatalog.length);
  await upsertProfile(ownerId, 'Test owner');
  await upsertProfile(ownerId, 'Updated owner');
  await upsertProfile(otherId, 'Other owner');
  const created = await createRecord(ownerId, input);
  assert.equal(created.value, '225.125');
  assert.equal(created.performedOn, input.performedOn);
  assert.equal(created.videoId, input.videoId);
  assert.equal(created.videoUrl, input.videoUrl);
  assert.deepEqual(toLegacyRecord(created), {
    move: 'Back Squat', value: 225.125, date: input.performedOn, rm: 3,
    notes: input.notes, video: input.videoUrl, videoId: input.videoId,
  });
  assert.equal((await listRecords(ownerId)).length, 1);
  assert.equal((await listRecords(otherId)).length, 0);
  await assert.rejects(updateRecord(otherId, created.id, input));
  await assert.rejects(deleteRecord(otherId, created.id));
  for (const invalid of [
    { value: '0' }, { value: '-1' }, { value: '1.2345' }, { value: '1000000000' },
    { performedOn: '2026-02-30' }, { repetitionMax: 2 }, { videoUrl: 'javascript:alert(1)' },
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
  console.log('Prisma integration checks passed: catalog, CRUD, ownership filters, constraints and serialization.');
} catch {
  console.error('Prisma integration checks failed. Inspect the isolated test environment privately.');
  process.exitCode = 1;
} finally {
  await prisma.personalRecord.deleteMany({ where: { profileId: { in: [ownerId, otherId] } } });
  await prisma.profile.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
  await prisma.$disconnect();
}
