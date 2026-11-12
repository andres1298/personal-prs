import 'server-only';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { getPrisma } from './prisma.js';

export const COACH_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GROUP_NAME_MAX = 40;
export const MAX_GROUPS = 30;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// No 0/O or 1/I/L, so a code survives being read aloud or copied by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const codePattern = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
const GROUP_COLORS = ['--b-blue', '--b-pink', '--b-yellow', '--b-green', '--b-lilac', '--b-cyan', '--b-lime'];

/** Codes: not_coach, not_found, invalid_input, invalid_link, own_link, has_coach, limit, has_logs, forbidden. */
export class CoachingError extends Error {
  constructor(code) {
    super(`Coaching error: ${code}`);
    this.code = code;
  }
}

export function requireId(value, code = 'not_found') {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new CoachingError(code);
  return value.toLowerCase();
}

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');
const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const personName = (profile) => profile.displayName || profile.email || 'Sin nombre';

function validatedName(value, max) {
  if (typeof value !== 'string') throw new CoachingError('invalid_input');
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name || name.length > max) throw new CoachingError('invalid_input');
  return name;
}

export async function isCoach(profileId) {
  const profile = await getPrisma().profile.findUnique({ where: { id: requireId(profileId) }, select: { coachSince: true, disabledAt: true } });
  return Boolean(profile?.coachSince && !profile.disabledAt);
}

/** Coaches whose programming and movements the athlete follows right now. */
export async function activeCoachIds(athleteId, db = getPrisma()) {
  const links = await db.coachAthlete.findMany({ where: { athleteId: requireId(athleteId), endedAt: null }, select: { coachId: true } });
  return links.map((link) => link.coachId);
}

/** The gate for every read of an athlete's data by a coach. */
export async function assertCoachOf(coachId, athleteId, db = getPrisma()) {
  const link = await db.coachAthlete.findFirst({
    where: { coachId: requireId(coachId), athleteId: requireId(athleteId), endedAt: null }, select: { id: true },
  });
  if (!link) throw new CoachingError('not_found');
}

async function ownedGroup(db, coachId, groupId) {
  const group = await db.trainingGroup.findFirst({ where: { id: requireId(groupId), coachId, archivedAt: null } });
  if (!group) throw new CoachingError('not_found');
  return group;
}

/** Everything the coach's people screen shows: athletes, former athletes, groups and pending links. */
export async function getOverview(coachId, now = new Date()) {
  const id = requireId(coachId);
  const prisma = getPrisma();
  const person = { select: { id: true, displayName: true, email: true } };
  const [links, groups, invites] = await Promise.all([
    prisma.coachAthlete.findMany({ where: { coachId: id }, include: { athlete: person }, orderBy: { createdAt: 'asc' } }),
    prisma.trainingGroup.findMany({
      where: { coachId: id, archivedAt: null }, include: { members: { select: { athleteId: true } } }, orderBy: { createdAt: 'asc' },
    }),
    prisma.coachInvite.findMany({
      where: { coachId: id, acceptedAt: null, revokedAt: null }, select: { id: true, name: true, groupId: true, expiresAt: true }, orderBy: { createdAt: 'desc' },
    }),
  ]);
  const active = links.filter((link) => !link.endedAt);
  const activeIds = new Set(active.map((link) => link.athleteId));
  const row = (link) => ({ id: link.athleteId, name: personName(link.athlete), email: link.athlete.email, since: link.createdAt });
  // Someone who left and came back is an athlete again, not a former one.
  const former = new Map();
  for (const link of links) {
    if (link.endedAt && !activeIds.has(link.athleteId)) former.set(link.athleteId, { ...row(link), endedAt: link.endedAt, left: link.endedById === link.athleteId });
  }
  return {
    athletes: active.map(row),
    former: [...former.values()],
    groups: groups.map((group) => ({
      id: group.id, name: group.name, color: group.color, joinCode: group.joinCode, memberIds: group.members.map((member) => member.athleteId),
    })),
    invites: invites.map((invite) => ({ ...invite, expired: invite.expiresAt <= now })),
  };
}

export async function createGroup(coachId, input) {
  const id = requireId(coachId);
  const name = validatedName(input?.name, GROUP_NAME_MAX);
  const prisma = getPrisma();
  const count = await prisma.trainingGroup.count({ where: { coachId: id, archivedAt: null } });
  if (count >= MAX_GROUPS) throw new CoachingError('limit');
  const group = await prisma.trainingGroup.create({
    data: { coachId: id, name, color: GROUP_COLORS[count % GROUP_COLORS.length], joinCode: newCode() },
  });
  return { id: group.id, name, color: group.color, joinCode: group.joinCode, memberIds: [] };
}

/** input: { name?, memberIds?, newCode? }. Members must be the coach's active athletes. */
export async function updateGroup(coachId, groupId, input) {
  const id = requireId(coachId);
  if (!input || typeof input !== 'object') throw new CoachingError('invalid_input');
  return getPrisma().$transaction(async (tx) => {
    const group = await ownedGroup(tx, id, groupId);
    const data = {};
    if (input.name !== undefined) data.name = validatedName(input.name, GROUP_NAME_MAX);
    if (input.newCode === true) data.joinCode = newCode();
    if (Object.keys(data).length) await tx.trainingGroup.update({ where: { id: group.id }, data });
    if (input.memberIds !== undefined) {
      if (!Array.isArray(input.memberIds) || input.memberIds.length > 1000) throw new CoachingError('invalid_input');
      const wanted = [...new Set(input.memberIds.map((memberId) => requireId(memberId, 'invalid_input')))];
      const linked = await tx.coachAthlete.count({ where: { coachId: id, endedAt: null, athleteId: { in: wanted } } });
      if (linked !== wanted.length) throw new CoachingError('invalid_input');
      await tx.groupMember.deleteMany({ where: { groupId: group.id, athleteId: { notIn: wanted } } });
      await tx.groupMember.createMany({ data: wanted.map((athleteId) => ({ groupId: group.id, athleteId })), skipDuplicates: true });
    }
    const saved = await tx.trainingGroup.findUnique({ where: { id: group.id }, include: { members: { select: { athleteId: true } } } });
    return { id: saved.id, name: saved.name, color: saved.color, joinCode: saved.joinCode, memberIds: saved.members.map((member) => member.athleteId) };
  });
}

// Archiving keeps the sessions athletes already logged; the group just stops existing for new work.
export async function archiveGroup(coachId, groupId, now = new Date()) {
  const id = requireId(coachId);
  await getPrisma().$transaction(async (tx) => {
    const group = await ownedGroup(tx, id, groupId);
    await tx.groupMember.deleteMany({ where: { groupId: group.id } });
    // The code is unique among all groups, so an archived one gives it up.
    await tx.trainingGroup.update({ where: { id: group.id }, data: { archivedAt: now, joinCode: `archived-${group.id}` } });
  });
}

export async function createInvite(coachId, input, now = new Date()) {
  const id = requireId(coachId);
  const name = validatedName(input?.name, 80);
  const prisma = getPrisma();
  const groupId = input.groupId == null ? null : (await ownedGroup(prisma, id, input.groupId)).id;
  const token = randomBytes(32).toString('base64url');
  const invite = await prisma.coachInvite.create({
    data: { coachId: id, tokenHash: hashToken(token), name, groupId, expiresAt: new Date(now.getTime() + COACH_INVITE_TTL_MS) },
  });
  return { token, invite: { id: invite.id, name, groupId, expiresAt: invite.expiresAt, expired: false } };
}

export async function revokeInvite(coachId, inviteId, now = new Date()) {
  const { count } = await getPrisma().coachInvite.updateMany({
    where: { id: requireId(inviteId), coachId: requireId(coachId), acceptedAt: null, revokedAt: null }, data: { revokedAt: now },
  });
  if (count !== 1) throw new CoachingError('not_found');
}

// A code is either a group's reusable join code or a personal single-use link token.
async function findTarget(db, code, now) {
  if (typeof code !== 'string' || !code || code.length > 100) return null;
  const coach = { select: { id: true, displayName: true, email: true, coachSince: true, disabledAt: true } };
  const groupCode = code.trim().toUpperCase();
  let target = null;
  if (codePattern.test(groupCode)) {
    const group = await db.trainingGroup.findFirst({ where: { joinCode: groupCode, archivedAt: null }, include: { coach } });
    if (group) target = { kind: 'group', coach: group.coach, group };
  } else {
    const invite = await db.coachInvite.findUnique({ where: { tokenHash: hashToken(code) }, include: { coach, group: true } });
    if (invite && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > now) {
      target = { kind: 'invite', coach: invite.coach, invite, group: invite.group?.archivedAt ? null : invite.group };
    }
  }
  // An invitation is only as good as its coach.
  return target && target.coach.coachSince && !target.coach.disabledAt ? target : null;
}

/** What a join page may show before anyone accepts: who invites and to which group. */
export async function describeJoin(code, now = new Date()) {
  const target = await findTarget(getPrisma(), code, now);
  return target && { coachId: target.coach.id, coachName: personName(target.coach), groupName: target.group?.name ?? null };
}

/**
 * Links the athlete to the coach behind `code` and adds them to its group. An athlete follows
 * one coach at a time; the model allows more, so only this check enforces it.
 */
export async function acceptJoin(athleteId, code, now = new Date()) {
  const id = requireId(athleteId);
  return getPrisma().$transaction(async (tx) => {
    const target = await findTarget(tx, code, now);
    if (!target) throw new CoachingError('invalid_link');
    const coachId = target.coach.id;
    if (coachId === id) throw new CoachingError('own_link');
    const current = await tx.coachAthlete.findMany({ where: { athleteId: id, endedAt: null }, select: { coachId: true } });
    if (current.some((link) => link.coachId !== coachId)) throw new CoachingError('has_coach');
    if (target.kind === 'invite') {
      // The conditional update is the single-use gate: only one concurrent request can claim it.
      const claim = await tx.coachInvite.updateMany({
        where: { id: target.invite.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: now, acceptedById: id },
      });
      if (claim.count !== 1) throw new CoachingError('invalid_link');
    }
    if (!current.length) await tx.coachAthlete.create({ data: { coachId, athleteId: id } });
    if (target.group) {
      await tx.groupMember.createMany({ data: [{ groupId: target.group.id, athleteId: id }], skipDuplicates: true });
    }
    return { coachName: personName(target.coach), groupName: target.group?.name ?? null };
  });
}

/**
 * Ends the link, by the athlete leaving or the coach removing them. The athlete leaves the
 * coach's groups; sessions they logged stay theirs, and the coach stops seeing their records.
 */
export async function endLink(actorId, { coachId, athleteId }, now = new Date()) {
  const actor = requireId(actorId);
  const coach = requireId(coachId);
  const athlete = requireId(athleteId);
  if (actor !== coach && actor !== athlete) throw new CoachingError('forbidden');
  await getPrisma().$transaction(async (tx) => {
    const { count } = await tx.coachAthlete.updateMany({
      where: { coachId: coach, athleteId: athlete, endedAt: null }, data: { endedAt: now, endedById: actor },
    });
    if (count !== 1) throw new CoachingError('not_found');
    await tx.groupMember.deleteMany({ where: { athleteId: athlete, group: { coachId: coach } } });
  });
}

/** The athlete's side: who coaches them and in which groups. */
export async function getCoaching(athleteId) {
  const id = requireId(athleteId);
  const prisma = getPrisma();
  const [link, memberships] = await Promise.all([
    prisma.coachAthlete.findFirst({
      where: { athleteId: id, endedAt: null }, include: { coach: { select: { id: true, displayName: true, email: true } } }, orderBy: { createdAt: 'asc' },
    }),
    prisma.groupMember.findMany({ where: { athleteId: id, group: { archivedAt: null } }, select: { group: { select: { name: true } } } }),
  ]);
  if (!link) return null;
  return { id: link.coach.id, name: personName(link.coach), since: link.createdAt, groups: memberships.map((membership) => membership.group.name) };
}
