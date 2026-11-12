'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { today } from '../../lib/catalog';
import { addDays, weekStart } from '../../lib/training';
import { cacheKey, readStored, useRefreshOnReturn, writeStored } from '../hooks';

const WEEKS_BACK = 8;
const WEEKS_AHEAD = 8;

async function call(url, method = 'GET', body) {
  const response = await fetch(url, {
    method, cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

/**
 * The athlete's coach and the sessions around today (eight weeks each way). Opens from the
 * copy kept on the device for `scope` and refreshes in the background. `loaded` turns true
 * once the server answered; until then `coach` may come from the device copy.
 */
export default function usePlan(enabled, scope) {
  const [plan, setPlan] = useState({ coach: null, sessions: [], division: null });
  const [status, setStatus] = useState({ loaded: false, error: '' });
  const key = enabled ? cacheKey('plan', scope) : null;
  const request = useRef(0);
  const range = useMemo(() => {
    const monday = weekStart(today());
    return { from: addDays(monday, -7 * WEEKS_BACK), to: addDays(monday, 7 * WEEKS_AHEAD + 6) };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++request.current;
    try {
      const data = await call(`/api/plan?from=${range.from}&to=${range.to}`);
      if (id !== request.current) return;
      setPlan({ coach: data.coach, sessions: data.sessions, division: data.division ?? null });
      setStatus({ loaded: true, error: '' });
    } catch (err) {
      if (id === request.current) setStatus((current) => ({ ...current, error: err.message === 'Failed to fetch' ? 'Sin conexión.' : err.message }));
    }
  }, [enabled, range]);

  useEffect(() => {
    if (!enabled) return;
    const cached = key ? readStored(key, null) : null;
    if (cached?.sessions) setPlan(cached);
    refresh();
  }, [enabled, key, refresh]);
  useEffect(() => { if (key && status.loaded) writeStored(key, plan); }, [key, plan, status.loaded]);
  useRefreshOnReturn(refresh, enabled);

  // A mutation's answer wins over a refresh that started before it.
  const patchSession = useCallback((id, patch) => {
    request.current += 1;
    setPlan((current) => ({
      ...current, sessions: current.sessions.map((session) => (session.id === id ? { ...session, ...(typeof patch === 'function' ? patch(session) : patch) } : session)),
    }));
  }, []);

  // input: { results?, completed? }
  const saveLog = useCallback(async (id, input) => {
    const { log } = await call(`/api/plan/${id}`, 'PUT', input);
    patchSession(id, log);
  }, [patchSession]);

  const addComment = useCallback(async (id, body) => {
    const { comment } = await call(`/api/plan/${id}/comments`, 'POST', { body });
    patchSession(id, (session) => ({ comments: [...session.comments, comment] }));
  }, [patchSession]);

  const markSeen = useCallback((id) => {
    patchSession(id, { unread: 0 });
    call(`/api/plan/${id}`, 'PUT', { seen: true }).catch(() => {});
  }, [patchSession]);

  const join = useCallback(async (code) => {
    const joined = await call('/api/coaching', 'POST', { code });
    await refresh();
    return joined;
  }, [refresh]);

  const leave = useCallback(async () => {
    await call('/api/coaching', 'DELETE');
    await refresh();
  }, [refresh]);

  // Which fixed weights the member loads when the coach wrote one for men and one for women.
  const setDivision = useCallback(async (division) => {
    const saved = await call('/api/profile', 'PUT', { division });
    request.current += 1;
    setPlan((current) => ({ ...current, division: saved.division }));
  }, []);

  return { ...plan, ...status, range, reload: refresh, saveLog, addComment, markSeen, join, leave, setDivision };
}
