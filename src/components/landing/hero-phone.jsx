'use client';

import { useEffect, useState } from 'react';
import { ALL_PLATES, plateOptions, round5, sum } from '../../lib/plates';
import { num, toKg } from '../../lib/catalog';
import Barbell from './barbell';
import { useInView, useReducedMotion, useTweenedNumber } from './use-in-view';

const PR = 260;
const BAR = 45;
const PERCENTS = [60, 70, 80, 90, 75];
const gym = { bar: BAR, plates: ALL_PLATES };

function loadFor(pct) {
  const goal = Math.max(BAR, round5(PR * pct / 100));
  const plates = plateOptions(goal, gym)[0].plates;
  return { pct, plates, total: BAR + 2 * sum(plates) };
}

// The app's working screen playing by itself: the percentage moves and the barbell reloads.
export default function HeroPhone() {
  const [ref, inView] = useInView();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(2);
  const playing = inView && !reduced;

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % PERCENTS.length), 2400);
    return () => clearInterval(id);
  }, [playing]);

  const load = loadFor(PERCENTS[index]);
  const shown = Math.round(useTweenedNumber(load.total, { enabled: !reduced }));

  return <div className="lp-screen" ref={ref} aria-hidden="true">
    <div className="lp-screen-status"><span>9:41</span><span className="lp-screen-island" /><span>100%</span></div>
    <div className="lp-screen-head" style={{ '--c': 'var(--b-pink)' }}>
      <small>Squats · 1RM</small>
      <b className="display">Back Squat</b>
      <span className="num">PR {PR} lb</span>
    </div>
    <div className="lp-screen-chips">
      {[60, 70, 75, 80, 90].map((pct) => <span key={pct} className="num" data-on={pct === load.pct}>{pct}%</span>)}
    </div>
    <div className="lp-screen-weight">
      <b className="display num">{shown}<small>lb</small></b>
      <span className="num">{toKg(load.total)} kg · {load.pct}% de tu PR</span>
    </div>
    <div className="card lp-screen-card">
      <div className="card-head"><span>Por lado · <b className="num">{num(sum(load.plates))} lb</b></span><span className="card-head-detail">Barra {BAR}</span></div>
      <Barbell bar={BAR} plates={load.plates} loadKey={load.pct} label="" />
    </div>
    <div className="lp-screen-tabs"><span data-on="true">Ejecutar</span><span>PRs</span><span>Timer</span></div>
  </div>;
}
