'use client';

import { useEffect, useState } from 'react';
import { PREP_MS, formatClock, snapshot, start } from '../../lib/timer-engine';
import { useInView } from './use-in-view';

// A Tabata from the app's timer engine, running by itself while it is on screen and starting over at the end.
// The ring empties with the time left in the round.
const TABATA = { type: 'tabata', work: 20_000, rest: 10_000, rounds: 8 };
const RADIUS = 92;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The prep countdown is skipped so the clock opens on the first round.
const startTabata = (now) => start(TABATA, now - PREP_MS);

export default function TimerDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    setRun(startTabata(Date.now()));
    setNow(Date.now());
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setRun((current) => (current && snapshot(current, at).done ? startTabata(at) : current));
    }, 100);
    return () => clearInterval(id);
  }, [inView]);

  const snap = run ? snapshot(run, now) : null;
  const rest = snap?.segment.kind === 'rest';
  const clock = snap ? snap.segmentRemaining : TABATA.work;
  const progress = snap ? snap.segmentElapsed / snap.segment.duration : 0;

  return <div className="lp-timer" ref={ref}>
    <div className="lp-timer-face" data-kind={rest ? 'rest' : 'work'}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="lp-ring-track" cx="100" cy="100" r={RADIUS} />
        <circle className="lp-ring" cx="100" cy="100" r={RADIUS}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * Math.min(1, progress)} />
      </svg>
      <div className="lp-timer-readout" role="timer" aria-live="off">
        <span className="lp-timer-phase">{rest ? 'Descanso' : 'Trabajo'}</span>
        <b className="display num">{formatClock(clock, { ceil: true })}</b>
        <span className="lp-timer-caption num">Tabata · ronda {snap?.segment.round ?? 1} de {TABATA.rounds}</span>
      </div>
    </div>
  </div>;
}
