import 'server-only';
import { getPrisma } from './prisma.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireProfileId(profileId) {
  if (typeof profileId !== 'string' || !uuidPattern.test(profileId)) {
    throw new Error('A verified Auth user ID is required.');
  }
  return profileId.toLowerCase();
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
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
    videoUrl: record.videoUrl,
    videoId: record.videoId,
  };
}

async function validatedRecord(input) {
  if (!input || typeof input !== 'object') throw new Error('Record input is required.');
  const movement = await getPrisma().movement.findUnique({ where: { id: input.movementId } });
  if (!movement) throw new Error('Unknown movement.');

  const value = String(input.value);
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(value) || Number(value) <= 0) {
    throw new Error('Value must be positive with at most nine integer and three decimal digits.');
  }
  if (typeof input.performedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.performedOn)) {
    throw new Error('Performed date must use YYYY-MM-DD.');
  }
  const performedOn = new Date(`${input.performedOn}T00:00:00.000Z`);
  if (input.performedOn.startsWith('0000') || !Number.isFinite(performedOn.getTime()) || performedOn.toISOString().slice(0, 10) !== input.performedOn) {
    throw new Error('Performed date is invalid.');
  }
  const repetitionMax = input.repetitionMax ?? null;
  if (movement.measurementType === 'WEIGHT' ? ![1, 3, 5].includes(repetitionMax) : repetitionMax !== null) {
    throw new Error('Weight records require 1, 3 or 5 repetitions; time records have none.');
  }
  const videoUrl = optionalText(input.videoUrl, 'Video URL');
  if (videoUrl && new URL(videoUrl).protocol !== 'https:') {
    throw new Error('Video URL must use HTTPS.');
  }
  return {
    movementId: movement.id,
    measurementType: movement.measurementType,
    value,
    performedOn,
    repetitionMax,
    notes: optionalText(input.notes, 'Notes'),
    videoUrl,
    videoId: optionalText(input.videoId, 'Video ID'),
  };
}

// Internal persistence API: callers must obtain identity from verified Auth,
// never from a browser-supplied owner. Public integration belongs to issues #5/#6/#7.
export async function upsertProfile(authUserId, displayName = null) {
  const id = requireProfileId(authUserId);
  const name = optionalText(displayName, 'Display name');
  const profile = await getPrisma().profile.upsert({
    where: { id }, create: { id, displayName: name }, update: { displayName: name },
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
  const data = await validatedRecord(input);
  const record = await getPrisma().personalRecord.create({
    data: { ...data, profileId }, include: { movement: true },
  });
  return recordDto(record);
}

export async function updateRecord(authUserId, recordId, input) {
  const profileId = requireProfileId(authUserId);
  const data = await validatedRecord(input);
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
    video: record.videoUrl ?? '',
    videoId: record.videoId ?? '',
  };
}
