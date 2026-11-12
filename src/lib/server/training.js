import 'server-only';
import { getPrisma } from './prisma.js';
import { activeCoachIds, assertCoachOf, CoachingError, requireId } from './coaching.js';
import { emptyResults, isDate, LIMITS, normalizeContent, normalizeResults } from '../training.js';

const MAX_RANGE_DAYS = 400;
const ACTIVITY_DAYS = 14;
const day = (date) => date.toISOString().slice(0, 10);
const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
const personName = (profile) => profile.displayName || profile.email || 'Sin nombre';

function range(from, to) {
  if (!isDate(from) || !isDate(to) || from > to || (toDate(to) - toDate(from)) / 86400000 > MAX_RANGE_DAYS) throw new CoachingError('invalid_input');
  return { gte: toDate(from), lte: toDate(to) };
}

function optionalText(value, max) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > max) throw new CoachingError('invalid_input');
  return value.trim() || null;
}

function commentBody(value) {
  const body = typeof value === 'string' ? value.trim() : '';
  if (!body || body.length > LIMITS.comment) throw new CoachingError('invalid_input');
  return body;
}

const commentDto = (comment) => ({ id: comment.id, authorId: comment.authorId, body: comment.body, createdAt: comment.createdAt });

function sessionDto(session) {
  return {
    id: session.id, date: day(session.date), title: session.title ?? '', notes: session.notes ?? '',
    content: session.content, published: Boolean(session.publishedAt),
  };
}

/* ---------- Coach ---------- */

// target: { groupId } or { athleteId }; the group must be the coach's and the athlete actively linked.
async function resolveTarget(db, coachId, target) {
  if (target?.groupId != null && target.athleteId == null) {
    const group = await db.trainingGroup.findFirst({ where: { id: requireId(target.groupId), coachId, archivedAt: null }, select: { id: true } });
    if (!group) throw new CoachingError('not_found');
    return { groupId: group.id, athleteId: null };
  }
  if (target?.athleteId != null && target.groupId == null) {
    await assertCoachOf(coachId, target.athleteId, db);
    return { groupId: null, athleteId: requireId(target.athleteId) };
  }
  throw new CoachingError('invalid_input');
}

/** A target's sessions between two dates, each with how many athletes logged and finished it. */
export async function listCoachSessions(coachId, target, from, to) {
  const id = requireId(coachId);
  const prisma = getPrisma();
  const where = await resolveTarget(prisma, id, target);
  const sessions = await prisma.trainingSession.findMany({
    where: { coachId: id, ...where, date: range(from, to) },
    include: { logs: { select: { completedAt: true } } }, orderBy: { date: 'asc' },
  });
  return sessions.map((session) => ({
    ...sessionDto(session), logged: session.logs.length, completed: session.logs.filter((log) => log.completedAt).length,
  }));
}

/**
 * Creates or replaces the session of one target and day. Any date is allowed, past ones included.
 * Results athletes already logged are kept untouched; `logged` tells the coach how many there are.
 */
export async function saveSession(coachId, input, now = new Date()) {
  const id = requireId(coachId);
  if (!input || typeof input !== 'object' || !isDate(input.date) || typeof input.published !== 'boolean') throw new CoachingError('invalid_input');
  const content = normalizeContent(input.content);
  const data = { title: optionalText(input.title, LIMITS.title), notes: optionalText(input.notes, LIMITS.notes), content };
  const date = toDate(input.date);
  return getPrisma().$transaction(async (tx) => {
    const target = await resolveTarget(tx, id, input.target);
    const existing = await tx.trainingSession.findFirst({ where: { coachId: id, ...target, date }, include: { logs: { select: { completedAt: true } } } });
    // The first publication time is kept through later edits.
    const publishedAt = input.published ? existing?.publishedAt ?? now : null;
    const session = existing
      ? await tx.trainingSession.update({ where: { id: existing.id }, data: { ...data, publishedAt } })
      : await tx.trainingSession.create({ data: { ...data, publishedAt, coachId: id, ...target, date } });
    const logs = existing?.logs ?? [];
    return { ...sessionDto(session), logged: logs.length, completed: logs.filter((log) => log.completedAt).length };
  });
}

// A session athletes already logged cannot be deleted: their results would go with it.
export async function deleteSession(coachId, sessionId) {
  const where = { id: requireId(sessionId), coachId: requireId(coachId) };
  await getPrisma().$transaction(async (tx) => {
    const session = await tx.trainingSession.findFirst({ where, select: { id: true, _count: { select: { logs: true } } } });
    if (!session) throw new CoachingError('not_found');
    if (session._count.logs > 0) throw new CoachingError('has_logs');
    await tx.trainingSession.delete({ where: { id: session.id } });
  });
}

// Athletes the coach may read in a session: its target while linked, never former athletes.
async function sessionAthletes(db, session) {
  const person = { select: { id: true, displayName: true, email: true } };
  const links = await db.coachAthlete.findMany({
    where: {
      coachId: session.coachId, endedAt: null,
      athlete: session.groupId ? { groupMemberships: { some: { groupId: session.groupId } } } : { id: session.athleteId },
    },
    include: { athlete: person }, orderBy: { createdAt: 'asc' },
  });
  return links.map((link) => link.athlete);
}

/** One session with each current athlete's results and comment thread. */
export async function getSessionDetail(coachId, sessionId) {
  const prisma = getPrisma();
  const session = await prisma.trainingSession.findFirst({
    where: { id: requireId(sessionId), coachId: requireId(coachId) },
    include: { logs: true, comments: { orderBy: { createdAt: 'asc' } } },
  });
  if (!session) throw new CoachingError('not_found');
  const athletes = await sessionAthletes(prisma, session);
  return {
    ...sessionDto(session),
    athletes: athletes.map((athlete) => {
      const log = session.logs.find((entry) => entry.athleteId === athlete.id);
      return {
        id: athlete.id, name: personName(athlete), results: log?.results ?? emptyResults(), completedAt: log?.completedAt ?? null,
        comments: session.comments.filter((comment) => comment.athleteId === athlete.id).map(commentDto),
      };
    }),
  };
}

export async function addCoachComment(coachId, sessionId, athleteId, body) {
  const prisma = getPrisma();
  const session = await prisma.trainingSession.findFirst({ where: { id: requireId(sessionId), coachId: requireId(coachId) } });
  if (!session) throw new CoachingError('not_found');
  const athletes = await sessionAthletes(prisma, session);
  const target = requireId(athleteId);
  if (!athletes.some((athlete) => athlete.id === target)) throw new CoachingError('not_found');
  return commentDto(await prisma.sessionComment.create({ data: { sessionId: session.id, athleteId: target, authorId: session.coachId, body: commentBody(body) } }));
}

/** Recent completions and athlete comments on the coach's sessions, newest first. */
export async function listActivity(coachId, now = new Date()) {
  const id = requireId(coachId);
  const prisma = getPrisma();
  const since = new Date(now.getTime() - ACTIVITY_DAYS * 86400000);
  const athleteIds = (await prisma.coachAthlete.findMany({ where: { coachId: id, endedAt: null }, select: { athleteId: true } })).map((link) => link.athleteId);
  const session = { select: { id: true, date: true, title: true, groupId: true, athleteId: true } };
  const athlete = { select: { displayName: true, email: true } };
  const [logs, comments] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { athleteId: { in: athleteIds }, completedAt: { gte: since }, session: { coachId: id } },
      include: { session, athlete }, orderBy: { completedAt: 'desc' }, take: 50,
    }),
    prisma.sessionComment.findMany({
      where: { athleteId: { in: athleteIds }, authorId: { in: athleteIds }, createdAt: { gte: since }, session: { coachId: id } },
      include: { session, author: athlete }, orderBy: { createdAt: 'desc' }, take: 50,
    }),
  ]);
  const event = (kind, at, athleteId, person, row, body) => ({
    kind, at, athleteId, athleteName: personName(person), body,
    session: { id: row.id, date: day(row.date), title: row.title ?? '', groupId: row.groupId, athleteId: row.athleteId },
  });
  return [
    ...logs.map((log) => event('completed', log.completedAt, log.athleteId, log.athlete, log.session)),
    ...comments.map((comment) => event('comment', comment.createdAt, comment.athleteId, comment.author, comment.session, comment.body)),
  ].sort((a, b) => b.at - a.at).slice(0, 50);
}

/**
 * The raw material of the coach's progress panels between two dates: their current athletes,
 * the published sessions, what those athletes logged and their records. Former athletes are
 * left out entirely, like everywhere else.
 */
export async function getCoachStats(coachId, from, to) {
  const id = requireId(coachId);
  const prisma = getPrisma();
  const dates = range(from, to);
  const [links, groups] = await Promise.all([
    prisma.coachAthlete.findMany({
      where: { coachId: id, endedAt: null }, orderBy: { createdAt: 'asc' },
      include: { athlete: { select: { id: true, displayName: true, email: true, groupMemberships: { where: { group: { coachId: id, archivedAt: null } }, select: { groupId: true } } } } },
    }),
    prisma.trainingGroup.findMany({ where: { coachId: id, archivedAt: null }, select: { id: true, name: true, color: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const athleteIds = links.map((link) => link.athleteId);
  const [sessions, records] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { coachId: id, date: dates, publishedAt: { not: null } }, orderBy: { date: 'asc' },
      include: { logs: { where: { athleteId: { in: athleteIds } }, select: { athleteId: true, completedAt: true, results: true } } },
    }),
    prisma.personalRecord.findMany({
      where: { profileId: { in: athleteIds } }, orderBy: { performedOn: 'asc' },
      select: { profileId: true, value: true, performedOn: true, repetitionMax: true, movement: { select: { name: true } } },
    }),
  ]);
  return {
    athletes: links.map((link) => ({
      id: link.athleteId, name: personName(link.athlete), since: day(link.createdAt), groupIds: link.athlete.groupMemberships.map((membership) => membership.groupId),
    })),
    groups,
    sessions: sessions.map((session) => ({ id: session.id, date: day(session.date), title: session.title ?? '', groupId: session.groupId, athleteId: session.athleteId, content: session.content })),
    logs: sessions.flatMap((session) => session.logs.map((log) => ({ sessionId: session.id, ...log }))),
    records: records.map((record) => ({ athleteId: record.profileId, move: record.movement.name, value: Number(record.value), rm: record.repetitionMax, date: day(record.performedOn) })),
  };
}

/* ---------- Athlete ---------- */

// Published sessions of the athlete's current coaches and groups, plus any session they logged:
// what they did stays theirs after leaving a coach or a group.
async function visibleWhere(db, athleteId) {
  const coachIds = await activeCoachIds(athleteId, db);
  return {
    OR: [
      { publishedAt: { not: null }, athleteId, coachId: { in: coachIds } },
      { publishedAt: { not: null }, group: { archivedAt: null, members: { some: { athleteId } } } },
      { logs: { some: { athleteId } } },
    ],
  };
}

async function visibleSession(db, athleteId, sessionId) {
  const session = await db.trainingSession.findFirst({ where: { id: requireId(sessionId), ...(await visibleWhere(db, athleteId)) } });
  if (!session) throw new CoachingError('not_found');
  return session;
}

/** True when the athlete has a coach or a history of sessions, so the plan tab has something to show. */
export async function hasPlan(athleteId) {
  const id = requireId(athleteId);
  const prisma = getPrisma();
  if ((await activeCoachIds(id, prisma)).length) return true;
  return Boolean(await prisma.sessionLog.findFirst({ where: { athleteId: id }, select: { sessionId: true } }));
}

/** The athlete's sessions between two dates with their own results, comments and unread count. */
export async function listPlan(athleteId, from, to) {
  const id = requireId(athleteId);
  const prisma = getPrisma();
  const sessions = await prisma.trainingSession.findMany({
    where: { date: range(from, to), ...(await visibleWhere(prisma, id)) },
    include: {
      group: { select: { name: true, color: true } },
      logs: { where: { athleteId: id } },
      comments: { where: { athleteId: id }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return sessions.map((session) => {
    const log = session.logs[0];
    const seenAt = log?.seenAt ?? new Date(0);
    return {
      ...sessionDto(session),
      group: session.group,
      results: log?.results ?? emptyResults(), completedAt: log?.completedAt ?? null,
      comments: session.comments.map(commentDto),
      unread: session.comments.filter((comment) => comment.authorId !== id && comment.createdAt > seenAt).length,
    };
  });
}

/** input: { results?, completed?, seen? }. Only the given parts change. */
export async function saveLog(athleteId, sessionId, input, now = new Date()) {
  const id = requireId(athleteId);
  if (!input || typeof input !== 'object') throw new CoachingError('invalid_input');
  const data = {};
  if (input.results !== undefined) data.results = normalizeResults(input.results);
  if (input.completed !== undefined) {
    if (typeof input.completed !== 'boolean') throw new CoachingError('invalid_input');
    data.completedAt = input.completed ? now : null;
  }
  if (input.seen === true) data.seenAt = now;
  if (!Object.keys(data).length) throw new CoachingError('invalid_input');
  const prisma = getPrisma();
  const session = await visibleSession(prisma, id, sessionId);
  const key = { sessionId_athleteId: { sessionId: session.id, athleteId: id } };
  // Finishing twice keeps the first time, which is the one the coach's activity shows.
  if (data.completedAt) {
    const existing = await prisma.sessionLog.findUnique({ where: key, select: { completedAt: true } });
    if (existing?.completedAt) data.completedAt = existing.completedAt;
  }
  const log = await prisma.sessionLog.upsert({
    where: key, update: data, create: { sessionId: session.id, athleteId: id, results: emptyResults(), ...data },
  });
  return { results: log.results, completedAt: log.completedAt };
}

export async function addAthleteComment(athleteId, sessionId, body) {
  const id = requireId(athleteId);
  const prisma = getPrisma();
  const session = await visibleSession(prisma, id, sessionId);
  return commentDto(await prisma.sessionComment.create({ data: { sessionId: session.id, athleteId: id, authorId: id, body: commentBody(body) } }));
}
