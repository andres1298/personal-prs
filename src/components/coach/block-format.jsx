'use client';

import { useEffect, useState } from 'react';
import { formatClock, normalizeConfig } from '../../lib/timer-engine';
import { moveInfo } from '../../lib/catalog';
import { LADDER_PRESETS, ladderText, parseLadder } from '../../lib/training';
import { TEMPLATES } from '../timer/timer-views';
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

const STRUCTURES = [{ value: 'rounds', label: 'Rondas' }, { value: 'ladder', label: 'Escalera' }];

/**
 * A rep ladder: a common one in one tap, or any typed with dashes, commas or spaces ("15 12 9").
 * The text is kept while typing and applied when the field is left; an unreadable ladder is flagged.
 */
function LadderField({ value, onChange }) {
  const current = ladderText(value);
  // The box holds a ladder of the coach's own; a common one is already marked among the choices.
  const shown = LADDER_PRESETS.some((ladder) => ladderText(ladder) === current) ? '' : current;
  const [text, setText] = useState(shown);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(shown); setInvalid(false); }, [shown]);
  const commit = () => {
    const ladder = parseLadder(text);
    if (!text.trim()) { setInvalid(false); setText(shown); return; }
    if (ladder) { setInvalid(false); if (ladderText(ladder) !== current) onChange(ladder); else setText(shown); } else setInvalid(true);
  };
  return <div className="format-field ladder-field">
    <span>Escalera de reps</span>
    <Choice label="Escaleras comunes" size="small" value={current} onChange={(next) => onChange(parseLadder(next))}
      options={LADDER_PRESETS.map((ladder) => ({ value: ladderText(ladder), label: ladderText(ladder) }))} />
    <input className="format-text" value={text} placeholder="Otra: 20-16-12-8" aria-label="Otra escalera" aria-invalid={invalid} inputMode="text"
      onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    {invalid && <small className="format-error">Escribe de 2 a 10 números separados por guiones, por ejemplo 21-15-9.</small>}
  </div>;
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
  // A For Time of one round has no rest between rounds.
  const setRounds = (rounds) => onChange({ rounds: rounds > 1 ? rounds : undefined, ...(rounds > 1 || format !== 'fortime' ? {} : { rest: undefined }) });
  const structure = block.ladder ? 'ladder' : 'rounds';
  // A ladder replaces the rounds. Lines that carried the scheme in their reps ("21-15-9") hand it to
  // the block, so it is written once; going back to rounds keeps the lines as they are.
  function setStructure(next) {
    if (next === structure) return;
    if (next === 'rounds') { onChange({ ladder: undefined, ...(format === 'fortime' ? { rest: undefined } : {}) }); return; }
    const written = parseLadder(commonValue(block.items, 'reps'));
    onChange({
      ladder: written ?? LADDER_PRESETS[0], rounds: undefined,
      items: block.items.map((item) => (parseLadder(item.reps) ? { ...item, reps: '' } : item)),
    });
  }
  const rest = <TimeField label="Descanso entre rondas" value={block.rest ?? null} optional onChange={(value) => onChange({ rest: value ?? undefined })} />;
  const repeat = <>
    <div className="format-field">
      <span>Cómo se repite</span>
      <Choice label="Cómo se repite" size="small" value={structure} onChange={setStructure} options={STRUCTURES} />
    </div>
    {structure === 'rounds'
      ? <CountField label="Rondas" value={block.rounds ?? 1} onChange={setRounds} />
      : <LadderField value={block.ladder} onChange={(ladder) => onChange({ ladder })} />}
  </>;

  function pick(next) {
    if (next === format) return;
    // An EMOM of as many rounds as the block had keeps the work the coach already wrote.
    const timer = next === 'rounds' ? undefined : normalizeConfig({ type: next, ...(next === 'emom' && block.rounds ? { rounds: block.rounds } : {}) });
    // Lifts are logged one by one in sets and EMOMs; a workout on the clock is logged as a whole.
    const timed = TIMED.includes(next);
    const items = TIMED.includes(format) === timed ? block.items : block.items.map((item) => (item.movement && moveInfo(item.movement).type === 'weight' && item.load.type !== 'max' ? { ...item, log: !timed } : item));
    const kept = ROUNDED.includes(next);
    onChange({ timer, score: SCORE_OF[next], rest: kept ? block.rest : undefined, rounds: kept ? block.rounds : undefined, ladder: kept ? block.ladder : undefined, items });
  }

  return <div className="block-format">
    <Choice label="Formato del bloque" size="small" value={format} onChange={pick}
      options={FORMAT_CHOICES.map((option) => ({ ...option, color: option.value === 'rounds' ? undefined : TEMPLATES[option.value].color }))} />
    <div className="format-fields">
      {format === 'rounds' && <>{repeat}{rest}</>}
      {format === 'fortime' && <>
        {repeat}
        <TimeField label="Límite" value={config.cap} onChange={(cap) => setTimer({ cap })} />
        {(block.rounds > 1 || block.ladder) && rest}
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
  </div>;
}
