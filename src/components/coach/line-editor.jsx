'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
function ComplexParts({ item, names, onParts, onSingle, onEnter }) {
  const parts = item.parts;
  // Removing down to one part leaves a single movement again.
  const remove = (index) => { const rest = parts.filter((_, at) => at !== index); if (rest.length > 1) onParts(rest); else onSingle(rest[0]); };
  const patch = (index, change) => onParts(parts.map((part, at) => (at === index ? { ...part, ...change } : part)));
  return <div className="complex-parts">
    <span className="complex-tag">Complex · seguidos, sin soltar la barra</span>
    {parts.map((part, index) => <div className="complex-row" key={index}>
      <input className="line-reps" inputMode="numeric" value={part.reps} aria-label={`Reps del movimiento ${index + 1} del complex`}
        onChange={(event) => { if (/^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0) patch(index, { reps: Number(event.target.value) }); }} />
      <MoveCombo id={`${item.id}-${index}`} value={part.movement} names={names} label={`Movimiento ${index + 1}`}
        onPick={({ movement, label }) => patch(index, { movement: movement ?? label })}
        onEnter={index === parts.length - 1 && parts.length < LIMITS.parts ? () => onParts([...parts, { reps: 1, movement: '' }]) : onEnter} />
      <button type="button" className="icon-button danger" aria-label={`Quitar movimiento ${index + 1} del complex`}
        onClick={() => remove(index)}><Icon name="minus" weight={2.8} /></button>
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
export default function LineEditor({ item, earlier, names, weightNames, preview, timed, ladder = false, open, autoFocus, onOpen, onClose, onChange, onEnter, onMove, onRemove, onCreateMovement }) {
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
          onParts={(parts) => onChange({ movement: null, parts, label: complexLabel(parts.filter((part) => part.movement)) })}
          onSingle={(part) => { const linked = findMovement(part?.movement ?? '', names); onChange({ parts: undefined, movement: linked ?? null, label: linked ? '' : part?.movement ?? '' }); }} />
        : <>
          <input className="line-reps" value={item.reps} maxLength={LIMITS.reps} placeholder={ladder ? 'Escalera' : 'Reps'} aria-label="Repeticiones"
            onChange={(event) => onChange({ reps: event.target.value })} />
          <MoveCombo id={item.id} value={itemName(item)} names={names} autoFocus={autoFocus} onPick={pick} onEnter={onEnter}
 />
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

const LOAD_KINDS = [
  { value: 'weight', label: 'Peso fijo', short: 'En libras, uno para chicos y otro para chicas', help: 'Un peso fijo en libras. Si escribes uno para chicos y otro para chicas, cada atleta ve el de su categoría; con uno solo, es para todos.' },
  { value: 'percent', label: '% de un PR', short: 'Calculado del récord de cada atleta', help: 'Un porcentaje de un récord del atleta (1RM, 3RM o 5RM) o del peso que anotó hoy en una línea anterior. Cada atleta ve su peso ya calculado.' },
  { value: 'max', label: 'Máximo del día', short: 'Sube hasta su peso más alto y lo anota', help: 'El atleta sube hasta su peso más alto del día y lo anota. La línea no lleva un peso escrito.' },
];
const kindOf = (load) => (load.type === 'percent' || load.type === 'max' ? load.type : 'weight');

/** A small (i) that explains a setting: opens on hover, focus or tap, and closes with Escape or a second tap. */
function InfoTip({ label, text }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  // A tap focuses (or hovers) and clicks at once: the click that follows an opening keeps it open.
  const justOpened = useRef(false);
  const show = () => { if (!open) { justOpened.current = true; setOpen(true); } };
  const hide = () => { justOpened.current = false; setOpen(false); };
  const tap = () => { if (justOpened.current) justOpened.current = false; else setOpen(!open); };
  const button = useRef(null);
  // Leaving with the pointer closes a bubble opened by hovering, not one the keyboard or a tap is on.
  const leave = () => { if (document.activeElement !== button.current) hide(); };
  const bubble = useRef(null);
  const [place, setPlace] = useState(null);
  // Placed against the window: centred on the (i), kept 12 px inside the screen on both sides, below
  // the (i) or above it when there is no room. It follows the (i) while the page scrolls.
  useLayoutEffect(() => {
    if (!open) { setPlace(null); return undefined; }
    const measure = () => {
      if (!button.current || !bubble.current) return;
      const anchor = button.current.getBoundingClientRect();
      const { width, height } = bubble.current.getBoundingClientRect();
      const margin = 12;
      const left = Math.min(Math.max(anchor.left + anchor.width / 2 - width / 2, margin), window.innerWidth - width - margin);
      const below = anchor.bottom + 8 + height <= window.innerHeight - margin;
      setPlace({ left, top: below ? anchor.bottom + 8 : anchor.top - 8 - height, side: below ? 'below' : 'above', arrow: anchor.left + anchor.width / 2 - left });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [open]);
  return <span className="info-tip" onMouseEnter={show} onMouseLeave={leave}>
    <button type="button" ref={button} className="info-tip-button" aria-label={`Qué hace «${label}»`} aria-expanded={open} aria-describedby={open ? id : undefined}
      onClick={tap} onFocus={show} onBlur={hide}
      onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); hide(); } }}><Icon name="info" weight={2.4} /></button>
    {/* In the body, so no scrolling or clipped container around the line can cut it. */}
    {open && createPortal(<span ref={bubble} className="info-tip-bubble" role="tooltip" id={id} data-side={place?.side}
      style={place ? { left: place.left, top: place.top, '--arrow': `${place.arrow}px` } : { visibility: 'hidden' }}>{text}</span>, document.body)}
  </span>;
}

/** One setting per row: its name and help on the left, its control on the right (below on a phone when wide). */
function OptionRow({ title, help, wide = false, children }) {
  return <div className="opt-row" data-wide={wide}>
    <span className="opt-title">{title}<InfoTip label={title} text={help} /></span>
    <div className="opt-control">{children}</div>
  </div>;
}

function LineOptions({ item, earlier, weightNames, preview, usesWeight, setLoad, onChange, onMove, onClose, onCreateMovement, needsBase }) {
  const { load } = item;
  const complex = Boolean(item.parts);
  const kind = kindOf(load);
  // Lines the athlete logs a weight on can be the base of a later percentage ("85 % of today's heavy single").
  const baseLines = earlier.filter((other) => other.log || other.load.type === 'max');
  const baseValue = load.base?.kind === 'item' ? `item:${load.base.itemId}` : `pr:${load.base?.rm ?? 1}`;
  const setBase = (value) => {
    const [kind, key] = value.split(':');
    setLoad({ base: kind === 'item' ? { kind: 'item', itemId: key } : { kind: 'pr', movement: load.base?.kind === 'pr' ? load.base.movement : null, rm: Number(key) } });
  };
  // One choice for the whole load, mirrored by the row's lb / % field.
  function setKind(next) {
    if (next === kind) return;
    if (next === 'max') onChange({ load: { type: 'max', value: null, base: null } });
    else if (next === 'percent') {
      const firstPart = item.parts?.find((part) => part.movement)?.movement ?? null;
      onChange({ load: { type: 'percent', value: null, base: { kind: 'pr', movement: item.movement ? null : firstPart, rm: 1 } } });
    } else onChange({ load: NO_LOAD });
  }
  const logged = item.log || load.type === 'max';

  return <div className="line-options">
    <section className="opt-group" aria-label="Movimiento">
      <h4 className="opt-heading">Movimiento</h4>
      <div className="opt-row">
        {complex
          ? <button type="button" className="tinted-button" onClick={() => onChange({ parts: undefined, label: '' })}>Volver a un movimiento</button>
          : <button type="button" className="tinted-button" title="Varios movimientos seguidos sin soltar la barra, por ejemplo 1 Clean + 2 Split Jerk"
            onClick={() => onChange({ movement: null, parts: [{ reps: 1, movement: itemName(item) }, { reps: 1, movement: '' }], label: itemName(item) ? `1 ${itemName(item)}` : '' })}>
            <Icon name="plus" weight={2.8} />Convertir en complex</button>}
      </div>
      {usesWeight && <>
      <OptionRow title="Carga" wide help="Cómo se define el peso de esta línea. Elige una de las tres formas; cada una explica su uso al pasar por encima o al tocar su nombre.">
        <div className="load-kinds" role="radiogroup" aria-label="Tipo de carga">
          {LOAD_KINDS.map((option) => <button type="button" key={option.value} role="radio" aria-checked={option.value === kind} title={option.help}
            onClick={() => setKind(option.value)}><b>{option.label}</b><small>{option.short}</small></button>)}
        </div>
        <p className="opt-note">{LOAD_KINDS.find((option) => option.value === kind).help}</p>
      </OptionRow>
      {kind === 'percent' && <div className="opt-sub">
        <OptionRow title="Porcentaje de" wide help="De qué sale el porcentaje: un récord del atleta o el peso que anotó hoy en una línea anterior de la sesión.">
          <Choice label="Base del porcentaje" size="small" value={baseValue} onChange={setBase} options={[
            ...BASE_RMS.map((rm) => ({ value: `pr:${rm}`, label: `Su ${rm}RM` })),
            ...baseLines.map((other) => ({ value: `item:${other.id}`, label: `Peso de hoy en «${itemName(other)}»` })),
          ]} />
        </OptionRow>
        {load.base.kind === 'pr' && <OptionRow title="Récord de" wide help="El movimiento cuyo récord se usa. Normalmente el mismo de la línea; elige otro para, por ejemplo, un Front Squat al 70 % del Back Squat.">
          <select className="line-select" aria-label="Movimiento base" value={load.base.movement ?? ''}
            onChange={(event) => setLoad({ base: { ...load.base, movement: event.target.value || null } })}>
            <option value="">{item.movement ? `El mismo movimiento (${item.movement})` : 'Elige un movimiento'}</option>
            {weightNames.filter((candidate) => candidate !== item.movement).map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
          </select>
          {needsBase && <p className="line-hint warn">{complex ? 'Un complex' : 'Un texto libre'} no tiene récord propio: elige de qué movimiento se calcula.</p>}
        </OptionRow>}
        <OptionRow title="Porcentaje" wide help="Toca uno de los frecuentes o escribe cualquier otro en el campo % de la línea.">
          <Choice label="Porcentajes frecuentes" size="small" options={PERCENT_STEPS.map((step) => ({ value: step, label: `${step} %` }))} value={load.value} onChange={(value) => setLoad({ value })} />
        </OptionRow>
        {preview && <p className="line-preview">
          {preview.weight != null ? <><b className="num">{preview.weight} lb</b> para este atleta · base {preview.base} lb</>
            : preview.missing === 'pr' ? 'Este atleta todavía no tiene ese récord: verá el porcentaje y un aviso para registrarlo.'
              : 'Se calcula cuando el atleta anote la línea base.'}
        </p>}
      </div>}
      </>}
    </section>

    <section className="opt-group" aria-label="En el bloque">
      <h4 className="opt-heading">En el bloque</h4>
      <OptionRow title="Series de esta línea" help="Cuántas veces se repite esta línea por su cuenta, por ejemplo 5 series de 3. Déjalo vacío si se hace una vez o si el bloque ya tiene rondas.">
        <div className="stepper-field">
          <button type="button" aria-label="Una serie menos" disabled={!item.sets} onClick={() => onChange({ sets: item.sets > 2 ? item.sets - 1 : null })}><Icon name="minus" weight={2.8} /></button>
          <input inputMode="numeric" value={item.sets ?? ''} placeholder="–" aria-label="Series"
            onChange={(event) => onChange({ sets: /^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0 ? Number(event.target.value) : null })} />
          <button type="button" aria-label="Una serie más" disabled={item.sets >= 99} onClick={() => onChange({ sets: (item.sets ?? 1) + 1 })}><Icon name="plus" weight={2.8} /></button>
        </div>
      </OptionRow>
      <OptionRow title="El atleta anota peso y reps" help="Si está activo, el atleta escribe el peso y las repeticiones que hizo en esta línea y los ves en Resultados. Apagado, la línea es solo informativa. Con «Máximo del día» siempre se anota.">
        <Switch checked={logged} disabled={load.type === 'max'} label="El atleta anota peso y reps" onChange={(log) => onChange({ log })} />
      </OptionRow>
      <OptionRow title="Nota de la línea" wide help="Detalles para el atleta en esta línea: tempo, variante, RPE…">
        <input className="line-input" value={item.notes} maxLength={LIMITS.notes} placeholder="p. ej. «3 s en el negativo» o «con liga»" aria-label="Nota de la línea"
          onChange={(event) => onChange({ notes: event.target.value })} />
      </OptionRow>
    </section>

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
