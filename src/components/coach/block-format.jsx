'use client';

import { useEffect, useState } from 'react';
import { formatClock, normalizeConfig } from '../../lib/timer-engine';
import { moveInfo } from '../../lib/catalog';
import { LIMITS } from '../../lib/training';
import { describe, TEMPLATES } from '../timer/timer-views';
import Icon from '../ui/icon';
import { Choice } from './line-editor';

/**
 * How a block is done, chosen once for the whole block: rounds of its lines at the athlete's
 * pace, or one of the timer's workouts. Each format shows only its own values, in one row, and
 * sets what the athlete logs. Rounds belong to the block: all of its lines repeat together.
 */
export const FORMATS = ['rounds', 'fortime', 'amrap', 'emom', 'tabata'];
const FORMAT_CHOICES = FORMATS.map((value) => ({ value, label: value === 'rounds' ? 'Rondas' : TEMPLATES[value].name }));
const SCORE_OF = { rounds: 'none', fortime: 'time', amrap: 'reps', emom: 'none', tabata: 'reps' };
/** Formats where the block's own rounds apply; the others count rounds on their clock. */
const ROUNDED = ['rounds', 'fortime'];
export const formatOf = (block) => block.timer?.type ?? 'rounds';
/** Formats done against the clock and scored as a whole. */
export const TIMED = ['fortime', 'amrap', 'tabata'];

/** The value every line of the block shares (their reps), or null when they differ. */
export function commonValue(items, key) {
  const values = items.filter((item) => item.movement || item.label).map((item) => item[key]);
  return values.length && values.every((value) => value === values[0]) ? values[0] : null;
}

// A bare number is minutes ("20" for a 20 minute cap) or, for seconds fields, seconds ("20" of work).
function parseTime(text, unit) {
  const clean = text.trim().replace(',', '.');
  if (/^\d+:\d{1,2}$/.test(clean)) { const [minutes, seconds] = clean.split(':').map(Number); return (minutes * 60 + seconds) * 1000; }
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) * (unit === 's' ? 1000 : 60_000) : NaN;
}
// Finer steps for short times: 5 s under a minute, 15 s under ten, then a minute.
const stepOf = (value, direction) => { const reference = direction > 0 ? value : value - 1; return reference < 60_000 ? 5_000 : reference < 600_000 ? 15_000 : 60_000; };

/** A time in m:ss; a bare number is minutes. Optional times start empty and can be cleared. */
function TimeField({ label, value, unit = 'min', optional = false, onChange }) {
  const shown = !value ? '' : unit === 's' && value < 60_000 ? String(value / 1000) : formatClock(value);
  const [text, setText] = useState(shown);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => {
    if (optional && !text.trim()) { onChange(null); return; }
    const parsed = parseTime(text, unit);
    if (Number.isFinite(parsed) && parsed > 0) onChange(parsed); else setText(shown);
  };
  const down = () => { const next = value - stepOf(value, -1); onChange(optional && next < 5_000 ? null : Math.max(next, 5_000)); };
  return <label className="format-field">
    <span>{label}</span>
    <span className="stepper-field">
      <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={!value} onClick={down}><Icon name="minus" weight={2.8} /></button>
      <input inputMode="numeric" value={text} placeholder="–" aria-label={`${label} (${unit === 's' ? 'segundos' : 'm:ss'})`} onChange={(event) => setText(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      <button type="button" aria-label={`Más ${label.toLowerCase()}`} onClick={() => onChange(value ? value + stepOf(value, 1) : 60_000)}><Icon name="plus" weight={2.8} /></button>
    </span>
  </label>;
}

/** A whole number from `min`; below it the value is cleared when `min` is 1 and the field optional. */
function CountField({ label, value, optional = false, onChange }) {
  return <label className="format-field">
    <span>{label}</span>
    <span className="stepper-field">
      <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={optional ? !value : value <= 1}
        onClick={() => onChange(value > 1 ? value - 1 : null)}><Icon name="minus" weight={2.8} /></button>
      <input inputMode="numeric" value={value ?? ''} placeholder="–" aria-label={label}
        onChange={(event) => { const next = event.target.value; if (next === '' && optional) onChange(null); else if (/^\d{1,2}$/.test(next) && Number(next) > 0) onChange(Number(next)); }} />
      <button type="button" aria-label={`Más ${label.toLowerCase()}`} disabled={value >= 99} onClick={() => onChange((value ?? 0) + 1)}><Icon name="plus" weight={2.8} /></button>
    </span>
  </label>;
}

export default function BlockFormat({ block, onChange }) {
  const format = formatOf(block);
  const config = block.timer ? normalizeConfig(block.timer) : null;
  const setTimer = (patch) => onChange({ timer: normalizeConfig({ ...config, ...patch }) });
  // A rep scheme for the whole block ("21-15-9") is written on every line at once.
  const setAll = (key, value) => onChange({ items: block.items.map((item) => ({ ...item, [key]: value })) });
  const reps = commonValue(block.items, 'reps');
  // A For Time of one round has no rest between rounds.
  const setRounds = (rounds) => onChange({ rounds: rounds > 1 ? rounds : undefined, ...(rounds > 1 || format !== 'fortime' ? {} : { rest: undefined }) });

  function pick(next) {
    if (next === format) return;
    // An EMOM of as many rounds as the block had keeps the work the coach already wrote.
    const timer = next === 'rounds' ? undefined : normalizeConfig({ type: next, ...(next === 'emom' && block.rounds ? { rounds: block.rounds } : {}) });
    // Lifts are logged one by one in sets and EMOMs; a workout on the clock is logged as a whole.
    const timed = TIMED.includes(next);
    const items = TIMED.includes(format) === timed ? block.items : block.items.map((item) => (item.movement && moveInfo(item.movement).type === 'weight' && item.load.type !== 'max' ? { ...item, log: !timed } : item));
    onChange({ timer, score: SCORE_OF[next], rest: ROUNDED.includes(next) ? block.rest : undefined, rounds: ROUNDED.includes(next) ? block.rounds : undefined, items });
  }

  return <div className="block-format">
    <Choice label="Formato del bloque" size="small" value={format} onChange={pick}
      options={FORMAT_CHOICES.map((option) => ({ ...option, color: option.value === 'rounds' ? undefined : TEMPLATES[option.value].color }))} />
    <div className="format-fields">
      {format === 'rounds' && <>
        <CountField label="Rondas" value={block.rounds ?? 1} onChange={setRounds} />
        <TimeField label="Descanso entre rondas" value={block.rest ?? null} optional onChange={(rest) => onChange({ rest: rest ?? undefined })} />
      </>}
      {format === 'fortime' && <>
        <CountField label="Rondas" value={block.rounds ?? 1} onChange={setRounds} />
        <label className="format-field">
          <span>Reps de todas las líneas</span>
          <input className="format-text" value={reps ?? ''} maxLength={LIMITS.reps} placeholder="21-15-9" aria-label="Reps de todas las líneas"
            onChange={(event) => setAll('reps', event.target.value)} />
        </label>
        <TimeField label="Límite" value={config.cap} onChange={(cap) => setTimer({ cap })} />
        {block.rounds > 1 && <TimeField label="Descanso entre rondas" value={block.rest ?? null} optional onChange={(rest) => onChange({ rest: rest ?? undefined })} />}
      </>}
      {format === 'amrap' && <TimeField label="Duración" value={config.duration} onChange={(duration) => setTimer({ duration })} />}
      {format === 'emom' && <>
        <TimeField label="Cada" value={config.interval} onChange={(interval) => setTimer({ interval })} />
        <CountField label="Rondas" value={config.rounds} onChange={(rounds) => setTimer({ rounds: rounds ?? 1 })} />
      </>}
      {format === 'tabata' && <>
        <TimeField label="Trabajo" unit="s" value={config.work} onChange={(work) => setTimer({ work })} />
        <TimeField label="Descanso" unit="s" value={config.rest} onChange={(rest) => setTimer({ rest })} />
        <CountField label="Rondas" value={config.rounds} onChange={(rounds) => setTimer({ rounds: rounds ?? 1 })} />
      </>}
    </div>
    {config && <p className="format-summary">{describe(config)}. El atleta inicia el cronómetro desde el bloque.</p>}
  </div>;
}
