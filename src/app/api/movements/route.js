import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../lib/server/auth';
import { createMovement, listMovements, MovementConflictError, MovementInputError } from '../../../lib/server/movements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function requireAccess() {
  const access = await getAccess();
  if (!access.user) return { response: json({ error: 'Inicia sesión para acceder a tus movimientos.' }, 401) };
  if (!access.authorized) return { response: json({ error: 'Tu cuenta todavía no tiene acceso.' }, 403) };
  return access;
}

export async function GET() {
  try {
    const access = await requireAccess();
    if (access.response) return access.response;
    return json({ movements: await listMovements(access.user.id) });
  } catch {
    return json({ error: 'No se pudieron cargar tus movimientos. Inténtalo de nuevo.' }, 503);
  }
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
  try {
    const access = await requireAccess();
    if (access.response) return access.response;
    let input;
    try {
      const body = await request.text();
      if (body.length > 1000) return json({ error: 'Movimiento inválido.' }, 400);
      input = JSON.parse(body);
    } catch { return json({ error: 'Movimiento inválido.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some((key) => !['name', 'measurementType', 'category', 'groupName'].includes(key))) {
      return json({ error: 'Revisa los datos del movimiento.' }, 400);
    }
    return json({ movement: await createMovement(access.user.id, input) }, 201);
  } catch (error) {
    if (error instanceof MovementConflictError) return json({ error: 'Ya existe un movimiento con ese nombre.' }, 409);
    if (error instanceof MovementInputError) return json({ error: 'Revisa el nombre, la sección, la categoría y el límite de movimientos propios.' }, 400);
    return json({ error: 'No se pudo crear el movimiento. Inténtalo de nuevo.' }, 503);
  }
}
