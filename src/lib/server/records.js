import 'server-only';
import { getPrisma } from './prisma.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Shared weight movements plus the custom movement limit, times the three repetition maximums.
export const MAX_BULK_RECORDS = (21 + 30) * 3;

export class RecordInputError extends Error {}
export class RecordConflictError extends Error {}

function requireProfileId(profileId) {
  if (typeof profileId !== 'string' || !uuidPattern.test(profileId)) {
    throw new Error('A verified Auth user ID is required.');
  }
  return profileId.toLowerCase();
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new RecordInputError(`${field} must be text.`);
  return value.trim() || null;
}

function recordDto(record) {
  return {
    id: record.id,
    movementId: record.movementId,
    movementName: record.movement.name,
    measurementType: record.measurementType,
    value: record.value.toFixed(3),
    performedOn: record.performedOn.toISOString().slice(0, 10),
    repetitionMax: record.repetitionMax,
    notes: record.notes,
  };
}

// A record may use a shared movement or one the member owns, found by id or by name,
// and never one the member turned off.
async function findMovement(profileId, input) {
  const key = typeof input.movementId === 'string' ? { id: input.movementId }
    : typeof input.movementName === 'string' ? { name: input.movementName } : null;
  if (!key) throw new RecordInputError('Unknown movement.');
  const prisma = getPrisma();
  const movement = await prisma.movement.findFirst({ where: { ...key, OR: [{ ownerId: null }, { ownerId: profileId }] } });
  if (!movement) throw new RecordInputError('Unknown movement.');
  const hidden = await prisma.hiddenMovement.findUnique({ where: { profileId_movementId: { profileId, movementId: movement.id } } });
  if (hidden) throw new RecordInputError('This movement is turned off.');
  return movement;
}

async function validatedRecord(profileId, input) {
  if (!input || typeof input !== 'object') throw new RecordInputError('Record input is required.');
  const movement = await findMovement(profileId, input);

  const value = String(input.value);
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(value) || Number(value) <= 0) {
    throw new RecordInputError('Value must be positive with at most nine integer and three decimal digits.');
  }
  if (typeof input.performedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.performedOn)) {
    throw new RecordInputError('Performed date must use YYYY-MM-DD.');
  }
  const performedOn = new Date(`${input.performedOn}T00:00:00.000Z`);
  if (input.performedOn.startsWith('0000') || !Number.isFinite(performedOn.getTime()) || performedOn.toISOString().slice(0, 10) !== input.performedOn) {
    throw new RecordInputError('Performed date is invalid.');
  }
  const repetitionMax = input.repetitionMax ?? null;
  if (movement.measurementType === 'WEIGHT' ? ![1, 3, 5].includes(repetitionMax) : repetitionMax !== null) {
    throw new RecordInputError('Weight records require 1, 3 or 5 repetitions; time records have none.');
  }
  return {
    movementId: movement.id,
    measurementType: movement.measurementType,
    value,
    performedOn,
    repetitionMax,
    notes: optionalText(input.notes, 'Notes'),
  };
}

// Internal persistence API: callers must obtain identity from verified Auth,
// never from a browser-supplied owner. Public integration belongs to issues #5/#6/#7.
export async function findProfile(authUserId) {
  return getPrisma().profile.findUnique({ where: { id: requireProfileId(authUserId) }, select: { id: true, disabledAt: true } });
}

// True while the member has not finished or skipped the guided tour.
export async function hasPendingTour(authUserId) {
  const profile = await getPrisma().profile.findUnique({ where: { id: requireProfileId(authUserId) }, select: { tourCompletedAt: true } });
  return Boolean(profile && !profile.tourCompletedAt);
}

// Only the first completion is kept; replays from Settings do not change it.
export async function completeTour(authUserId, now = new Date()) {
  await getPrisma().profile.updateMany({ where: { id: requireProfileId(authUserId), tourCompletedAt: null }, data: { tourCompletedAt: now } });
}

export async function ensureAdminProfile(user) {
  const id = requireProfileId(user?.id);
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : null;
  // Select only what callers use, so columns from pending migrations are never read.
  await getPrisma().profile.upsert({ where: { id }, create: { id, email }, update: {}, select: { id: true } });
}

// Self-service sign-ups get their profile once the caller has checked the confirmed email.
// Existing profiles (and their disabled state) are never touched.
export async function ensureMemberProfile(user) {
  const id = requireProfileId(user?.id);
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : null;
  const fullName = user.user_metadata?.full_name;
  const displayName = typeof fullName === 'string' ? fullName.trim().slice(0, 80) || null : null;
  await getPrisma().profile.upsert({ where: { id }, create: { id, email, displayName }, update: {}, select: { id: true } });
}

export async function upsertProfile(authUserId, displayName = null) {
  const id = requireProfileId(authUserId);
  const name = optionalText(displayName, 'Display name');
  const profile = await getPrisma().profile.upsert({
    where: { id }, create: { id, displayName: name }, update: { displayName: name }, select: { id: true, displayName: true },
  });
  return { id: profile.id, displayName: profile.displayName };
}

export async function listRecords(authUserId) {
  const profileId = requireProfileId(authUserId);
  const records = await getPrisma().personalRecord.findMany({
    where: { profileId }, include: { movement: true },
    orderBy: [{ performedOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });
  return records.map(recordDto);
}

export async function createRecord(authUserId, input) {
  const profileId = requireProfileId(authUserId);
  const data = await validatedRecord(profileId, input);
  const record = await getPrisma().personalRecord.create({
    data: { ...data, profileId }, include: { movement: true },
  });
  return recordDto(record);
}

// Quick upload only fills gaps: every movement and repetition pair must be new for the owner.
export async function createRecords(authUserId, inputs) {
  const profileId = requireProfileId(authUserId);
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > MAX_BULK_RECORDS) {
    throw new RecordInputError(`Provide between 1 and ${MAX_BULK_RECORDS} records.`);
  }
  const records = [];
  const pairs = new Set();
  for (const input of inputs) {
    const data = await validatedRecord(profileId, input);
    if (data.measurementType !== 'WEIGHT') throw new RecordInputError('Quick upload accepts weight records only.');
    const pair = `${data.movementId}:${data.repetitionMax}`;
    if (pairs.has(pair)) throw new RecordInputError('Each movement and repetition pair may appear once.');
    pairs.add(pair);
    records.push(data);
  }
  try {
    return await getPrisma().$transaction(async (tx) => {
      const existing = await tx.personalRecord.findFirst({
        where: { profileId, OR: records.map(({ movementId, repetitionMax }) => ({ movementId, repetitionMax })) },
        select: { id: true },
      });
      if (existing) throw new RecordConflictError('A movement and repetition pair already has a record.');
      const created = [];
      for (const data of records) {
        created.push(await tx.personalRecord.create({ data: { ...data, profileId }, include: { movement: true } }));
      }
      return created.map(recordDto);
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    // P2034: a concurrent save touched the same rows; treat it like an existing record.
    if (error?.code === 'P2034') throw new RecordConflictError('A concurrent save created conflicting records.');
    throw error;
  }
}

export async function updateRecord(authUserId, recordId, input) {
  const profileId = requireProfileId(authUserId);
  const data = await validatedRecord(profileId, input);
  const record = await getPrisma().personalRecord.update({
    where: { id: recordId, profileId }, data, include: { movement: true },
  });
  return recordDto(record);
}

export async function deleteRecord(authUserId, recordId) {
  const profileId = requireProfileId(authUserId);
  await getPrisma().personalRecord.delete({ where: { id: recordId, profileId } });
}

export function toLegacyRecord(record) {
  return {
    move: record.movementName,
    value: Number(record.value),
    date: record.performedOn,
    ...(record.repetitionMax === null ? {} : { rm: record.repetitionMax }),
    notes: record.notes ?? '',
  };
}
