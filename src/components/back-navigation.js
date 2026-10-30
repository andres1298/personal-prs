'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/*
 * Native back: every step the app can go back from (an open layer or a screen above the Execute
 * picker) has its own history entry, so Android's back button and gesture, and the browser's back,
 * close or leave it. Layers (alerts, the tour, sheets) register while open; the topmost one closes
 * first. Without layers, back goes up one screen. The URL never changes.
 */

const layers = [];
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const layerCount = () => layers.length;

/** Registers an open layer that `onBack` closes. The latest one registered is the first to close. */
export function useBackLayer(open, onBack) {
  const handler = useRef(onBack);
  useEffect(() => { handler.current = onBack; }, [onBack]);
  useEffect(() => {
    if (!open) return undefined;
    const layer = { close: () => handler.current?.() };
    layers.push(layer);
    notify();
    return () => {
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      notify();
    };
  }, [open]);
}

export const useOpenLayers = () => useSyncExternalStore(subscribe, layerCount, () => 0);

const KEY = 'prsBackDepth';
const depthOf = (state) => (Number.isInteger(state?.[KEY]) ? state[KEY] : 0);

/**
 * Keeps one history entry per back step: `screenDepth` screens plus the open layers. `onScreenBack`
 * goes up one screen; nothing is synced until `enabled` (the stored screen is known). Closing things from the interface also removes their entries (with
 * history.go), so the history never holds steps that no longer exist. After a reload the app keeps
 * the entries it had and adjusts them to the screen it reopens on, one per level above the picker.
 */
export function useHistoryBack(screenDepth, onScreenBack, enabled = true) {
  const open = useOpenLayers();
  const target = screenDepth + open;
  const state = useRef({ index: 0, pending: 0, target: 0 });
  const screenBack = useRef(onScreenBack);
  useEffect(() => { screenBack.current = onScreenBack; }, [onScreenBack]);

  const sync = useCallback(() => {
    const current = state.current;
    if (current.pending) return;
    if (current.target > current.index) {
      for (let depth = current.index + 1; depth <= current.target; depth++) window.history.pushState({ [KEY]: depth }, '');
      current.index = current.target;
    } else if (current.target < current.index) {
      current.pending += 1;
      window.history.go(current.target - current.index);
    }
  }, []);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // A reload keeps the current entry and the ones behind it, so the app continues from its depth.
    if (Number.isInteger(window.history.state?.[KEY])) state.current.index = depthOf(window.history.state);
    else { window.history.replaceState({ [KEY]: 0 }, ''); state.current.index = 0; }
    const onPop = (event) => {
      const current = state.current;
      const index = depthOf(event.state);
      if (current.pending) {
        current.pending -= 1;
        current.index = index;
        sync();
        return;
      }
      // One step back per event: the topmost layer, or else one screen up. Once the app has rendered
      // the step, entries still needed (the history jumped further, or nothing could close) come back.
      current.index = index;
      if (layers.length) layers[layers.length - 1].close();
      else screenBack.current?.();
      setTimeout(sync, 300);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [sync]);

  useEffect(() => {
    if (!enabled) return;
    state.current.target = target;
    sync();
  }, [enabled, target, sync]);
}
