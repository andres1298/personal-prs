import 'server-only';
import { getPrisma } from './prisma.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MemberError extends Error {
  constructor(code) {
    super(`Member error: ${code}`);
    this.code = code;
  }
}

function adminIdSet(adminUserIds = '') {
  return new Set(adminUserIds.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean));
}

// Admins only ever see how many records a member has, never their values.
export async function listMembers(adminUserIds) {
  const admins = adminIdSet(adminUserIds);
  const rows = await getPrisma().profile.findMany({
    select: { id: true, displayName: true, email: true, createdAt: true, disabledAt: true, _count: { select: { records: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.displayName,
    email: row.email,
    createdAt: row.createdAt,
    disabledAt: row.disabledAt,
    isAdmin: admins.has(row.id.toLowerCase()),
    recordCount: row._count.records,
  }));
}

export async function setMemberDisabled(actorId, memberId, disabled, adminUserIds, now = new Date()) {
  if (typeof disabled !== 'boolean') throw new MemberError('invalid_input');
  if (typeof memberId !== 'string' || !uuidPattern.test(memberId)) throw new MemberError('not_found');
  // Admin access comes from server configuration, so disabling their profile would not lock them out.
  if (adminIdSet(adminUserIds).has(memberId.toLowerCase())) throw new MemberError('admin');
  const { count } = await getPrisma().profile.updateMany({
    where: { id: memberId },
    data: disabled ? { disabledAt: now, disabledById: actorId } : { disabledAt: null, disabledById: null },
  });
  if (count !== 1) throw new MemberError('not_found');
}
