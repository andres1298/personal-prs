import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../../lib/server/auth';
import { MemberError, setMemberDisabled } from '../../../../lib/server/members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request, { params }) {
  if (!hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
  try {
    const access = await getAccess();
    if (!access.user) return json({ error: 'Inicia sesión para continuar.' }, 401);
    if (!access.isAdmin) return json({ error: 'Solo el administrador puede gestionar usuarios.' }, 403);
    let input;
    try {
      const body = await request.text();
      if (body.length > 200) return json({ error: 'Solicitud inválida.' }, 400);
      input = JSON.parse(body);
    } catch { return json({ error: 'Solicitud inválida.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some((key) => key !== 'disabled') || typeof input.disabled !== 'boolean') {
      return json({ error: 'Solicitud inválida.' }, 400);
    }
    const { id } = await params;
    await setMemberDisabled(access.user.id, id, input.disabled, process.env.SUPABASE_ADMIN_USER_IDS);
    return json({ disabled: input.disabled }, 200);
  } catch (error) {
    if (error instanceof MemberError && error.code === 'admin') return json({ error: 'Las cuentas administradoras no se pueden deshabilitar.' }, 409);
    if (error instanceof MemberError && error.code === 'not_found') return json({ error: 'El usuario no existe.' }, 404);
    if (error instanceof MemberError) return json({ error: 'Solicitud inválida.' }, 400);
    return json({ error: 'No se pudo actualizar el usuario. Inténtalo de nuevo.' }, 503);
  }
}
