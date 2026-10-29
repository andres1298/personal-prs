'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value == null ? fallback : value;
  } catch { return fallback; }
}

export function writeStored(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/**
 * State persisted on the device. Starts from `defaults` on the server render and
 * merges the stored value after mount, so hydration stays deterministic.
 * Returns [state, update, ready]; update accepts a patch object or a function.
 */
export function useStoredState(key, defaults, migrate = (value) => value) {
  const [state, setState] = useState(defaults);
  const [ready, setReady] = useState(false);
  const initial = useRef({ defaults, migrate });
  useEffect(() => {
    const { defaults: base, migrate: fix } = initial.current;
    setState(fix({ ...base, ...readStored(key, {}) }));
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) writeStored(key, state); }, [key, state, ready]);
  const update = useCallback((patch) => setState((current) => ({
    ...current, ...(typeof patch === 'function' ? patch(current) : patch),
  })), []);
  return [state, update, ready];
}

/** Holds a screen Wake Lock while `active`, re-acquiring it when the page returns. */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || lock || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        lock.addEventListener('release', () => { lock = null; });
      } catch { lock = null; }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

const CACHE_PREFIX = 'prs_cache_v1_';

/** Device key for an account's copy of server data; without a scope nothing is kept. */
export function cacheKey(name, scope) {
  return scope ? `${CACHE_PREFIX}${name}_${scope}` : null;
}

/** Forgets every copy of server data on this device, e.g. when signing out. */
export function clearCaches() {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(CACHE_PREFIX)).forEach((key) => localStorage.removeItem(key));
  } catch {}
}

/** Calls `refresh` when the connection returns, or when the app comes back to the foreground after `minGap` ms. */
export function useRefreshOnReturn(refresh, enabled, minGap = 60000) {
  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    const run = () => { last = Date.now(); refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last > minGap) run(); };
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, enabled, minGap]);
}

/**
 * A server list that opens from the device copy under `key` and refreshes in the background.
 * `loading` is only true while there is nothing to show; a failed refresh with data on screen
 * sets `stale` instead of `error`. `synced` turns true once the server answered.
 * `update` changes the list after a mutation and drops refreshes that started before it.
 */
export function useCachedList(fetchList, key, { enabled = true, failMessage }) {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState({ loading: enabled, error: '', stale: '', synced: false });
  const request = useRef(0);
  const shown = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++request.current;
    try {
      const loaded = await fetchList();
      if (id !== request.current) return;
      shown.current = true;
      setItems(loaded);
      setStatus({ loading: false, error: '', stale: '', synced: true });
    } catch (err) {
      if (id !== request.current) return;
      const offline = err.message === 'Failed to fetch';
      if (shown.current) {
        const stale = offline ? 'Sin conexión · mostrando tus datos guardados.' : `${err.message} Mostrando tus datos guardados.`;
        setStatus((current) => ({ ...current, loading: false, stale }));
      } else {
        setStatus({ loading: false, error: offline ? failMessage : err.message, stale: '', synced: false });
      }
    }
  }, [enabled, fetchList, failMessage]);

  useEffect(() => {
    if (!enabled) return undefined;
    const cached = key ? readStored(key, null) : null;
    if (Array.isArray(cached)) {
      shown.current = true;
      setItems(cached);
      setStatus((current) => ({ ...current, loading: false }));
    }
    refresh();
    return () => { request.current += 1; };
  }, [enabled, key, refresh]);

  useEffect(() => { if (key && items) writeStored(key, items); }, [key, items]);
  useRefreshOnReturn(refresh, enabled);

  // A manual retry clears the notice; the loading state returns only when there is nothing on screen.
  const reload = useCallback(() => {
    setStatus((current) => (shown.current ? { ...current, stale: '' } : { ...current, loading: true, error: '' }));
    return refresh();
  }, [refresh]);

  const update = useCallback((change) => {
    request.current += 1;
    setItems(change);
  }, []);

  return { items, ...status, reload, update };
}
