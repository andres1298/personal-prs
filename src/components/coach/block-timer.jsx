'use client';

import { useEffect, useState } from 'react';
import { formatClock, normalizeConfig, TIMER_TYPES } from '../../lib/timer-engine';
import { describe, TEMPLATES } from '../timer/timer-views';
import Icon from '../ui/icon';
import { Choice } from './line-editor';

// unit: how a bare number is read. A coach types "21" for a 21 minute cap and "20" for 20 seconds of work.
const FIELDS = {
  amrap: [['duration', 'Duración', 'min']],
  emom: [['interval', 'Cada', 'min'], ['rounds', 'Rondas']],
  tabata: [['work', 'Trabajo', 's'], ['rest', 'Descanso', 's'], ['rounds', 'Rondas']],
  fortime: [['cap', 'Límite de tiempo', 'min']],
};
const NONE = 'none';
// "Sin cronómetro" goes last, like "Sin carga": most blocks of a WOD are timed.
const TYPE_CHOICES = [...TIMER_TYPES.map((type) => ({ value: type, label: TEMPLATES[type].name })), { value: NONE, label: 'Sin cronómetro' }];
const totalOf = (config) => ({
  amrap: config.duration, fortime: config.cap, emom: config.interval * config.rounds,
  tabata: config.work * config.rounds + config.rest * (config.rounds - 1),
})[config.type];
// Finer steps for short times: 5 s under a minute, 15 s under ten, then a minute.
const stepOf = (value, direction) => { const reference = direction > 0 ? value : value - 1; return reference < 60_000 ? 5_000 : reference < 600_000 ? 15_000 : 60_000; };

function parseTime(text, unit) {
  const clean = text.trim().replace(',', '.');
  if (/^\d+:\d{1,2}$/.test(clean)) { const [minutes, seconds] = clean.split(':').map(Number); return (minutes * 60 + seconds) * 1000; }
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) * (unit === 'min' ? 60_000 : 1000) : NaN;
}

function TimeField({ label, unit, value, onChange }) {
  const shown = unit === 's' && value < 60_000 ? String(value / 1000) : formatClock(value);
  const [text, setText] = useState(shown);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => { const parsed = parseTime(text, unit); if (Number.isFinite(parsed)) onChange(parsed); else setText(shown); };
  return <div className="line-field">
    <span className="line-label">{label} <small>({unit === 'min' ? 'min o m:ss' : 'segundos'})</small></span>
    <div className="stepper-field">
      <button type="button" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => onChange(value - stepOf(value, -1))}><Icon name="minus" weight={2.8} /></button>
      <input inputMode="numeric" value={text} aria-label={label} onChange={(event) => setText(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      <button type="button" aria-label={`Más ${label.toLowerCase()}`} onClick={() => onChange(value + stepOf(value, 1))}><Icon name="plus" weight={2.8} /></button>
    </div>
  </div>;
}

function RoundsField({ label, value, onChange }) {
  return <div className="line-field">
    <span className="line-label">{label}</span>
    <div className="stepper-field">
      <button type="button" aria-label="Una ronda menos" disabled={value <= 1} onClick={() => onChange(value - 1)}><Icon name="minus" weight={2.8} /></button>
      <input inputMode="numeric" value={value} aria-label={label} onChange={(event) => { if (/^\d{1,2}$/.test(event.target.value)) onChange(Number(event.target.value)); }} />
      <button type="button" aria-label="Una ronda más" onClick={() => onChange(value + 1)}><Icon name="plus" weight={2.8} /></button>
    </div>
  </div>;
}

/**
 * The block's workout clock: its type as buttons and its times and rounds. The athlete starts
 * exactly this configuration on the app's timer. The engine clamps values to what it can run.
 */
export default function BlockTimer({ timer, onChange }) {
  const config = timer ? normalizeConfig(timer) : null;
  const set = (patch) => onChange(normalizeConfig({ ...config, ...patch }));
  return <div className="block-timer" style={config ? { '--c': `var(${TEMPLATES[config.type].color})` } : undefined}>
    <div className="line-field">
      <span className="line-label">Cronómetro del bloque</span>
      <Choice label="Tipo de cronómetro" size="small" options={TYPE_CHOICES} value={config?.type ?? NONE}
        onChange={(type) => onChange(type === NONE ? null : normalizeConfig({ type }))} />
    </div>
    {config && <>
      <div className="block-timer-fields">
        {FIELDS[config.type].map(([key, label, unit]) => (unit
          ? <TimeField key={key} label={label} unit={unit} value={config[key]} onChange={(value) => set({ [key]: value })} />
          : <RoundsField key={key} label={label} value={config[key]} onChange={(value) => set({ [key]: value })} />))}
      </div>
      <p className="block-timer-summary"><b>{describe(config)}</b> · {formatClock(totalOf(config))} en total. El atleta lo inicia con un toque.</p>
    </>}
  </div>;
}
