import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../../lib/server/auth';
import {
  deleteMovement, MovementConfirmationError, MovementForbiddenError, MovementInputError, MovementNotFoundError, setMovementHidden,
} from '../../../../lib/server/movements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function requireAccess(request) {
  if (!hasSameOrigin(request)) return { response: json({ error: 'Solicitud no permitida.' }, 403) };
  const access = await getAccess();
  if (!access.user) return { response: json({ error: 'Inicia sesión para continuar.' }, 401) };
  if (!access.authorized) return { response: json({ error: 'Tu cuenta todavía no tiene acceso.' }, 403) };
  return access;
}

function failure(error, fallback) {
  if (error instanceof MovementNotFoundError) return json({ error: 'El movimiento no existe.' }, 404);
  if (error instanceof MovementForbiddenError) return json({ error: 'Los movimientos del catálogo no se pueden eliminar.' }, 403);
  if (error instanceof MovementInputError) return json({ error: 'Solicitud inválida.' }, 400);
  return json({ error: fallback }, 503);
}

export async function PATCH(request, { params }) {
  try {
    const access = await requireAccess(request);
    if (access.response) return access.response;
    let input;
    try {
      const body = await request.text();
      if (body.length > 200) return json({ error: 'Solicitud inválida.' }, 400);
      input = JSON.parse(body);
    } catch { return json({ error: 'Solicitud inválida.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some((key) => key !== 'hidden') || typeof input.hidden !== 'boolean') {
      return json({ error: 'Solicitud inválida.' }, 400);
    }
    const { id } = await params;
    await setMovementHidden(access.user.id, id, input.hidden);
    return json({ hidden: input.hidden });
  } catch (error) {
    return failure(error, 'No se pudo actualizar el movimiento. Inténtalo de nuevo.');
  }
}

// Without confirm=true a movement that has records is not deleted; the count comes back instead.
export async function DELETE(request, { params }) {
  try {
    const access = await requireAccess(request);
    if (access.response) return access.response;
    const { id } = await params;
    const confirmed = new URL(request.url).searchParams.get('confirm') === 'true';
    return json(await deleteMovement(access.user.id, id, confirmed));
  } catch (error) {
    if (error instanceof MovementConfirmationError) {
      return json({ error: 'Este movimiento tiene registros. Confirma para eliminarlos.', recordCount: error.recordCount }, 409);
    }
    return failure(error, 'No se pudo eliminar el movimiento. Inténtalo de nuevo.');
  }
}
