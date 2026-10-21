import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getPrisma } from './prisma.js';
import { getAuthAdmin } from './supabase-admin.js';
import { MIN_PASSWORD_LENGTH } from '../password-policy.js';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export { MIN_PASSWORD_LENGTH };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicFields = { id: true, name: true, email: true, expiresAt: true };

export class InvitationError extends Error {
  constructor(code) {
    super(`Invitation error: ${code}`);
    this.code = code;
  }
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function pendingWhere(now) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

function validatedInput({ name, email } = {}) {
  if (typeof name !== 'string' || typeof email !== 'string') throw new InvitationError('invalid_input');
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || cleanName.length > 80 || cleanEmail.length > 254 || !emailPattern.test(cleanEmail)) {
    throw new InvitationError('invalid_input');
  }
  return { name: cleanName, email: cleanEmail };
}

export async function createInvitation(inviterId, input, now = new Date()) {
  const { name, email } = validatedInput(input);
  const prisma = getPrisma();
  if (await prisma.profile.findUnique({ where: { email }, select: { id: true } })) throw new InvitationError('already_member');
  const token = randomBytes(32).toString('base64url');
  const invitation = await prisma.invitation.create({
    data: { tokenHash: hashToken(token), name, email, invitedById: inviterId, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) },
  });
  return { token, invitation: { id: invitation.id, name, email, expiresAt: invitation.expiresAt } };
}

// Expired links stay listed so the admin can renew or revoke them.
export async function listPendingInvitations(inviterId, now = new Date()) {
  const rows = await getPrisma().invitation.findMany({
    where: { invitedById: inviterId, acceptedAt: null, revokedAt: null }, select: publicFields, orderBy: { createdAt: 'desc' },
  });
  return rows.map(({ id, name, email, expiresAt }) => ({ id, name, email, expiresAt, expired: expiresAt <= now }));
}

// Issuing a new token invalidates the previous link, so a lost link can be resent safely.
export async function renewInvitation(inviterId, id, now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  const { count } = await getPrisma().invitation.updateMany({
    where: { id, invitedById: inviterId, acceptedAt: null, revokedAt: null }, data: { tokenHash: hashToken(token), expiresAt },
  });
  return count === 1 ? { token, expiresAt } : null;
}

export async function revokeInvitation(inviterId, id, now = new Date()) {
  const { count } = await getPrisma().invitation.updateMany({
    where: { id, invitedById: inviterId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now },
  });
  return count === 1;
}

export async function findValidInvitation(token, now = new Date()) {
  if (typeof token !== 'string' || !token) return null;
  const invitation = await getPrisma().invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) return null;
  return { name: invitation.name, email: invitation.email };
}

export async function acceptInvitation(token, password, now = new Date()) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) throw new InvitationError('weak_password');
  if (typeof token !== 'string' || !token) throw new InvitationError('invalid_link');
  const prisma = getPrisma();
  const tokenHash = hashToken(token);
  // The conditional update is the single-use gate: only one concurrent request can claim it.
  const claim = await prisma.invitation.updateMany({ where: { tokenHash, ...pendingWhere(now) }, data: { acceptedAt: now } });
  if (claim.count !== 1) throw new InvitationError('invalid_link');
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
  const release = () => prisma.invitation.updateMany({ where: { tokenHash }, data: { acceptedAt: null, acceptedProfileId: null } });

  const authAdmin = getAuthAdmin();
  const { data, error } = await authAdmin.createUser({
    email: invitation.email, password, email_confirm: true, user_metadata: { name: invitation.name },
  });
  if (error) {
    await release();
    if (error.code === 'email_exists') throw new InvitationError('email_taken');
    if (error.code === 'weak_password') throw new InvitationError('weak_password');
    throw new Error('Unable to create the invited account.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.profile.create({
        data: { id: data.user.id, displayName: invitation.name, email: invitation.email, invitedById: invitation.invitedById },
        select: { id: true },
      });
      await tx.invitation.update({ where: { tokenHash }, data: { acceptedProfileId: data.user.id } });
    });
  } catch (profileError) {
    // Cleanup steps are independent so a failed delete still frees the link; the original error wins.
    try { await authAdmin.deleteUser(data.user.id); } catch {}
    try { await release(); } catch {}
    throw profileError;
  }
  return { email: invitation.email };
}
