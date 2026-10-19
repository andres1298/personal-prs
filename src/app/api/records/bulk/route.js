import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from '../../../../lib/server/auth';
import { createRecords, MAX_BULK_RECORDS, RecordConflictError, RecordInputError, toLegacyRecord } from '../../../../lib/server/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function isValidItem(item) {
  return item && typeof item === 'object' && !Array.isArray(item) &&
    Object.keys(item).every((key) => ['move', 'value', 'date', 'rm'].includes(key)) &&
    typeof item.move === 'string' && item.move.length <= 100 &&
    typeof item.value === 'number' && Number.isFinite(item.value);
}

export async function POST(request) {
  if (!hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
  try {
    const access = await getAccess();
    if (!access.user) return json({ error: 'Inicia sesión para acceder a tus registros.' }, 401);
    if (!access.authorized) return json({ error: 'Tu cuenta todavía no tiene acceso.' }, 403);
    let input;
    try {
      const body = await request.text();
      if (body.length > 24000) return json({ error: 'Demasiados registros.' }, 413);
      input = JSON.parse(body);
    } catch { return json({ error: 'Registros inválidos.' }, 400); }
    const items = input?.records;
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'records') ||
        !Array.isArray(items) || items.length === 0 || items.length > MAX_BULK_RECORDS || !items.every(isValidItem)) {
      return json({ error: 'Revisa los pesos ingresados.' }, 400);
    }
    const records = await createRecords(access.user.id, items.map((item) => ({
      movementName: item.move,
      value: item.value,
      performedOn: item.date,
      repetitionMax: item.rm ?? null,
    })));
    return json({ records: records.map(toLegacyRecord) }, 201);
  } catch (error) {
    if (error instanceof RecordConflictError) return json({ error: 'Algunos movimientos ya tienen registro. Recarga e inténtalo de nuevo.' }, 409);
    if (error instanceof RecordInputError) return json({ error: 'Revisa los pesos ingresados.' }, 400);
    return json({ error: 'No se pudieron guardar tus pesos. Inténtalo de nuevo.' }, 503);
  }
}
