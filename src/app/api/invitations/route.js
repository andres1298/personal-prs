import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../lib/server/auth';
import { createInvitation, InvitationError, listPendingInvitations } from '../../../lib/server/invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function requireAdmin() {
  const access = await getAccess();
  if (!access.user) return { response: json({ error: 'Inicia sesión para continuar.' }, 401) };
  if (!access.isAdmin) return { response: json({ error: 'Solo el administrador puede gestionar invitaciones.' }, 403) };
  return access;
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;
    return json({ invitations: await listPendingInvitations(access.user.id) });
  } catch {
    return json({ error: 'No se pudieron cargar las invitaciones.' }, 503);
  }
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;
    let input;
    try {
      const body = await request.text();
      if (body.length > 2000) return json({ error: 'Invitación inválida.' }, 400);
      input = JSON.parse(body);
    } catch { return json({ error: 'Invitación inválida.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some((key) => !['name', 'email'].includes(key)) ||
        typeof input.name !== 'string' || typeof input.email !== 'string') {
      return json({ error: 'Revisa el nombre y el correo.' }, 400);
    }
    const { token, invitation } = await createInvitation(access.user.id, { name: input.name, email: input.email });
    return json({ invitation, url: `${new URL(request.url).origin}/invite/${token}` }, 201);
  } catch (error) {
    if (error instanceof InvitationError && error.code === 'already_member') return json({ error: 'Esta persona ya tiene acceso.' }, 409);
    if (error instanceof InvitationError) return json({ error: 'Revisa el nombre y el correo.' }, 400);
    return json({ error: 'No se pudo crear la invitación. Inténtalo de nuevo.' }, 503);
  }
}
