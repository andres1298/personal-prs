'use client';

import { useEffect, useRef, useState } from 'react';
import { addRound, cuesBetween, formatClock, pause, resume, snapshot, start } from '../../lib/timer-engine';
import Icon from '../ui/icon';

// The app's timer engine with one recommended setup per template.
const TEMPLATES = [
  { type: 'tabata', name: 'Tabata', detail: '20 s trabajo · 10 s descanso · 8 rondas', color: '--b-lilac', config: { type: 'tabata', work: 20_000, rest: 10_000, rounds: 8 } },
  { type: 'emom', name: 'EMOM', detail: 'Cada minuto, 10 minutos', color: '--b-blue', config: { type: 'emom', interval: 60_000, rounds: 10 } },
  { type: 'amrap', name: 'AMRAP', detail: 'Todas las rondas posibles en 12 min', color: '--b-green', config: { type: 'amrap', duration: 720_000 } },
  { type: 'fortime', name: 'For Time', detail: 'Lo más rápido posible · tope 12 min', color: '--b-yellow', config: { type: 'fortime', cap: 720_000 } },
];

const RADIUS = 92;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function phase(snap) {
  if (snap.done) return 'Terminado';
  if (snap.paused) return 'En pausa';
  if (snap.resuming) return 'Sigue en';
  if (snap.segment.kind === 'prep') return 'Prepárate';
  return snap.segment.kind === 'rest' ? 'Descanso' : 'Trabajo';
}

export default function TimerDemo() {
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(0);
  const [pulse, setPulse] = useState(0);
  const last = useRef(0);

  const snap = run ? snapshot(run, now) : null;
  const ticking = Boolean(run) && !snap?.done && !snap?.paused;

  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [ticking]);

  // 3-2-1 and segment changes flash the ring, as the app beeps.
  useEffect(() => {
    if (!snap) return;
    if (snap.elapsed > last.current && cuesBetween(snap.plan, last.current, snap.elapsed).length) setPulse((n) => n + 1);
    last.current = snap.elapsed;
  }, [snap]);

  const choose = (next) => { setTemplate(next); setRun(null); last.current = 0; };
  const begin = () => { const at = Date.now(); last.current = 0; setNow(at); setRun(start(template.config, at)); };
  const toggle = () => {
    const at = Date.now();
    setNow(at);
    setRun((current) => (snapshot(current, at).paused ? resume(current, at) : pause(current, at)));
  };

  const plan = snap?.plan;
  const type = template.type;
  let clock = template.config.work ?? template.config.interval ?? template.config.duration ?? 0;
  let progress = 0;
  let countsUp = false;
  let caption = template.detail;
  if (snap) {
    const { segment } = snap;
    progress = snap.done ? 1 : snap.segmentElapsed / segment.duration;
    // For Time counts up; everything else counts down what is left of the segment.
    if (snap.resuming) clock = snap.resumeRemaining;
    else if (type === 'fortime' && segment.kind !== 'prep') { clock = snap.workElapsed; countsUp = true; }
    else clock = snap.segmentRemaining;
    caption = segment.kind === 'prep' ? 'El workout empieza al terminar la cuenta'
      : plan.totalRounds > 1 ? `Ronda ${segment.round} de ${plan.totalRounds}`
        : `${snap.rounds} ${snap.rounds === 1 ? 'ronda' : 'rondas'} completadas`;
    if (snap.done) caption = type === 'fortime' || type === 'amrap' ? `${snap.rounds} ${snap.rounds === 1 ? 'ronda' : 'rondas'} · ${formatClock(snap.workElapsed)}` : '¡Buen trabajo!';
  }
  const kind = snap ? (snap.done ? 'done' : snap.resuming || snap.paused ? 'paused' : snap.segment.kind) : 'idle';
  const countsRounds = snap && !snap.done && snap.segment.kind !== 'prep' && (type === 'amrap' || type === 'fortime');

  return <div className="lp-timer" style={{ '--c': `var(${template.color})` }}>
    <div className="lp-timer-tabs" role="group" aria-label="Plantilla de timer">
      {TEMPLATES.map((item) => <button key={item.type} type="button" aria-pressed={item === template}
        style={{ '--c': `var(${item.color})` }} onClick={() => choose(item)}>{item.name}</button>)}
    </div>

    <div className="lp-timer-face" data-kind={kind}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="lp-ring-track" cx="100" cy="100" r={RADIUS} />
        <circle className="lp-ring" cx="100" cy="100" r={RADIUS}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)))} />
      </svg>
      {pulse > 0 && <span key={pulse} className="lp-ring-pulse" aria-hidden="true" />}
      <div className="lp-timer-readout" role="timer" aria-live="off">
        <span className="lp-timer-phase">{snap ? phase(snap) : template.name}</span>
        <b className="display num">{formatClock(clock, { ceil: Boolean(snap) && !countsUp })}</b>
        <span className="lp-timer-caption">{caption}</span>
      </div>
    </div>

    <div className="lp-timer-actions">
      {!snap || snap.done
        ? <button type="button" className="lp-btn lp-btn-block" onClick={begin}><Icon name="play" fill size={20} />{snap?.done ? 'Otra vez' : 'Iniciar'}</button>
        : <>
          <button type="button" className="lp-btn lp-btn-block" onClick={toggle}>
            <Icon name={snap.paused ? 'play' : 'pause'} fill={snap.paused} size={20} weight={2.6} />{snap.paused ? 'Seguir' : 'Pausa'}
          </button>
          {countsRounds && <button type="button" className="lp-btn lp-btn-ghost" onClick={() => setRun((current) => addRound(current))}>
            <Icon name="plus" size={20} weight={2.6} />Ronda
          </button>}
          <button type="button" className="lp-btn lp-btn-ghost" onClick={() => choose(template)}><Icon name="undo" size={20} />Reiniciar</button>
        </>}
    </div>
  </div>;
}
