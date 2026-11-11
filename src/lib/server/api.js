import 'server-only';
import { NextResponse } from 'next/server';
import { getAccess, hasSameOrigin } from './auth.js';
import { CoachingError, isCoach } from './coaching.js';
import { TrainingInputError } from '../training.js';

const ERRORS = {
  not_coach: [403, 'Tu cuenta no tiene el rol de coach.'],
  forbidden: [403, 'No tienes permiso para hacer esto.'],
  not_found: [404, 'No se encontró lo que buscabas.'],
  invalid_input: [400, 'Revisa los datos e inténtalo de nuevo.'],
  invalid_link: [404, 'Este link o código ya no es válido. Pide uno nuevo a tu coach.'],
  own_link: [409, 'No puedes unirte a tu propio plan.'],
  has_coach: [409, 'Ya sigues el plan de otro coach. Sal de ese plan desde Ajustes para aceptar este.'],
  has_logs: [409, 'Hay atletas con resultados en esta sesión, así que no se puede borrar.'],
  limit: [409, 'Llegaste al límite permitido.'],
};

export function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * Wraps a route handler with the checks every coaching route shares: same origin for
 * mutations, a verified and authorized session, the coach role when `coach` is set, and a
 * JSON object body up to `body` characters. The handler gets { userId, input, params, query }
 * and returns the response body; known errors map to safe messages.
 */
export function route({ coach = false, body = 0, status = 200 } = {}, handler) {
  return async function handle(request, context) {
    if (request.method !== 'GET' && !hasSameOrigin(request)) return json({ error: 'Solicitud no permitida.' }, 403);
    try {
      const access = await getAccess();
      if (!access.user) return json({ error: 'Inicia sesión para continuar.' }, 401);
      if (!access.authorized) return json({ error: 'Tu cuenta todavía no tiene acceso.' }, 403);
      if (coach && !(await isCoach(access.user.id))) throw new CoachingError('not_coach');
      let input;
      if (body) {
        try {
          const raw = await request.text();
          if (raw.length > body) return json({ error: 'Solicitud demasiado grande.' }, 413);
          input = JSON.parse(raw);
        } catch { input = null; }
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CoachingError('invalid_input');
      }
      const params = context?.params ? await context.params : {};
      const result = await handler({ userId: access.user.id, input, params, query: new URL(request.url).searchParams });
      return json(result ?? {}, status);
    } catch (error) {
      const [code, message] = error instanceof TrainingInputError ? ERRORS.invalid_input : ERRORS[error instanceof CoachingError ? error.code : ''] ?? [];
      if (code) return json({ error: message, code: error.code ?? 'invalid_input' }, code);
      return json({ error: 'No se pudo completar la solicitud. Inténtalo de nuevo.' }, 503);
    }
  };
}
