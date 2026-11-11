import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/server/prisma.js';
import { createRecord, listRecords, upsertProfile } from '../src/lib/server/records.js';
import { createMovement, listMovements } from '../src/lib/server/movements.js';
import { setMemberCoach } from '../src/lib/server/members.js';
import {
  acceptJoin, archiveGroup, assertCoachOf, createGroup, createInvite, describeJoin, endLink, getCoaching, getOverview,
  isCoach, revokeInvite, updateGroup,
} from '../src/lib/server/coaching.js';
import {
  addAthleteComment, addCoachComment, deleteSession, getSessionDetail, hasPlan, listActivity, listCoachSessions, listPlan,
  saveLog, saveSession,
} from '../src/lib/server/training.js';
import { newBlock, newItem } from '../src/lib/training.js';
import { seedMovements } from '../prisma/catalog.mjs';

// Require a deliberate choice of a disposable database; never run against live data.
if (process.env.PRISMA_TEST_DATABASE !== 'disposable') {
  throw new Error('Set PRISMA_TEST_DATABASE=disposable only for an isolated test database.');
}

const prisma = getPrisma();
const [coachId, otherCoachId, anaId, benId] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const ids = [coachId, otherCoachId, anaId, benId];
const code = (expected) => (error) => error?.code === expected;
const session = (target, date, content, published = true) => ({ target, date, title: 'Day', notes: '', content, published });

try {
  await seedMovements(prisma);
  await upsertProfile(coachId, 'Coach');
  await upsertProfile(otherCoachId, 'Other coach');
  await upsertProfile(anaId, 'Ana');
  await upsertProfile(benId, 'Ben');

  // Only an admin grant makes a coach; granting twice keeps the first date.
  assert.equal(await isCoach(coachId), false);
  const granted = new Date('2026-11-01T00:00:00Z');
  await setMemberCoach(coachId, true, granted);
  await setMemberCoach(coachId, true);
  await setMemberCoach(otherCoachId, true);
  assert.equal(await isCoach(coachId), true);
  assert.equal((await prisma.profile.findUnique({ where: { id: coachId } })).coachSince.toISOString(), granted.toISOString());

  // Groups carry a reusable code; a personal link works once.
  const group = await createGroup(coachId, { name: '  Barbell   club ' });
  assert.equal(group.name, 'Barbell club');
  assert.match(group.joinCode, /^[A-Z2-9]{8}$/);
  assert.deepEqual(await describeJoin(group.joinCode.toLowerCase()), { coachId, coachName: 'Coach', groupName: 'Barbell club' });
  assert.equal(await describeJoin('ZZZZZZZZ'), null);
  await assert.rejects(acceptJoin(coachId, group.joinCode), code('own_link'));
  assert.deepEqual(await acceptJoin(anaId, group.joinCode), { coachName: 'Coach', groupName: 'Barbell club' });
  // Joining again through the same code changes nothing.
  await acceptJoin(anaId, group.joinCode);
  const { token, invite } = await createInvite(coachId, { name: 'Ben' });
  assert.equal((await getOverview(coachId)).invites[0].id, invite.id);
  await acceptJoin(benId, token);
  await assert.rejects(acceptJoin(benId, token), code('invalid_link'));
  const revoked = await createInvite(coachId, { name: 'Nobody' });
  await revokeInvite(coachId, revoked.invite.id);
  assert.equal(await describeJoin(revoked.token), null);
  await assert.rejects(revokeInvite(otherCoachId, invite.id), code('not_found'));

  // One coach at a time in this version.
  const otherGroup = await createGroup(otherCoachId, { name: 'Other' });
  await assert.rejects(acceptJoin(anaId, otherGroup.joinCode), code('has_coach'));

  let overview = await getOverview(coachId);
  assert.deepEqual(overview.athletes.map((athlete) => athlete.name), ['Ana', 'Ben']);
  assert.deepEqual(overview.groups[0].memberIds, [anaId]);
  assert.deepEqual(overview.invites, []);
  assert.deepEqual(await getCoaching(anaId).then((coach) => [coach.name, coach.groups]), ['Coach', ['Barbell club']]);

  // Members must be the coach's own athletes; a new code retires the old one.
  await assert.rejects(updateGroup(coachId, group.id, { memberIds: [randomUUID()] }), code('invalid_input'));
  await assert.rejects(updateGroup(otherCoachId, group.id, { name: 'Stolen' }), code('not_found'));
  const updated = await updateGroup(coachId, group.id, { memberIds: [anaId, benId], newCode: true });
  assert.deepEqual(updated.memberIds.sort(), [anaId, benId].sort());
  assert.notEqual(updated.joinCode, group.joinCode);
  assert.equal(await describeJoin(group.joinCode), null);

  // A coach reads an athlete's records only while linked; other coaches never do.
  await createRecord(anaId, { movementName: 'Back Squat', value: 200, performedOn: '2026-10-01', repetitionMax: 1 });
  await assertCoachOf(coachId, anaId);
  await assert.rejects(assertCoachOf(otherCoachId, anaId), code('not_found'));

  // The coach's own movements reach their athletes, who can record on them.
  const complex = await createMovement(coachId, { name: `Clean + 2 Jerks ${coachId.slice(0, 6)}`, category: 'LIFT' });
  const shared = (await listMovements(anaId)).find((movement) => movement.id === complex.id);
  assert.deepEqual([shared.custom, shared.fromCoach], [false, true]);
  await createRecord(anaId, { movementName: complex.name, value: 135, performedOn: '2026-10-02', repetitionMax: 1 });
  assert.equal((await listMovements(randomUUID())).some((movement) => movement.id === complex.id), false);

  // Programming: a group day with a daily maximum and a percentage of it, and a 1:1 draft.
  const maxLine = newItem({ movement: complex.name, sets: null, reps: '1', load: { type: 'max', value: null, base: null } });
  const backOff = newItem({ movement: complex.name, sets: 3, reps: '1', load: { type: 'percent', value: 85, base: { kind: 'item', itemId: maxLine.id } }, log: true });
  const wod = newBlock({ title: 'WOD', notes: '21-15-9', score: 'time' });
  const content = { blocks: [newBlock({ title: 'A', notes: 'RPE 8', items: [maxLine, backOff] }), wod] };
  const saved = await saveSession(coachId, session({ groupId: group.id }, '2026-11-10', content));
  assert.deepEqual([saved.published, saved.logged], [true, 0]);
  await assert.rejects(saveSession(coachId, session({ groupId: group.id }, '2026-11-10', { blocks: [newBlock({ items: [{ ...backOff }] })] })), /earlier/);
  await assert.rejects(saveSession(otherCoachId, session({ groupId: group.id }, '2026-11-10', content)), code('not_found'));
  await assert.rejects(saveSession(otherCoachId, session({ athleteId: anaId }, '2026-11-10', content)), code('not_found'));
  await assert.rejects(saveSession(coachId, session({ groupId: group.id, athleteId: anaId }, '2026-11-10', content)), code('invalid_input'));
  const draft = await saveSession(coachId, session({ athleteId: anaId }, '2026-11-11', { blocks: [] }, false));
  // A past day can be programmed too.
  await saveSession(coachId, session({ athleteId: anaId }, '2025-01-05', { blocks: [] }));

  // The athlete sees published sessions of their coach and groups, never drafts or other athletes' days.
  let plan = await listPlan(anaId, '2026-11-01', '2026-11-30');
  assert.deepEqual(plan.map((entry) => [entry.date, entry.group?.name ?? null]), [['2026-11-10', 'Barbell club']]);
  assert.deepEqual(await listPlan(benId, '2025-01-01', '2025-01-31'), []);
  assert.deepEqual((await listPlan(anaId, '2025-01-01', '2025-01-31')).map((entry) => entry.date), ['2025-01-05']);
  assert.deepEqual(await listPlan(randomUUID(), '2026-11-01', '2026-11-30'), []);
  await assert.rejects(saveLog(anaId, draft.id, { completed: true }), code('not_found'));
  await assert.rejects(saveLog(randomUUID(), saved.id, { completed: true }), code('not_found'));
  await assert.rejects(listPlan(anaId, '2020-01-01', '2026-11-30'), code('invalid_input'));

  // Logging, finishing and the private comment thread.
  const results = { items: { [maxLine.id]: { weight: 150, reps: 1 } }, blocks: { [wod.id]: { value: 312 } } };
  const firstFinish = new Date('2026-11-10T18:00:00Z');
  await saveLog(anaId, saved.id, { results, completed: true }, firstFinish);
  const again = await saveLog(anaId, saved.id, { completed: true });
  assert.equal(again.completedAt.toISOString(), firstFinish.toISOString());
  await assert.rejects(saveLog(anaId, saved.id, { results: { items: { nope: { weight: 1 } } } }), /id/);
  await addAthleteComment(anaId, saved.id, ' Felt heavy ');
  await addCoachComment(coachId, saved.id, anaId, 'Good work');
  await assert.rejects(addCoachComment(otherCoachId, saved.id, anaId, 'Hi'), code('not_found'));
  await assert.rejects(addAthleteComment(anaId, saved.id, '   '), code('invalid_input'));
  plan = await listPlan(anaId, '2026-11-10', '2026-11-10');
  assert.deepEqual(plan[0].results, results);
  assert.deepEqual([plan[0].comments.map((comment) => comment.body), plan[0].unread], [['Felt heavy', 'Good work'], 1]);
  await saveLog(anaId, saved.id, { seen: true });
  assert.equal((await listPlan(anaId, '2026-11-10', '2026-11-10'))[0].unread, 0);
  // Ben is in the same group and sees neither Ana's results nor her thread.
  const bens = (await listPlan(benId, '2026-11-10', '2026-11-10'))[0];
  assert.deepEqual([bens.results, bens.comments], [{ items: {}, blocks: {} }, []]);

  // The coach sees each athlete's results and thread, and the activity of the last days.
  const detail = await getSessionDetail(coachId, saved.id);
  assert.deepEqual(detail.athletes.map((athlete) => [athlete.name, Boolean(athlete.completedAt), athlete.comments.length]), [['Ana', true, 2], ['Ben', false, 0]]);
  await assert.rejects(getSessionDetail(otherCoachId, saved.id), code('not_found'));
  const events = await listActivity(coachId, new Date('2026-11-12T00:00:00Z'));
  assert.deepEqual(events.map((event) => [event.kind, event.athleteName]).sort(), [['comment', 'Ana'], ['completed', 'Ana']]);
  assert.deepEqual(await listActivity(otherCoachId), []);

  // Editing a logged session keeps the athlete's results; deleting it is refused.
  const edited = await saveSession(coachId, session({ groupId: group.id }, '2026-11-10', { blocks: [newBlock({ title: 'Changed' })] }));
  assert.deepEqual([edited.id, edited.logged, edited.completed], [saved.id, 1, 1]);
  assert.deepEqual((await listPlan(anaId, '2026-11-10', '2026-11-10'))[0].results, results);
  await assert.rejects(deleteSession(coachId, saved.id), code('has_logs'));
  await assert.rejects(deleteSession(otherCoachId, draft.id), code('not_found'));
  await deleteSession(coachId, draft.id);
  assert.deepEqual((await listCoachSessions(coachId, { groupId: group.id }, '2026-11-01', '2026-11-30')).map((entry) => entry.logged), [1]);

  // Leaving: the athlete keeps what they logged and their records; the coach loses access and keeps a history row.
  await assert.rejects(endLink(otherCoachId, { coachId, athleteId: anaId }), code('forbidden'));
  await endLink(anaId, { coachId, athleteId: anaId });
  assert.equal(await getCoaching(anaId), null);
  assert.equal(await hasPlan(anaId), true);
  assert.deepEqual(await listPlan(anaId, '2025-01-01', '2025-01-31'), []);
  assert.deepEqual((await listPlan(anaId, '2026-11-01', '2026-11-30')).map((entry) => entry.date), ['2026-11-10']);
  await assert.rejects(assertCoachOf(coachId, anaId), code('not_found'));
  assert.equal((await listRecords(anaId)).length, 2);
  overview = await getOverview(coachId);
  assert.deepEqual(overview.athletes.map((athlete) => athlete.name), ['Ben']);
  assert.deepEqual(overview.former.map((athlete) => [athlete.name, athlete.left]), [['Ana', true]]);
  assert.deepEqual((await getSessionDetail(coachId, saved.id)).athletes.map((athlete) => athlete.name), ['Ben']);
  assert.deepEqual(await listActivity(coachId, new Date('2026-11-12T00:00:00Z')), []);
  // Free again, Ana can follow another coach.
  await acceptJoin(anaId, otherGroup.joinCode);

  // Without the coach role their codes stop working; nothing is deleted.
  await endLink(coachId, { coachId, athleteId: benId });
  assert.equal(await hasPlan(benId), false);
  await setMemberCoach(coachId, false);
  assert.equal(await describeJoin(updated.joinCode), null);
  await archiveGroup(otherCoachId, otherGroup.id);
  assert.deepEqual((await getOverview(otherCoachId)).groups, []);

  // Every new table denies the Data API.
  const tables = ['CoachAthlete', 'TrainingGroup', 'GroupMember', 'CoachInvite', 'TrainingSession', 'SessionLog', 'SessionComment'];
  const rls = await prisma.$queryRaw`SELECT relname FROM pg_class WHERE relrowsecurity AND relname = ANY(${tables})`;
  assert.equal(rls.length, tables.length);
  console.log('Coaching integration checks passed.');
} finally {
  await prisma.sessionComment.deleteMany({ where: { session: { coachId: { in: ids } } } });
  await prisma.sessionLog.deleteMany({ where: { athleteId: { in: ids } } });
  await prisma.trainingSession.deleteMany({ where: { coachId: { in: ids } } });
  await prisma.coachInvite.deleteMany({ where: { coachId: { in: ids } } });
  await prisma.groupMember.deleteMany({ where: { athleteId: { in: ids } } });
  await prisma.trainingGroup.deleteMany({ where: { coachId: { in: ids } } });
  await prisma.coachAthlete.deleteMany({ where: { coachId: { in: ids } } });
  await prisma.personalRecord.deleteMany({ where: { profileId: { in: ids } } });
  await prisma.movement.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.profile.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}
