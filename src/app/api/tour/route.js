import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../lib/server/auth';
import { completeTour } from '../../../lib/server/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

// Marks the guided tour as finished or skipped for the signed-in member.
export async function POST(request) {
  if (!hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
  try {
    const access = await getAccess();
    if (!access.user) return json({ error: 'Inicia sesión para continuar.' }, 401);
    if (!access.authorized) return json({ error: 'Tu cuenta todavía no tiene acceso.' }, 403);
    await completeTour(access.user.id);
    return json({ ok: true });
  } catch {
    return json({ error: 'No se pudo guardar el tour. Inténtalo de nuevo.' }, 503);
  }
}
