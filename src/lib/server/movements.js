import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPrisma } from './prisma.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_CUSTOM_MOVEMENTS = 30;
export const MOVEMENT_NAME_MAX = 40;
const CUSTOM_GROUP = 'Custom';

export class MovementInputError extends Error {}
export class MovementNotFoundError extends Error {}
export class MovementForbiddenError extends Error {}
export class MovementConflictError extends Error {}
export class MovementConfirmationError extends Error {
  constructor(recordCount) {
    super('Deleting this movement also deletes its records.');
    this.recordCount = recordCount;
  }
}

function requireProfileId(profileId) {
  if (typeof profileId !== 'string' || !uuidPattern.test(profileId)) {
    throw new Error('A verified Auth user ID is required.');
  }
  return profileId.toLowerCase();
}

function movementDto(movement, profileId) {
  return {
    id: movement.id,
    name: movement.name,
    category: movement.category,
    groupName: movement.groupName,
    measurementType: movement.measurementType,
    custom: movement.ownerId === profileId,
    hidden: (movement.hiddenBy?.length ?? 0) > 0,
  };
}

function validatedName(value) {
  if (typeof value !== 'string') throw new MovementInputError('Name must be text.');
  const name = value.replace(/\s+/g, ' ').trim();
  // eslint-disable-next-line no-control-regex
  if (!name || name.length > MOVEMENT_NAME_MAX || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new MovementInputError(`Name must have 1 to ${MOVEMENT_NAME_MAX} printable characters.`);
  }
  return name;
}

// Shared movements plus the member's own, each flagged with the member's hidden state.
export async function listMovements(authUserId) {
  const profileId = requireProfileId(authUserId);
  const movements = await getPrisma().movement.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: profileId }] },
    include: { hiddenBy: { where: { profileId }, select: { profileId: true } } },
    orderBy: [{ category: 'asc' }, { groupName: 'asc' }, { name: 'asc' }],
  });
  return movements.map((movement) => movementDto(movement, profileId));
}

export async function createMovement(authUserId, input) {
  const profileId = requireProfileId(authUserId);
  if (!input || typeof input !== 'object') throw new MovementInputError('Movement input is required.');
  const name = validatedName(input.name);
  if (input.measurementType !== 'WEIGHT' && input.measurementType !== 'TIME') {
    throw new MovementInputError('Measurement type must be WEIGHT or TIME.');
  }
  const measurementType = input.measurementType;
  try {
    return await getPrisma().$transaction(async (tx) => {
      if (await tx.movement.count({ where: { ownerId: profileId } }) >= MAX_CUSTOM_MOVEMENTS) {
        throw new MovementInputError(`At most ${MAX_CUSTOM_MOVEMENTS} custom movements are allowed.`);
      }
      const duplicate = await tx.movement.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, OR: [{ ownerId: null }, { ownerId: profileId }] },
        select: { id: true },
      });
      if (duplicate) throw new MovementConflictError('A movement with this name already exists.');
      const movement = await tx.movement.create({
        data: {
          id: randomUUID(), name, ownerId: profileId, measurementType, groupName: CUSTOM_GROUP,
          category: measurementType === 'WEIGHT' ? 'LIFT' : 'BENCHMARK',
        },
      });
      return movementDto(movement, profileId);
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    // P2002: unique name; P2034: a concurrent save touched the same rows.
    if (error?.code === 'P2002' || error?.code === 'P2034') throw new MovementConflictError('A movement with this name already exists.');
    throw error;
  }
}

async function findVisibleMovement(db, profileId, movementId) {
  if (typeof movementId !== 'string' || movementId.length > 100) throw new MovementNotFoundError('Unknown movement.');
  const movement = await db.movement.findUnique({ where: { id: movementId }, select: { id: true, ownerId: true } });
  if (!movement || (movement.ownerId !== null && movement.ownerId !== profileId)) throw new MovementNotFoundError('Unknown movement.');
  return movement;
}

// Turning a shared movement off is personal: history stays and other members are unaffected.
export async function setMovementHidden(authUserId, movementId, hidden) {
  const profileId = requireProfileId(authUserId);
  const prisma = getPrisma();
  const movement = await findVisibleMovement(prisma, profileId, movementId);
  if (movement.ownerId !== null) throw new MovementInputError('Own movements are deleted, not hidden.');
  if (hidden) {
    await prisma.hiddenMovement.upsert({
      where: { profileId_movementId: { profileId, movementId } }, create: { profileId, movementId }, update: {},
    });
  } else {
    await prisma.hiddenMovement.deleteMany({ where: { profileId, movementId } });
  }
}

// Only the owner can delete a movement, never a shared one. A movement with records needs
// explicit confirmation, and then the records go with it in the same transaction.
export async function deleteMovement(authUserId, movementId, confirmed = false) {
  const profileId = requireProfileId(authUserId);
  return getPrisma().$transaction(async (tx) => {
    const movement = await findVisibleMovement(tx, profileId, movementId);
    if (movement.ownerId !== profileId) throw new MovementForbiddenError('Shared movements cannot be deleted.');
    const recordCount = await tx.personalRecord.count({ where: { profileId, movementId } });
    if (recordCount > 0 && confirmed !== true) throw new MovementConfirmationError(recordCount);
    await tx.personalRecord.deleteMany({ where: { profileId, movementId } });
    await tx.movement.delete({ where: { id: movementId } });
    return { deletedRecords: recordCount };
  });
}
