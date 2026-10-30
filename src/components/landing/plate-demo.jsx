'use client';

import { useId, useState } from 'react';
import { ALL_PLATES, BARS, computeLoad, sum } from '../../lib/plates';
import { num, toKg } from '../../lib/catalog';
import Icon from '../ui/icon';
import Barbell, { MiniPlates } from './barbell';
import { useReducedMotion, useTweenedNumber } from './use-in-view';

// Personal records from the app's sample data, with each group's block color.
const MOVES = [
  { name: 'Back Squat', pr: 260, color: '--b-pink' },
  { name: 'Front Squat', pr: 215, color: '--b-pink' },
  { name: 'Squat Clean', pr: 165, color: '--b-blue' },
  { name: 'Bench Press', pr: 140, color: '--b-yellow' },
];
const QUICK_PERCENTS = [60, 70, 80, 90];
const MIN_PR = 45;
const MAX_PR = 900;

// The working screen of the app, live: same plate and warm-up logic, no account and nothing saved.
export default function PlateDemo() {
  const id = useId();
  const reduced = useReducedMotion();
  const [move, setMove] = useState(MOVES[0]);
  const [prText, setPrText] = useState(String(MOVES[0].pr));
  const [pct, setPct] = useState(80);
  const [bar, setBar] = useState(45);
  const [sel, setSel] = useState(0);

  const typed = Number(prText);
  const pr = Number.isFinite(typed) && typed >= MIN_PR && typed <= MAX_PR ? typed : move.pr;
  const settings = { bar, plates: ALL_PLATES };
  const load = computeLoad({ base: pr, pct, sel }, settings);
  const option = load.options[load.selected];
  const shown = Math.round(useTweenedNumber(load.target, { enabled: !reduced, duration: 450 }));

  const pickMove = (next) => { setMove(next); setPrText(String(next.pr)); setSel(0); };
  const change = (update) => (value) => { update(value); setSel(0); };

  return <div className="lp-demo" style={{ '--c': `var(${move.color})` }}>
    <div className="lp-demo-controls">
      <fieldset className="lp-field">
        <legend>Movimiento</legend>
        <div className="lp-chips">
          {MOVES.map((item) => <button key={item.name} type="button" aria-pressed={item === move}
            style={{ '--c': `var(${item.color})` }} onClick={() => pickMove(item)}>{item.name}</button>)}
        </div>
      </fieldset>

      <div className="lp-field">
        <label htmlFor={`${id}-pr`}>Tu PR (1RM)</label>
        <div className="lp-input">
          <input id={`${id}-pr`} type="number" inputMode="numeric" min={MIN_PR} max={MAX_PR} step="5" value={prText}
            onChange={(event) => change(setPrText)(event.target.value)} aria-describedby={`${id}-pr-hint`} />
          <span>lb</span>
        </div>
        <small id={`${id}-pr-hint`} className="lp-hint">Escribe tu marca: entre {MIN_PR} y {MAX_PR} lb.</small>
      </div>

      <div className="lp-field">
        <label htmlFor={`${id}-pct`}>Porcentaje de hoy <b className="num">{pct}%</b></label>
        <input id={`${id}-pct`} className="lp-range" type="range" min="40" max="100" step="5" value={pct}
          style={{ '--fill': `${((pct - 40) / 60) * 100}%` }} onChange={(event) => change(setPct)(Number(event.target.value))} />
        <div className="lp-chips small">
          {QUICK_PERCENTS.map((value) => <button key={value} type="button" className="num" aria-pressed={value === pct}
            onClick={() => change(setPct)(value)}>{value}%</button>)}
        </div>
      </div>

      <fieldset className="lp-field">
        <legend>Barra</legend>
        <div className="lp-segmented" style={{ '--count': BARS.length, '--index': BARS.indexOf(bar) }}>
          {BARS.map((value) => <button key={value} type="button" className="num" aria-pressed={value === bar}
            onClick={() => change(setBar)(value)}>{value} lb</button>)}
        </div>
      </fieldset>
    </div>

    <div className="lp-demo-result" aria-live="polite">
      <div className="lp-result-head">
        <div>
          <p className="lp-kicker">{move.name} · {pct}% de {num(pr)} lb</p>
          <p className="lp-big display num">{shown}<small>lb</small></p>
          <p className="lp-sub num">{toKg(load.target)} kg{Math.abs(load.raw - load.target) >= 0.1 ? ` · ${num(load.raw)} lb redondeado a lo que puedes armar` : ''}</p>
        </div>
      </div>

      <div className="card lp-load">
        <div className="card-head">
          <span>Por lado · <b className="num">{num(sum(load.plates ?? []))} lb</b></span>
          <span className="card-head-detail">Barra {bar} lb</span>
        </div>
        <Barbell bar={bar} plates={load.plates ?? []} loadKey={load.key}
          label={load.plates?.length ? `Por lado: ${load.plates.join(' + ')} lb` : 'Solo la barra'} />
        {load.options.length > 1 && <div className="option-nav">
          <button type="button" disabled={load.selected === 0} aria-label="Opción anterior" onClick={() => setSel(load.selected - 1)}>
            <Icon name="chevronLeft" weight={2.6} />
          </button>
          <div className="option-mid">
            <b>{option.label}</b>
            <div className="page-dots">{load.options.map((_, i) => <i key={i} className={i === load.selected ? 'on' : ''} />)}</div>
          </div>
          <button type="button" disabled={load.selected === load.options.length - 1} aria-label="Opción siguiente"
            onClick={() => setSel(load.selected + 1)}>
            <Icon name="chevronRight" weight={2.6} />
          </button>
        </div>}
      </div>

      <div className="lp-ladder">
        <h3 className="lp-ladder-title">Calentamiento <span>desde la barra sola</span></h3>
        <ol key={load.key}>
          {load.ladder.map((set, index) => <li key={index} style={{ '--i': index }} data-final={set.reps == null}>
            <span className="lp-ladder-load num"><b>{set.total}</b> lb</span>
            <span className="lp-ladder-reps num">{set.reps == null ? 'Serie' : `×${set.reps}`}</span>
            <span className="lp-ladder-note">{set.note}</span>
            <MiniPlates plates={set.plates} />
          </li>)}
        </ol>
      </div>
    </div>
  </div>;
}
