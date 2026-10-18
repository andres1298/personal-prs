import { NextResponse } from 'next/server';
import { getAccess } from '../../../lib/server/auth';
import { listMembers } from '../../../lib/server/members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  try {
    const access = await getAccess();
    if (!access.user) return json({ error: 'Inicia sesión para continuar.' }, 401);
    if (!access.isAdmin) return json({ error: 'Solo el administrador puede gestionar usuarios.' }, 403);
    return json({ members: await listMembers(process.env.SUPABASE_ADMIN_USER_IDS) });
  } catch {
    return json({ error: 'No se pudieron cargar los usuarios.' }, 503);
  }
}
