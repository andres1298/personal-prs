import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../../lib/server/auth';
import { revokeInvitation } from '../../../../lib/server/invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

function json(body, status) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export async function DELETE(request, { params }) {
  if (!hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
  try {
    const access = await getAccess();
    if (!access.user) return json({ error: 'Inicia sesión para continuar.' }, 401);
    if (!access.isAdmin) return json({ error: 'Solo el administrador puede gestionar invitaciones.' }, 403);
    const { id } = await params;
    if (!await revokeInvitation(access.user.id, id)) return json({ error: 'La invitación ya no está pendiente.' }, 404);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch {
    return json({ error: 'No se pudo revocar la invitación. Inténtalo de nuevo.' }, 503);
  }
}
