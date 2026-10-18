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
