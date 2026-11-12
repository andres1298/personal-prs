'use client';

import { useMemo, useState } from 'react';
import { getCatalog, moveInfo } from '../../lib/catalog';
import { BASE_RMS, itemName, LIMITS, loadText, volumeText } from '../../lib/training';
import { Switch } from '../ui/controls';
import Icon from '../ui/icon';

const CATEGORY_LABELS = { Lift: 'Levantamiento', Gymnastics: 'Gimnasia', Cardio: 'Cardio', Benchmarks: 'Benchmarks' };
const FREE = 'free';
const LOAD_CHOICES = [
  { value: 'none', label: 'Sin carga' }, { value: 'weight', label: 'Peso fijo' },
  { value: 'percent', label: 'Porcentaje' }, { value: 'max', label: 'Máximo del día' },
];
const LOAD_HINTS = {
  none: 'La línea no indica peso.',
  weight: 'El mismo peso para todos.',
  percent: 'Cada atleta ve su peso, calculado con su propio récord.',
  max: 'El atleta sube hasta su peso más alto de hoy y lo anota. Otras líneas pueden usar un porcentaje de ese peso.',
};
const PERCENT_STEPS = [50, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const REP_STEPS = ['1', '2', '3', '5', '8', '10'];
const numberOrNull = (text) => (text.trim() === '' || !Number.isFinite(Number(text.replace(',', '.'))) ? null : Number(text.replace(',', '.')));

/** A labelled group of the line form. */
function Field({ label, hint, children, className = '' }) {
  return <div className={`line-field ${className}`}>
    <span className="line-label">{label}</span>
    {children}
    {hint && <p className="line-hint">{hint}</p>}
  </div>;
}

/** One-of-many as buttons, so every option is visible without opening a menu. */
export function Choice({ options, value, onChange, label, size }) {
  return <div className="choice" role="radiogroup" aria-label={label} data-size={size}>
    {options.map((option) => <button type="button" key={option.value} role="radio" aria-checked={option.value === value}
      style={option.color ? { '--c': `var(${option.color})` } : undefined} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

/**
 * Picks a line's movement: a category first, then its movements as buttons, narrowed by the search.
 * Searching looks in every category. "Texto libre" keeps anything that is not in the catalog.
 */
function MovementPicker({ item, onPick, onCreateMovement }) {
  const catalog = getCatalog();
  const info = item.movement ? moveInfo(item.movement) : null;
  const [category, setCategory] = useState(item.movement ? info.tab ?? 'Lift' : item.label ? FREE : 'Lift');
  const [query, setQuery] = useState('');
  const text = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const tabs = text ? Object.keys(catalog) : [category];
    return tabs.flatMap((tab) => (catalog[tab]?.groups ?? []).map((group) => ({
      ...group, moves: text ? group.moves.filter((move) => move.toLowerCase().includes(text)) : group.moves,
    }))).filter((group) => group.moves.length);
  }, [catalog, category, text]);
  const categories = [...Object.keys(catalog).map((tab) => ({ value: tab, label: CATEGORY_LABELS[tab] ?? tab })), { value: FREE, label: 'Texto libre' }];

  return <Field label="Movimiento">
    <Choice label="Tipo de movimiento" options={categories} value={category} onChange={(next) => { setCategory(next); setQuery(''); }} />
    {category === FREE ? <>
      <input className="line-input" value={item.movement ? '' : item.label} maxLength={LIMITS.label} placeholder="Escribe el ejercicio, p. ej. «Clean Pull» o «1 Clean + 2 Jerks»"
        aria-label="Texto libre" onChange={(event) => onPick({ movement: null, label: event.target.value })} />
      <p className="line-hint">
        El texto libre no se enlaza con los PRs de tus atletas.
        {!item.movement && item.label.trim() && <> <button type="button" onClick={onCreateMovement}>Crear «{item.label.trim()}» como movimiento</button> para que puedan llevar su récord.</>}
      </p>
    </> : <>
      <input className="line-input search" type="search" value={query} placeholder={`Buscar en ${text ? 'todo el catálogo' : (CATEGORY_LABELS[category] ?? category).toLowerCase()}…`}
        aria-label="Buscar movimiento" onChange={(event) => setQuery(event.target.value)} />
      <div className="move-list">
        {groups.map((group) => <div className="move-group" key={group.name} style={{ '--c': `var(${group.color})` }}>
          <span>{group.name}</span>
          <div>
            {group.moves.map((move) => <button type="button" key={move} aria-pressed={move === item.movement}
              onClick={() => onPick({ movement: move, label: '' })}>{move}</button>)}
          </div>
        </div>)}
        {!groups.length && <p className="line-hint">Ningún movimiento coincide. Prueba otra categoría o usa «Texto libre».</p>}
      </div>
    </>}
  </Field>;
}

/**
 * One line of a block. Closed, it reads like the whiteboard ("Back Squat · 5 × 3 · 75 % de 1RM");
 * open, it is a roomy form. The editor keeps one line open at a time.
 */
export default function LineEditor({ item, content, earlier, weightNames, preview, open, onOpen, onClose, onChange, onMove, onRemove, onCreateMovement }) {
  const { load } = item;
  const [choosing, setChoosing] = useState(!item.movement && !item.label);
  const name = itemName(item);
  const usesWeight = !item.movement || moveInfo(item.movement).type === 'weight';
  const setLoad = (patch) => onChange({ load: { ...load, ...patch } });
  const setType = (type) => {
    if (type === 'percent') setLoad({ type, value: load.type === 'percent' ? load.value : 75, base: { kind: 'pr', movement: null, rm: 1 } });
    else setLoad({ type, value: type === 'weight' && load.type === 'weight' ? load.value : null, base: null });
  };
  // Lines the athlete logs a weight on can be the base of a later percentage ("85 % of today's heavy single").
  const baseLines = earlier.filter((other) => other.log || other.load.type === 'max');
  const baseValue = load.base?.kind === 'item' ? `item:${load.base.itemId}` : `pr:${load.base?.rm ?? 1}`;
  const setBase = (value) => {
    const [kind, key] = value.split(':');
    setLoad({ base: kind === 'item' ? { kind: 'item', itemId: key } : { kind: 'pr', movement: load.base?.kind === 'pr' ? load.base.movement : null, rm: Number(key) } });
  };
  const needsMovement = load.type === 'percent' && load.base.kind === 'pr' && !item.movement && !load.base.movement;
  const summary = [volumeText(item), loadText(item, content)].filter(Boolean).join(' · ');
  const tools = <span className="line-tools">
    <button type="button" className="icon-button" aria-label="Subir línea" onClick={() => onMove(-1)}><Icon name="arrowUp" /></button>
    <button type="button" className="icon-button" aria-label="Bajar línea" onClick={() => onMove(1)}><Icon name="arrowDown" /></button>
    <button type="button" className="icon-button danger" aria-label="Quitar línea" onClick={onRemove}><Icon name="xmark" /></button>
  </span>;

  if (!open) {
    return <div className="line" data-open="false">
      <button type="button" className="line-summary" onClick={onOpen}>
        <b>{name || 'Línea sin movimiento'}</b>
        <span>{summary || 'Toca para completar'}{preview?.weight != null && <em className="num"> → {preview.weight} lb</em>}</span>
        <small>{item.log || load.type === 'max' ? 'El atleta anota' : 'Informativa'}{item.notes ? ` · ${item.notes}` : ''}</small>
      </button>
      {tools}
    </div>;
  }

  return <div className="line" data-open="true">
    <header className="line-head">
      <b>{name || 'Nueva línea'}</b>
      {tools}
    </header>

    {choosing ? <MovementPicker item={item} onCreateMovement={onCreateMovement}
      onPick={(patch) => {
        // A movement that is not lifted (gymnastics, cardio, benchmarks) carries no load.
        const lifted = !patch.movement || moveInfo(patch.movement).type === 'weight';
        onChange(lifted ? patch : { ...patch, load: { type: 'none', value: null, base: null } });
        if (patch.movement) setChoosing(false);
      }} />
      : <Field label="Movimiento">
        <div className="line-picked">
          <b>{name}</b>
          <button type="button" className="tinted-button" onClick={() => setChoosing(true)}>Cambiar</button>
        </div>
      </Field>}

    <div className="line-row">
      <Field label="Series">
        <div className="stepper-field">
          <button type="button" aria-label="Una serie menos" disabled={!item.sets} onClick={() => onChange({ sets: item.sets > 1 ? item.sets - 1 : null })}><Icon name="minus" weight={2.8} /></button>
          <input inputMode="numeric" value={item.sets ?? ''} placeholder="–" aria-label="Series"
            onChange={(event) => onChange({ sets: /^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0 ? Number(event.target.value) : null })} />
          <button type="button" aria-label="Una serie más" disabled={item.sets >= 99} onClick={() => onChange({ sets: (item.sets ?? 0) + 1 })}><Icon name="plus" weight={2.8} /></button>
        </div>
      </Field>
      <Field label="Repeticiones" hint="Acepta texto: «1+2», «máx», «30 s».">
        <div className="pick-row">
          <input className="line-input short" value={item.reps} maxLength={LIMITS.reps} placeholder="–" aria-label="Repeticiones" onChange={(event) => onChange({ reps: event.target.value })} />
          <Choice label="Repeticiones frecuentes" size="small" options={REP_STEPS.map((reps) => ({ value: reps, label: reps }))} value={item.reps} onChange={(reps) => onChange({ reps })} />
        </div>
      </Field>
    </div>

    {usesWeight && <Field label="Carga" hint={LOAD_HINTS[load.type]}>
      <Choice label="Tipo de carga" options={LOAD_CHOICES} value={load.type} onChange={setType} />
    </Field>}

    {load.type === 'weight' && <Field label="Peso">
      <label className="unit-input"><input inputMode="decimal" value={load.value ?? ''} placeholder="0" aria-label="Peso en libras"
        onChange={(event) => setLoad({ value: numberOrNull(event.target.value) })} /><span>lb</span></label>
    </Field>}

    {load.type === 'percent' && <>
      <Field label="Porcentaje">
        <div className="pick-row">
          <label className="unit-input"><input inputMode="decimal" value={load.value ?? ''} placeholder="0" aria-label="Porcentaje"
            onChange={(event) => setLoad({ value: numberOrNull(event.target.value) })} /><span>%</span></label>
          <Choice label="Porcentajes frecuentes" size="small" options={PERCENT_STEPS.map((step) => ({ value: step, label: String(step) }))} value={load.value} onChange={(value) => setLoad({ value })} />
        </div>
      </Field>
      <Field label="Calculado sobre" hint={load.base.kind === 'item' ? 'Se calcula cuando el atleta anote esa línea.' : undefined}>
        <Choice label="Base del porcentaje" value={baseValue} onChange={setBase} options={[
          ...BASE_RMS.map((rm) => ({ value: `pr:${rm}`, label: `Su ${rm}RM` })),
          ...baseLines.map((other) => ({ value: `item:${other.id}`, label: `Peso de hoy en «${itemName(other)}»` })),
        ]} />
      </Field>
      {load.base.kind === 'pr' && <Field label="Récord de" hint="Elige otro movimiento para, por ejemplo, un pull al 110 % del clean.">
        <select className="line-select" aria-label="Movimiento base" value={load.base.movement ?? ''}
          onChange={(event) => setLoad({ base: { ...load.base, movement: event.target.value || null } })}>
          <option value="">{item.movement ? `El mismo movimiento (${item.movement})` : 'Elige un movimiento'}</option>
          {weightNames.filter((candidate) => candidate !== item.movement).map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
        </select>
        {needsMovement && <p className="line-hint warn">Un texto libre no tiene récord: elige de qué movimiento se calcula.</p>}
      </Field>}
      {preview && <p className="line-preview">
        {preview.weight != null ? <><b className="num">{preview.weight} lb</b> para este atleta · base {preview.base} lb</>
          : preview.missing === 'pr' ? 'Este atleta todavía no tiene ese récord: verá el porcentaje y un aviso para registrarlo.'
            : 'Se calcula cuando el atleta anote la línea base.'}
      </p>}
    </>}

    <Field label="Registro">
      <label className="line-switch">
        <Switch checked={item.log || load.type === 'max'} disabled={load.type === 'max'} label="El atleta anota peso y reps" onChange={(log) => onChange({ log })} />
        <span>{item.log || load.type === 'max' ? 'El atleta anota el peso y las reps que hizo' : 'Solo informativa: el atleta no anota nada'}</span>
      </label>
    </Field>

    <Field label="Nota de la línea">
      <input className="line-input" value={item.notes} maxLength={LIMITS.notes} placeholder="Opcional: tempo, descanso, RPE…" aria-label="Nota de la línea"
        onChange={(event) => onChange({ notes: event.target.value })} />
    </Field>

    <footer className="line-foot">
      <button type="button" className="pill-btn" onClick={onClose}><Icon name="check" weight={3} />Listo</button>
    </footer>
  </div>;
}
