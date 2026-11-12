'use client';

import { useMemo, useState } from 'react';
import { getCatalog, moveInfo } from '../../lib/catalog';
import { BASE_RMS, complexLabel, itemName, LIMITS, loadText, volumeText } from '../../lib/training';
import { Switch } from '../ui/controls';
import Icon from '../ui/icon';

const TAB_LABELS = { Gymnastics: 'Gimnasia', Cardio: 'Cardio', Benchmarks: 'Benchmarks' };
const TAB_COLORS = { Gymnastics: '--b-lime', Cardio: '--b-cyan', Benchmarks: '--b-lilac' };
const COMPLEX = 'complex';
const FREE = 'free';
// "Sin carga" goes last: most lines carry a load, so it is the exception to pick on purpose.
const LOAD_CHOICES = [
  { value: 'percent', label: 'Porcentaje' }, { value: 'weight', label: 'Peso fijo' },
  { value: 'max', label: 'Máximo del día' }, { value: 'none', label: 'Sin carga' },
];
/** The load a new line starts with: a percentage of the 1RM, still waiting for its number. */
export const DEFAULT_LOAD = { type: 'percent', value: null, base: { kind: 'pr', movement: null, rm: 1 } };
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
 * Picks a line's movement in two steps, so only a handful of options show at a time: first a
 * category (each lift family, gymnastics, cardio, benchmarks, a complex or free text), then
 * that category's movements. Typing in the search skips the steps and looks in the whole catalog.
 */
function MovementPicker({ item, weightNames, onPick, onCreateMovement }) {
  const catalog = getCatalog();
  // Lift families are categories on their own; the other tabs are one category each.
  const categories = useMemo(() => [
    ...(catalog.Lift?.groups ?? []).map((group) => ({ key: `lift:${group.name}`, label: group.name, color: group.color, groups: [group] })),
    { key: COMPLEX, label: 'Complex', color: '--b-coral', hint: 'Combinación de movimientos' },
    ...Object.keys(catalog).filter((tab) => tab !== 'Lift' && catalog[tab].groups.length)
      .map((tab) => ({ key: tab, label: TAB_LABELS[tab] ?? tab, color: TAB_COLORS[tab] ?? '--b-gray', groups: catalog[tab].groups })),
    { key: FREE, label: 'Texto libre', color: '--b-gray', hint: 'Cualquier otro ejercicio' },
  ], [catalog]);
  const initial = item.parts ? COMPLEX
    : item.movement ? categories.find((category) => category.groups?.some((group) => group.moves.includes(item.movement)))?.key ?? null
      : item.label ? FREE : null;
  const [key, setKey] = useState(initial);
  const [query, setQuery] = useState('');
  const text = query.trim().toLowerCase();
  const category = categories.find((candidate) => candidate.key === key);
  const matches = useMemo(() => (text ? Object.values(catalog).flatMap((tab) => tab.groups)
    .flatMap((group) => group.moves.filter((move) => move.toLowerCase().includes(text)).map((move) => ({ move, color: group.color }))) : []), [catalog, text]);
  const moveButton = (move, color) => <button type="button" key={move} aria-pressed={move === item.movement} style={{ '--c': `var(${color})` }}
    onClick={() => onPick({ movement: move, label: '', parts: undefined })}>{move}</button>;
  const back = <button type="button" className="picker-back" onClick={() => setKey(null)}><Icon name="chevronLeft" weight={2.8} />Categorías</button>;

  if (text || !category) {
    return <Field label="Movimiento" hint={text ? undefined : 'Elige una categoría para ver sus movimientos, o búscalo por nombre.'}>
      <input className="line-input search" type="search" value={query} placeholder="Buscar un movimiento por nombre…" aria-label="Buscar movimiento"
        onChange={(event) => setQuery(event.target.value)} />
      {text ? <div className="move-buttons">
        {matches.map(({ move, color }) => moveButton(move, color))}
        {!matches.length && <p className="line-hint">Ningún movimiento coincide. Borra la búsqueda y elige «Texto libre» para escribirlo.</p>}
      </div> : <div className="category-tiles" role="group" aria-label="Categorías">
        {categories.map((candidate) => <button type="button" key={candidate.key} style={{ '--c': `var(${candidate.color})` }} onClick={() => setKey(candidate.key)}>
          <b>{candidate.label}</b>
          <small>{candidate.hint ?? `${candidate.groups.reduce((count, group) => count + group.moves.length, 0)} movimientos`}</small>
        </button>)}
      </div>}
    </Field>;
  }

  if (key === COMPLEX) {
    const parts = item.parts ?? [{ reps: 1, movement: '' }, { reps: 1, movement: '' }];
    // Parts still missing a movement stay on screen but out of the saved text.
    const setParts = (next) => {
      const ready = next.filter((part) => part.movement);
      onPick({ movement: null, label: complexLabel(ready), parts: next });
    };
    const patchPart = (index, patch) => setParts(parts.map((part, at) => (at === index ? { ...part, ...patch } : part)));
    return <Field label="Complex" hint="Los movimientos se hacen seguidos, sin soltar la barra. Las series y la carga se eligen abajo.">
      {back}
      <div className="complex">
        {parts.map((part, index) => <div className="complex-part" key={index}>
          {index > 0 && <span className="complex-plus" aria-hidden="true">+</span>}
          <div className="stepper-field">
            <button type="button" aria-label="Una repetición menos" disabled={part.reps <= 1} onClick={() => patchPart(index, { reps: part.reps - 1 })}><Icon name="minus" weight={2.8} /></button>
            <output aria-label="Repeticiones">{part.reps}</output>
            <button type="button" aria-label="Una repetición más" disabled={part.reps >= 99} onClick={() => patchPart(index, { reps: part.reps + 1 })}><Icon name="plus" weight={2.8} /></button>
          </div>
          <select className="line-select" aria-label={`Movimiento ${index + 1} del complex`} value={part.movement} onChange={(event) => patchPart(index, { movement: event.target.value })}>
            <option value="">Elige un movimiento</option>
            {weightNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {parts.length > 2 && <button type="button" className="icon-button danger" aria-label="Quitar movimiento del complex" onClick={() => setParts(parts.filter((_, at) => at !== index))}><Icon name="xmark" /></button>}
        </div>)}
      </div>
      <button type="button" className="tinted-button" disabled={parts.length >= LIMITS.parts} onClick={() => setParts([...parts, { reps: 1, movement: '' }])}><Icon name="plus" weight={2.8} />Agregar movimiento</button>
      {item.label && <p className="line-hint">
        Se verá como <b>{item.label}</b>.{' '}
        <button type="button" onClick={onCreateMovement}>Crearlo como movimiento</button> para que tus atletas lleven su récord de este complex.
      </p>}
    </Field>;
  }

  if (key === FREE) {
    return <Field label="Texto libre">
      {back}
      <input className="line-input" value={item.movement || item.parts ? '' : item.label} maxLength={LIMITS.label} placeholder="Escribe el ejercicio, p. ej. «Clean Pull» o «Plancha»"
        aria-label="Texto libre" onChange={(event) => onPick({ movement: null, label: event.target.value, parts: undefined })} />
      <p className="line-hint">
        El texto libre no se enlaza con los PRs de tus atletas.
        {!item.movement && item.label.trim() && <> <button type="button" onClick={onCreateMovement}>Crear «{item.label.trim()}» como movimiento</button> para que puedan llevar su récord.</>}
      </p>
    </Field>;
  }

  return <Field label={category.label}>
    {back}
    {category.groups.map((group) => <div className="move-group" key={group.name}>
      {category.groups.length > 1 && <span style={{ '--c': `var(${group.color})` }}>{group.name}</span>}
      <div className="move-buttons">{group.moves.map((move) => moveButton(move, group.color))}</div>
    </div>)}
  </Field>;
}

/**
 * One line of a block. Closed, it reads like the whiteboard ("Back Squat · 5 × 3 · 75 % de 1RM");
 * open, it is a roomy form. The editor keeps one line open at a time.
 */
export default function LineEditor({ item, content, earlier, weightNames, preview, open, onOpen, onClose, onChange, onMove, onRemove, onCreateMovement }) {
  const { load } = item;
  const [choosing, setChoosing] = useState(!item.movement && !item.label);
  const complex = Boolean(item.parts);
  const name = itemName(item);
  const usesWeight = !item.movement || moveInfo(item.movement).type === 'weight';
  const setLoad = (patch) => onChange({ load: { ...load, ...patch } });
  const setType = (type) => {
    // A complex has no record of its own, so its percentage starts from its first movement's.
    if (type === 'percent') setLoad({ type, value: null, base: { kind: 'pr', movement: (!item.movement && item.parts?.find((part) => part.movement)?.movement) || null, rm: 1 } });
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
        <span>{summary || (name ? 'Sin series ni carga' : 'Toca para elegir el movimiento')}{preview?.weight != null && <em className="num"> → {preview.weight} lb</em>}</span>
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

    {choosing ? <>
      <MovementPicker item={item} weightNames={weightNames} onCreateMovement={onCreateMovement}
        onPick={(patch) => {
          // A movement that is not lifted (gymnastics, cardio, benchmarks) carries no load.
          const lifted = !patch.movement || moveInfo(patch.movement).type === 'weight';
          // A complex's percentage is of one of its movements' records: the first one, until the coach picks another.
          const first = patch.parts?.find((part) => part.movement)?.movement;
          const orphan = load.type === 'percent' && load.base.kind === 'pr' && !load.base.movement;
          if (!lifted) onChange({ ...patch, load: { type: 'none', value: null, base: null } });
          else onChange(first && orphan ? { ...patch, load: { ...load, base: { ...load.base, movement: first } } } : patch);
          if (patch.movement) setChoosing(false);
        }} />
      {name && !item.movement && <div className="line-foot start">
        <button type="button" className="tinted-button" onClick={() => setChoosing(false)}>Usar «{name}»</button>
      </div>}
    </>
      : <Field label="Movimiento">
        <div className="line-picked">
          <b>{name}</b>
          <button type="button" className="tinted-button" onClick={() => setChoosing(true)}>Cambiar</button>
        </div>
      </Field>}

    {/* The rest of the form waits for the movement, so choosing it is the only thing on screen. */}
    {name && <>
    <div className="line-row">
      <Field label="Series">
        <div className="stepper-field">
          <button type="button" aria-label="Una serie menos" disabled={!item.sets} onClick={() => onChange({ sets: item.sets > 1 ? item.sets - 1 : null })}><Icon name="minus" weight={2.8} /></button>
          <input inputMode="numeric" value={item.sets ?? ''} placeholder="–" aria-label="Series"
            onChange={(event) => onChange({ sets: /^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0 ? Number(event.target.value) : null })} />
          <button type="button" aria-label="Una serie más" disabled={item.sets >= 99} onClick={() => onChange({ sets: (item.sets ?? 0) + 1 })}><Icon name="plus" weight={2.8} /></button>
        </div>
      </Field>
      {!complex && <Field label="Repeticiones" hint="Acepta texto: «máx», «30 s», «8-10».">
        <div className="pick-row">
          <input className="line-input short" value={item.reps} maxLength={LIMITS.reps} placeholder="–" aria-label="Repeticiones" onChange={(event) => onChange({ reps: event.target.value })} />
          <Choice label="Repeticiones frecuentes" size="small" options={REP_STEPS.map((reps) => ({ value: reps, label: reps }))} value={item.reps} onChange={(reps) => onChange({ reps })} />
        </div>
      </Field>}
    </div>

    {usesWeight && <Field label="Carga" hint={LOAD_HINTS[load.type]}>
      <Choice label="Tipo de carga" options={LOAD_CHOICES} value={load.type} onChange={(type) => type !== load.type && setType(type)} />
    </Field>}

    {load.type === 'weight' && <Field label="Peso" hint="Deja «Chicas» vacío si el peso es el mismo para todos. Cada atleta ve el suyo según lo que eligió en su cuenta.">
      <div className="pick-row">
        <label className="unit-input"><small>{load.women != null ? 'Chicos' : 'Todos'}</small><input inputMode="decimal" value={load.value ?? ''} placeholder="0" aria-label="Peso en libras"
          onChange={(event) => setLoad({ value: numberOrNull(event.target.value) })} /><span>lb</span></label>
        <label className="unit-input"><small>Chicas</small><input inputMode="decimal" value={load.women ?? ''} placeholder="–" aria-label="Peso de chicas en libras"
          onChange={(event) => setLoad({ women: numberOrNull(event.target.value) })} /><span>lb</span></label>
      </div>
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
        {needsMovement && <p className="line-hint warn">{complex ? 'Un complex' : 'Un texto libre'} no tiene récord propio: elige de qué movimiento se calcula.</p>}
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

    </>}

    <footer className="line-foot">
      <button type="button" className="pill-btn" onClick={onClose}><Icon name="check" weight={3} />Listo</button>
    </footer>
  </div>;
}
