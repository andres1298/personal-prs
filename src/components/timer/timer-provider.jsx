'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  TIMER_TYPES, addRound, cuesBetween, finish, normalizeConfig, pause, restoreRun, resume, resumeCuesBetween, snapshot, start, undoRound,
} from '../../lib/timer-engine';
import { createSoundPlayer } from '../../lib/timer-sounds';
import { readStored, useWakeLock, writeStored } from '../hooks';

const TimerContext = createContext(null);
const TICK_MS = 200;
const defaultConfigs = () => Object.fromEntries(TIMER_TYPES.map((type) => [type, normalizeConfig({ type })]));

/**
 * Owns the workout run. Only consumers of the context re-render on each tick;
 * the run is stored per account so tabs, reloads and suspensions keep it.
 */
export function TimerProvider({ scope, children }) {
  const runKey = `prs_timer_run_${scope}`;
  const configKey = `prs_timer_cfg_${scope}`;
  const sound = useRef(null);
  const lastElapsed = useRef(0);
  const lastTick = useRef(0);
  const [configs, setConfigs] = useState(defaultConfigs);
  const [run, setRun] = useState(null);
  const [ready, setReady] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    sound.current = createSoundPlayer();
    const stored = readStored(configKey, {});
    setConfigs(Object.fromEntries(TIMER_TYPES.map((type) => {
      try { return [type, normalizeConfig({ ...stored[type], type })]; } catch { return [type, normalizeConfig({ type })]; }
    })));
    // A run that ended while the app was closed shows its summary; an acknowledged one is discarded.
    const restored = restoreRun(readStored(runKey, null));
    const time = Date.now();
    if (restored && restored.finalElapsed === null) {
      const view = snapshot(restored, time);
      lastElapsed.current = view.elapsed;
      if (view.done) {
        setRun(finish(restored, time, restored.config.type === 'fortime' ? 'cap' : 'complete'));
        setRunOpen(true);
      } else setRun(restored);
    }
    setNow(time);
    setReady(true);
    return () => { sound.current?.close(); sound.current = null; };
  }, [runKey, configKey]);

  useEffect(() => { if (ready) writeStored(runKey, run); }, [ready, runKey, run]);

  const active = !!run && run.finalElapsed === null;
  useWakeLock(active);

  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, TICK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [active]);

  useEffect(() => {
    document.documentElement.classList.toggle('has-timer', active && !runOpen);
    return () => document.documentElement.classList.remove('has-timer');
  }, [active, runOpen]);

  // Cues and automatic completion follow the clock.
  useEffect(() => {
    if (!active) return;
    const view = snapshot(run, now);
    const previousTick = lastTick.current;
    lastTick.current = now;
    if (!view.paused) {
      // Skip cues missed while the page was suspended instead of replaying a burst.
      const gap = view.elapsed - lastElapsed.current;
      const cues = gap > 0 && gap <= 1500 ? cuesBetween(view.plan, lastElapsed.current, view.elapsed) : [];
      // The resume countdown runs on the clock, not on the workout's elapsed time.
      if (previousTick && now - previousTick <= 1500) cues.push(...resumeCuesBetween(run, previousTick, now));
      if (cues.length) sound.current?.play(cues[cues.length - 1].cue);
      lastElapsed.current = view.elapsed;
    }
    if (view.done) {
      setRun(finish(run, now, run.config.type === 'fortime' ? 'cap' : 'complete'));
      setRunOpen(true);
    }
  }, [active, run, now]);

  // Every tap is a chance to (re)unlock audio on iOS.
  const unlock = useCallback(() => sound.current?.unlock(), []);
  const begin = useCallback((config) => {
    unlock();
    const time = Date.now();
    lastElapsed.current = 0;
    setRun(start(config, time));
    setNow(time);
    setRunOpen(true);
  }, [unlock]);

  const actions = useMemo(() => {
    const at = (fn) => () => { unlock(); const time = Date.now(); setNow(time); setRun((r) => (r ? fn(r, time) : r)); };
    return {
      unlock,
      begin,
      saveConfig(config) {
        const normalized = normalizeConfig(config);
        setConfigs((current) => {
          const next = { ...current, [normalized.type]: normalized };
          writeStored(configKey, next);
          return next;
        });
        begin(normalized);
      },
      openRun: () => { unlock(); setRunOpen(true); },
      minimize: () => setRunOpen(false),
      togglePause: at((r, time) => (snapshot(r, time).paused ? resume(r, time) : pause(r, time))),
      end: at((r, time) => finish(r, time, 'stopped')),
      finishNow: at((r, time) => finish(r, time, 'done')),
      addRound: at((r) => addRound(r)),
      undoRound: at((r) => undoRound(r)),
      clear: () => { setRun(null); setRunOpen(false); },
    };
  }, [unlock, begin, configKey]);

  const value = useMemo(() => ({
    configs, run, active, runOpen, view: run ? snapshot(run, now || Date.now()) : null, ...actions,
  }), [configs, run, active, runOpen, now, actions]);

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export const useTimer = () => useContext(TimerContext);
