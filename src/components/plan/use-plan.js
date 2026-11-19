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

const within = (date, span) => Boolean(span) && date >= span.from && date <= span.to;
const widen = (span, next) => (span ? { from: next.from < span.from ? next.from : span.from, to: next.to > span.to ? next.to : span.to } : next);

/**
 * The plan after the server answered for `span`: its sessions replace those of that span, matched
 * by id, and the sessions outside it are kept while they are still in `range`. A session (or the
 * division) the athlete changed after the request left keeps its local version.
 */
function mergePlan(current, data, span, range, changedSince) {
  const local = new Map(current.sessions.map((session) => [session.id, session]));
  const fresh = data.sessions.map((session) => (changedSince(session.id) && local.has(session.id) ? local.get(session.id) : session));
  const ids = new Set(fresh.map((session) => session.id));
  const kept = current.sessions.filter((session) => !ids.has(session.id) && !within(session.date, span) && within(session.date, range));
  // Sorting by date alone keeps the server's order within a day.
  const sessions = [...kept, ...fresh].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    coach: data.coach, ownGroups: data.ownGroups ?? [], sessions,
    division: changedSince('division') ? current.division : data.division ?? null,
  };
}

/**
 * The athlete's coach and the sessions around today (eight weeks each way). Opens from the
 * copy kept on the device for `scope`, then asks the server for the current week first, so
 * today's session arrives as soon as possible, and for the whole range once that answer is on
 * screen. `loaded` turns true with the server's first answer (until then `coach` may come from
 * the device copy), `covered` is the span the server has answered for and `complete` says it
 * holds the whole range.
 */
export default function usePlan(enabled, scope) {
  const [plan, setPlan] = useState({ coach: null, ownGroups: [], sessions: [], division: null });
  const [status, setStatus] = useState({ loaded: false, error: '', covered: null });
  const key = enabled ? cacheKey('plan', scope) : null;
  const request = useRef(0);
  // The newest request whose answer is on screen: an older one answering later is dropped.
  const shown = useRef(0);
  // Mutations are counted, and each session remembers the last one that changed it.
  const mutation = useRef(0);
  const changed = useRef(new Map());
  const wholeRange = useRef(false);
  const { range, week } = useMemo(() => {
    const monday = weekStart(today());
    return {
      range: { from: addDays(monday, -7 * WEEKS_BACK), to: addDays(monday, 7 * WEEKS_AHEAD + 6) },
      week: { from: monday, to: addDays(monday, 6) },
    };
  }, []);

  const fetchSpan = useCallback(async (span) => {
    if (!enabled) return;
    const id = ++request.current;
    const since = mutation.current;
    try {
      const data = await call(`/api/plan?from=${span.from}&to=${span.to}`);
      if (id < shown.current) return;
      shown.current = id;
      // A mutation's answer wins over a request that started before it.
      const changedSince = (target) => (changed.current.get(target) ?? 0) > since;
      setPlan((current) => mergePlan(current, data, span, range, changedSince));
      setStatus((current) => ({ loaded: true, error: '', covered: widen(current.covered, span) }));
    } catch (err) {
      if (id === request.current) setStatus((current) => ({ ...current, error: err.message === 'Failed to fetch' ? 'Sin conexión.' : err.message }));
    }
  }, [enabled, range]);
  const refresh = useCallback(() => fetchSpan(range), [fetchSpan, range]);

  useEffect(() => {
    if (!enabled) return;
    const cached = key ? readStored(key, null) : null;
    if (cached?.sessions) setPlan({ ownGroups: [], ...cached });
    fetchSpan(week);
  }, [enabled, key, fetchSpan, week]);
  // The rest of the range is asked for once the week's answer has been drawn.
  useEffect(() => {
    if (!status.loaded || wholeRange.current) return;
    wholeRange.current = true;
    if (!within(range.from, status.covered) || !within(range.to, status.covered)) refresh();
  }, [status.loaded, status.covered, range, refresh]);
  useEffect(() => { if (key && status.loaded) writeStored(key, plan); }, [key, plan, status.loaded]);
  useRefreshOnReturn(refresh, enabled);

  const complete = within(range.from, status.covered) && within(range.to, status.covered);

  const markChanged = useCallback((target) => { changed.current.set(target, ++mutation.current); }, []);
  const patchSession = useCallback((id, patch) => {
    markChanged(id);
    setPlan((current) => ({
      ...current, sessions: current.sessions.map((session) => (session.id === id ? { ...session, ...(typeof patch === 'function' ? patch(session) : patch) } : session)),
    }));
  }, [markChanged]);

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
    markChanged('division');
    setPlan((current) => ({ ...current, division: saved.division }));
  }, [markChanged]);

  return { ...plan, ...status, complete, range, reload: refresh, saveLog, addComment, markSeen, join, leave, setDivision };
}
