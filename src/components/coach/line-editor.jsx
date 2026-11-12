'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { moveInfo } from '../../lib/catalog';
import { BASE_RMS, complexLabel, itemName, LIMITS } from '../../lib/training';
import { Switch } from '../ui/controls';
import Icon from '../ui/icon';

const NO_LOAD = { type: 'none', value: null, base: null };
const PERCENT_STEPS = [50, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const numberOrNull = (text) => (text.trim() === '' || !Number.isFinite(Number(text.replace(',', '.'))) ? null : Number(text.replace(',', '.')));

/** One-of-many as buttons, so every option is visible without opening a menu. */
export function Choice({ options, value, onChange, label, size }) {
  return <div className="choice" role="radiogroup" aria-label={label} data-size={size}>
    {options.map((option) => <button type="button" key={option.value} role="radio" aria-checked={option.value === value}
      style={option.color ? { '--c': `var(${option.color})` } : undefined} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

/** A labelled group of the line's options. */
function Field({ label, hint, children }) {
  return <div className="line-field">
    <span className="line-label">{label}</span>
    {children}
    {hint && <p className="line-hint">{hint}</p>}
  </div>;
}

// Names compare without case, accents, spaces, hyphens or a final s: "pull ups" is "Pull-ups".
export const moveKey = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9&]/g, '').replace(/s$/, '');
export const findMovement = (text, names) => { const key = moveKey(text); return key ? names.find((name) => moveKey(name) === key) ?? null : null; };

/**
 * A movement, typed. Suggestions from the catalog show while typing; a name that matches one
 * links the athlete's records, and anything else is kept as free text. Lines and the parts of a
 * complex use the same field.
 */
function MoveCombo({ id, value, names, label = 'Movimiento', autoFocus, onPick, onEnter }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef(null);
  useEffect(() => { if (!focused) setText(value); }, [value, focused]);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  const query = moveKey(text);
  const linked = findMovement(value, names);
  const matches = useMemo(() => (query ? names.filter((candidate) => moveKey(candidate).includes(query))
    .sort((a, b) => Number(!moveKey(a).startsWith(query)) - Number(!moveKey(b).startsWith(query))).slice(0, 6) : []), [names, query]);
  const open = focused && matches.length > 0 && !(matches.length === 1 && moveKey(matches[0]) === query);

  const choose = (move) => { setText(move); setActive(0); onPick({ movement: move, label: '' }); };
  function type(next) {
    setText(next);
    setActive(0);
    const match = findMovement(next, names);
    onPick(match ? { movement: match, label: '' } : { movement: null, label: next });
  }
  function onKeyDown(event) {
    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // A name already written in full goes on; otherwise the highlighted suggestion is taken.
      if (open && !(linked && moveKey(linked) === query && active === 0)) choose(matches[active]); else onEnter?.();
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setFocused(false);
    }
  }

  const listId = `moves-${id}`;
  return <div className="line-move">
    <input ref={input} value={text} maxLength={LIMITS.label} placeholder={label} aria-label={label} autoComplete="off"
      role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open ? `${listId}-${active}` : undefined}
      onChange={(event) => type(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={onKeyDown} />
    {linked && <i className="line-move-dot" style={{ '--c': `var(${moveInfo(linked).group.color})` }} title="Movimiento del catálogo" />}
    {open && <ul className="move-suggest" id={listId} role="listbox" aria-label="Sugerencias">
      {matches.map((move, index) => <li key={move} id={`${listId}-${index}`} role="option" aria-selected={index === active}
        style={{ '--c': `var(${moveInfo(move).group.color})` }} onMouseDown={(event) => { event.preventDefault(); choose(move); }}>{move}</li>)}
    </ul>}
  </div>;
}

/** A complex written like lines: reps and a typed movement per part, done in a row without dropping the bar. */
function ComplexParts({ item, names, onParts, onEnter }) {
  const parts = item.parts;
  const patch = (index, change) => onParts(parts.map((part, at) => (at === index ? { ...part, ...change } : part)));
  return <div className="complex-parts">
    <span className="complex-tag">Complex · seguidos, sin soltar la barra</span>
    {parts.map((part, index) => <div className="complex-row" key={index}>
      <input className="line-reps" inputMode="numeric" value={part.reps} aria-label={`Reps del movimiento ${index + 1} del complex`}
        onChange={(event) => { if (/^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0) patch(index, { reps: Number(event.target.value) }); }} />
      <MoveCombo id={`${item.id}-${index}`} value={part.movement} names={names} label={`Movimiento ${index + 1}`}
        onPick={({ movement, label }) => patch(index, { movement: movement ?? label })}
        onEnter={index === parts.length - 1 && parts.length < LIMITS.parts ? () => onParts([...parts, { reps: 1, movement: '' }]) : onEnter} />
      {parts.length > 2 ? <button type="button" className="icon-button danger" aria-label={`Quitar movimiento ${index + 1} del complex`}
        onClick={() => onParts(parts.filter((_, at) => at !== index))}><Icon name="xmark" /></button> : <span />}
    </div>)}
    {parts.length < LIMITS.parts && <button type="button" className="complex-add" onClick={() => onParts([...parts, { reps: 1, movement: '' }])}>
      <Icon name="plus" weight={2.8} />Agregar movimiento al complex
    </button>}
  </div>;
}

/** The weight in lb, for everyone or for men / women, or a percentage of a record. Empty is no load. */
function LoadInput({ item, onLoad, onMore }) {
  const { load } = item;
  if (load.type === 'max') return <button type="button" className="line-load chip" onClick={onMore}>Máx. del día</button>;
  const percent = load.type === 'percent';
  const firstPart = item.parts?.find((part) => part.movement)?.movement ?? null;
  const setWeight = (value, women) => onLoad(value == null && women == null ? NO_LOAD : { type: 'weight', value, women, base: null });
  const toggle = () => onLoad(percent ? NO_LOAD : { type: 'percent', value: null, base: { kind: 'pr', movement: item.movement ? null : firstPart, rm: 1 } });
  return <div className="line-load">
    {percent
      ? <input inputMode="decimal" value={load.value ?? ''} placeholder="0" aria-label="Porcentaje"
        onChange={(event) => onLoad({ ...load, value: numberOrNull(event.target.value) })} />
      : <>
        <input inputMode="decimal" value={load.type === 'weight' ? load.value ?? '' : ''} placeholder="Chicos" aria-label="Peso de chicos en libras (o de todos, si chicas queda vacío)"
          onChange={(event) => setWeight(numberOrNull(event.target.value), load.women ?? null)} />
        <span aria-hidden="true">/</span>
        <input inputMode="decimal" value={load.type === 'weight' ? load.women ?? '' : ''} placeholder="Chicas" aria-label="Peso de chicas en libras (vacío: el mismo de chicos)"
          onChange={(event) => setWeight(load.type === 'weight' ? load.value : null, numberOrNull(event.target.value))} />
      </>}
    <button type="button" className="line-unit" aria-label={percent ? 'Usar libras' : 'Usar porcentaje'} title={percent ? 'Cambiar a libras' : 'Cambiar a porcentaje'} onClick={toggle}>{percent ? '%' : 'lb'}</button>
  </div>;
}

/**
 * One line of a block, written as on the whiteboard: reps, movement and weight in one row.
 * Everything else (sets of its own, the percentage's base, a complex, logging, a note) waits
 * in its options, one line open at a time.
 */
export default function LineEditor({ item, earlier, names, weightNames, preview, timed, open, autoFocus, onOpen, onClose, onChange, onEnter, onMove, onRemove, onCreateMovement }) {
  const { load } = item;
  const usesWeight = !item.movement || moveInfo(item.movement).type === 'weight';
  const setLoad = (patch) => onChange({ load: { ...load, ...patch } });

  function pick(patch) {
    const lifted = !patch.movement || moveInfo(patch.movement).type === 'weight';
    // Gymnastics and cardio carry no load. A lift in a block without a running clock is logged.
    onChange({ ...patch, ...(lifted ? {} : { load: NO_LOAD }), ...(patch.movement && patch.movement !== item.movement ? { log: lifted && !timed } : {}) });
  }

  const needsBase = load.type === 'percent' && load.base.kind === 'pr' && !item.movement && !load.base.movement;
  const meta = [
    item.sets > 1 && `${item.sets} series`,
    (item.log || load.type === 'max') && 'El atleta anota',
    item.notes,
  ].filter(Boolean);

  return <div className="line" data-open={open}>
    {/* Enter in any field of the row goes on to the next line, so a block is typed without the mouse. */}
    <div className="line-row" data-complex={Boolean(item.parts)} onKeyDown={(event) => { if (event.key === 'Enter' && event.target.tagName === 'INPUT' && !event.defaultPrevented) { event.preventDefault(); onEnter(); } }}>
      {item.parts
        ? <ComplexParts item={item} names={weightNames} onEnter={onEnter}
          onParts={(parts) => onChange({ movement: null, parts, label: complexLabel(parts.filter((part) => part.movement)) })} />
        : <>
          <input className="line-reps" value={item.reps} maxLength={LIMITS.reps} placeholder="Reps" aria-label="Repeticiones"
            onChange={(event) => onChange({ reps: event.target.value })} />
          <MoveCombo id={item.id} value={itemName(item)} names={names} autoFocus={autoFocus} onPick={pick} onEnter={onEnter} />
        </>}
      {usesWeight ? <LoadInput item={item} onLoad={(next) => onChange({ load: next })} onMore={onOpen} /> : <span className="line-load none">Sin carga</span>}
      <button type="button" className="icon-button line-more" aria-expanded={open} aria-label={open ? 'Cerrar opciones de la línea' : 'Más opciones de la línea'}
        onClick={open ? onClose : onOpen}><Icon name="chevronDown" weight={2.6} /></button>
      <button type="button" className="icon-button danger" aria-label="Quitar línea" onClick={onRemove}><Icon name="xmark" /></button>
    </div>
    {!open && (meta.length > 0 || preview?.weight != null || needsBase) && <p className="line-meta">
      {meta.join(' · ')}
      {preview?.weight != null && <b className="num">{meta.length ? ' · ' : ''}{preview.weight} lb para este atleta</b>}
      {needsBase && <span className="warn"> Elige en las opciones de qué récord sale el porcentaje.</span>}
    </p>}
    {open && <LineOptions item={item} earlier={earlier} weightNames={weightNames} preview={preview} usesWeight={usesWeight}
      setLoad={setLoad} onChange={onChange} onMove={onMove} onClose={onClose} onCreateMovement={onCreateMovement} needsBase={needsBase} />}
  </div>;
}

function LineOptions({ item, earlier, weightNames, preview, usesWeight, setLoad, onChange, onMove, onClose, onCreateMovement, needsBase }) {
  const { load } = item;
  const complex = Boolean(item.parts);
  // Lines the athlete logs a weight on can be the base of a later percentage ("85 % of today's heavy single").
  const baseLines = earlier.filter((other) => other.log || other.load.type === 'max');
  const baseValue = load.base?.kind === 'item' ? `item:${load.base.itemId}` : `pr:${load.base?.rm ?? 1}`;
  const setBase = (value) => {
    const [kind, key] = value.split(':');
    setLoad({ base: kind === 'item' ? { kind: 'item', itemId: key } : { kind: 'pr', movement: load.base?.kind === 'pr' ? load.base.movement : null, rm: Number(key) } });
  };

  return <div className="line-options">
    <div className="line-options-row">
      <Field label="Series de esta línea">
        <div className="stepper-field">
          <button type="button" aria-label="Una serie menos" disabled={!item.sets} onClick={() => onChange({ sets: item.sets > 2 ? item.sets - 1 : null })}><Icon name="minus" weight={2.8} /></button>
          <input inputMode="numeric" value={item.sets ?? ''} placeholder="–" aria-label="Series"
            onChange={(event) => onChange({ sets: /^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0 ? Number(event.target.value) : null })} />
          <button type="button" aria-label="Una serie más" disabled={item.sets >= 99} onClick={() => onChange({ sets: (item.sets ?? 1) + 1 })}><Icon name="plus" weight={2.8} /></button>
        </div>
      </Field>
      {usesWeight && <Field label="Máximo del día">
        <label className="line-switch">
          <Switch checked={load.type === 'max'} label="Sube hasta su máximo del día" onChange={(max) => onChange({ load: max ? { type: 'max', value: null, base: null } : NO_LOAD })} />
          <span>Sube hasta su peso más alto y lo anota</span>
        </label>
      </Field>}
      <Field label="Registro">
        <label className="line-switch">
          <Switch checked={item.log || load.type === 'max'} disabled={load.type === 'max'} label="El atleta anota peso y reps" onChange={(log) => onChange({ log })} />
          <span>{item.log || load.type === 'max' ? 'El atleta anota peso y reps' : 'Solo informativa'}</span>
        </label>
      </Field>
    </div>

    {load.type === 'percent' && <div className="line-options-row">
      <Field label="Porcentaje de">
        <Choice label="Base del porcentaje" size="small" value={baseValue} onChange={setBase} options={[
          ...BASE_RMS.map((rm) => ({ value: `pr:${rm}`, label: `Su ${rm}RM` })),
          ...baseLines.map((other) => ({ value: `item:${other.id}`, label: `Peso de hoy en «${itemName(other)}»` })),
        ]} />
      </Field>
      {load.base.kind === 'pr' && <Field label="Récord de">
        <select className="line-select" aria-label="Movimiento base" value={load.base.movement ?? ''}
          onChange={(event) => setLoad({ base: { ...load.base, movement: event.target.value || null } })}>
          <option value="">{item.movement ? `El mismo movimiento (${item.movement})` : 'Elige un movimiento'}</option>
          {weightNames.filter((candidate) => candidate !== item.movement).map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
        </select>
        {needsBase && <p className="line-hint warn">{complex ? 'Un complex' : 'Un texto libre'} no tiene récord propio: elige de qué movimiento se calcula.</p>}
      </Field>}
      <Field label="Rápidos">
        <Choice label="Porcentajes frecuentes" size="small" options={PERCENT_STEPS.map((step) => ({ value: step, label: String(step) }))} value={load.value} onChange={(value) => setLoad({ value })} />
      </Field>
    </div>}
    {preview && load.type === 'percent' && <p className="line-preview">
      {preview.weight != null ? <><b className="num">{preview.weight} lb</b> para este atleta · base {preview.base} lb</>
        : preview.missing === 'pr' ? 'Este atleta todavía no tiene ese récord: verá el porcentaje y un aviso para registrarlo.'
          : 'Se calcula cuando el atleta anote la línea base.'}
    </p>}

    <Field label="Complex">
      <div className="line-options-actions">
        {complex
          ? <button type="button" className="tinted-button" onClick={() => onChange({ parts: undefined, label: '' })}>Volver a un solo movimiento</button>
          : <button type="button" className="tinted-button" onClick={() => onChange({ movement: null, parts: [{ reps: 1, movement: item.movement ?? '' }, { reps: 1, movement: '' }],
            label: item.movement ? `1 ${item.movement}` : '' })}><Icon name="plus" weight={2.8} />Convertir en complex</button>}
      </div>
    </Field>

    <Field label="Nota de la línea">
      <input className="line-input" value={item.notes} maxLength={LIMITS.notes} placeholder="Tempo, variante, RPE… p. ej. «3 s en el negativo» o «con liga»" aria-label="Nota de la línea"
        onChange={(event) => onChange({ notes: event.target.value })} />
    </Field>

    <footer className="line-foot">
      {!item.movement && !complex && item.label.trim() && <p className="line-hint">
        «{item.label.trim()}» no está en el catálogo. <button type="button" onClick={onCreateMovement}>Crearlo como movimiento</button> para que tus atletas lleven su récord.
      </p>}
      <span className="line-tools">
        <button type="button" className="icon-button" aria-label="Subir línea" onClick={() => onMove(-1)}><Icon name="arrowUp" /></button>
        <button type="button" className="icon-button" aria-label="Bajar línea" onClick={() => onMove(1)}><Icon name="arrowDown" /></button>
        <button type="button" className="pill-btn" onClick={onClose}><Icon name="check" weight={3} />Listo</button>
      </span>
    </footer>
  </div>;
}
