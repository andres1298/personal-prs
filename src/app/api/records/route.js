import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../lib/server/auth';
import { createRecord, listRecords, RecordInputError, toLegacyRecord, upsertProfile } from '../../../lib/server/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function requireAccess() {
  const access = await getAccess();
  if (!access.user) return { response: json({ error: 'Inicia sesión para acceder a tus registros.' }, 401) };
  if (!access.authorized) return { response: json({ error: 'Tu cuenta todavía no tiene acceso.' }, 403) };
  return access;
}

export async function GET() {
  try {
    const access = await requireAccess();
    if (access.response) return access.response;
    const records = await listRecords(access.user.id);
    return json({ records: records.map(toLegacyRecord) });
  } catch {
    return json({ error: 'No se pudieron cargar tus registros. Inténtalo de nuevo.' }, 503);
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
      if (body.length > 12000) return json({ error: 'Registro demasiado grande.' }, 413);
      input = JSON.parse(body);
    } catch { return json({ error: 'Registro inválido.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some((key) => !['move', 'value', 'date', 'rm', 'notes'].includes(key)) ||
        typeof input.move !== 'string' || typeof input.value !== 'number' || !Number.isFinite(input.value) ||
        input.move.length > 100 || (input.notes != null && (typeof input.notes !== 'string' || input.notes.length > 5000))) {
      return json({ error: 'Revisa los datos del registro.' }, 400);
    }
    await upsertProfile(access.user.id);
    const record = await createRecord(access.user.id, {
      movementId: input.move.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-'),
      value: input.value,
      performedOn: input.date,
      repetitionMax: input.rm ?? null,
      notes: input.notes,
    });
    return json({ record: toLegacyRecord(record) }, 201);
  } catch (error) {
    if (error instanceof RecordInputError) return json({ error: 'Revisa el movimiento, valor, fecha y repeticiones.' }, 400);
    return json({ error: 'No se pudo guardar el registro. Inténtalo de nuevo.' }, 503);
  }
}
