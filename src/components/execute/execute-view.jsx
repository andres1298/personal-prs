'use client';

import { useEffect, useState } from 'react';
import { RMS, bestRecord, firstRm, getCatalog, moveInfo, num, num2, toKg } from '../../lib/catalog';
import { DEFAULT_PCT, PLATE_STYLE, computeLoad, sum } from '../../lib/plates';
import Icon from '../ui/icon';
import { List, Row } from '../ui/list';
import { LargeTitle, NavBar } from '../ui/nav-bar';
import { SegmentedControl, SymbolTile } from '../ui/controls';
import PlateDisc from '../ui/plate-disc';

export const EXERCISE_DEFAULTS = {
  view: 'pick', cat: null, move: null, free: false, rm: 1, base: 0, pct: 80,
  extra: [], minus: [], editBase: false, sel: 0, panel: 'load', done: [], key: '', ts: 0,
};

// Old sessions go back to the picker; malformed stored lists are reset.
export function restoreExercise(stored) {
  const ex = { ...stored, extra: Array.isArray(stored.extra) ? stored.extra : [], minus: Array.isArray(stored.minus) ? stored.minus : [] };
  if (!Array.isArray(ex.done)) ex.done = [];
  if (Date.now() - (ex.ts || 0) > 8 * 3600e3 && ex.view !== 'pick') Object.assign(ex, { view: 'pick', done: [] });
  return ex;
}

export function selectMovePatch(records, move) {
  const rm = firstRm(records, move) || 1;
  return {
    view: 'run', move, free: false, cat: moveInfo(move).group.name, extra: [], minus: [], sel: 0, panel: 'load', done: [],
    rm, base: bestRecord(records, move, rm)?.value || 0, pct: DEFAULT_PCT, editBase: true,
  };
}

// Exercise the guided tour shows: the first lift with a PR, or a free calculation.
export function tourExercise(records) {
  const move = getCatalog().Lift.groups.flatMap((group) => group.moves).find((name) => firstRm(records, name));
  if (move) return { ...selectMovePatch(records, move), editBase: false };
  return { ...EXERCISE_DEFAULTS, view: 'run', free: true, base: 225, pct: DEFAULT_PCT };
}

const scrollTop = () => window.scrollTo({ top: 0 });

export default function ExecuteView({ ex, setEx, settings, records, banner, onOpenSettings, onNewMovement }) {
  const go = (patch) => { setEx(patch); scrollTop(); };
  if (ex.view === 'pick') {
    return <Picker ex={ex} go={go} settings={settings} records={records} banner={banner} onOpenSettings={onOpenSettings}
      onNewMovement={onNewMovement} />;
  }
  if (ex.view === 'moves') return <Moves ex={ex} go={go} records={records} onNewMovement={onNewMovement} />;
  return <Workbench ex={ex} setEx={setEx} go={go} settings={settings} records={records} onOpenSettings={onOpenSettings} />;
}

/* ---------- Picker ---------- */
function Picker({ ex, go, settings, records, banner, onOpenSettings, onNewMovement }) {
  const canResume = ex.base > 0 && (ex.move || ex.free);
  const resumeTarget = canResume ? computeLoad(ex, settings, settings.simple).target : 0;
  return <>
    <LargeTitle title="Execute" subtitle="¿Qué vas a levantar?"
      trailing={<button type="button" className="nav-icon" aria-label="Ajustes" data-tour="settings" onClick={onOpenSettings}><Icon name="gear" /></button>} />
    {banner}
    {canResume && <div className="resume-card">
      <button type="button" className="resume-main" onClick={() => go({ view: 'run' })}>
        <span className="resume-copy">
          <small>Continuar</small>
          <b>{ex.free ? 'Cálculo libre' : ex.move} · {num(ex.pct)}%</b>
        </span>
        <span className="resume-weight num rounded">{resumeTarget}<small>lb</small></span>
      </button>
      <button type="button" className="resume-dismiss" aria-label="Quitar cálculo anterior"
        onClick={() => go({ move: null, free: false, base: 0, extra: [], minus: [], done: [] })}>
        <Icon name="xmark" weight={2.6} />
      </button>
    </div>}
    <div className="category-grid" data-tour="categories">
      {getCatalog().Lift.groups.map((group) => {
        const count = group.moves.filter((move) => firstRm(records, move)).length;
        return <button type="button" key={group.name} className="category-card" style={{ '--c': `var(${group.color})` }}
          onClick={() => go({ cat: group.name, view: 'moves' })}>
          <b>{group.name}</b>
          <small>{count ? `${count} con PR` : 'Sin PRs'}</small>
        </button>;
      })}
      {onNewMovement && <button type="button" className="category-card add" onClick={() => onNewMovement({ tab: 'Lift' })}>
        <Icon name="plus" weight={2.4} />
        <b>Nuevo movimiento</b>
        <small>O una categoría</small>
      </button>}
    </div>
    <List>
      <Row leading={<SymbolTile color="--gray"><Icon name="pencil" /></SymbolTile>} title="Cálculo libre" data-tour="free-calc"
        subtitle="Cualquier peso y porcentaje" chevron onClick={() => go({ view: 'run', free: true, editBase: false })} />
    </List>
  </>;
}

/* ---------- Movements of a group ---------- */
function Moves({ ex, go, records, onNewMovement }) {
  const { groups } = getCatalog().Lift;
  const group = groups.find((g) => g.name === ex.cat) || groups[0] || { name: '', color: '--muted', moves: [] };
  const withPR = group.moves.filter((move) => firstRm(records, move));
  const without = group.moves.filter((move) => !firstRm(records, move));
  const row = (move) => {
    const rm = firstRm(records, move);
    return <Row key={move} disabled={!rm} chevron={!!rm}
      onClick={() => go(selectMovePatch(records, move))}
      leading={<i className="dot" style={{ '--c': `var(${rm ? group.color : '--label4'})` }} />}
      title={move}
      detail={rm ? <>{bestRecord(records, move, rm).value} lb{rm > 1 && <small>{rm}RM</small>}</> : 'Sin PR'} />;
  };
  return <>
    <NavBar back={{ label: 'Execute', onClick: () => go({ view: 'pick' }) }} title={group.name} />
    {withPR.length ? <List>{withPR.map(row)}</List> : <p className="empty">Aún no tienes PRs en {group.name}</p>}
    {without.length > 0 && <List header="Sin PR registrado">{without.map(row)}</List>}
    <List>
      {onNewMovement && <Row leading={<SymbolTile color="--indigo"><Icon name="plus" /></SymbolTile>} title="Nuevo movimiento"
        subtitle={`En ${group.name}`} chevron onClick={() => onNewMovement({ tab: 'Lift', group: group.name })} />}
      <Row leading={<SymbolTile color="--gray"><Icon name="pencil" /></SymbolTile>} title="Cálculo libre" chevron
        onClick={() => go({ view: 'run', free: true, editBase: false })} />
    </List>
  </>;
}

/* ---------- Working screen ---------- */
function Workbench({ ex, setEx, go, settings, records, onOpenSettings }) {
  const simple = !!settings.simple;
  const load = computeLoad(ex, settings, simple);
  const adjusted = !simple && (ex.extra.length > 0 || ex.minus.length > 0);
  const done = ex.key === load.key ? ex.done : [];
  const resetAdj = { extra: [], minus: [] };
  const title = ex.free ? 'Cálculo libre' : ex.move;
  const editing = !(ex.base > 0) || ex.editBase;
  const diff = load.target - load.start;
  const status = !adjusted ? null : diff > 0 ? 'over' : diff < 0 ? 'under' : 'exact';

  // Store a desired load as the difference against the selected option.
  const addPlate = (plate) => load.plates && setEx({ extra: [...ex.extra, plate].sort((a, b) => b - a) });
  const removePlate = (item) => {
    if (simple) return;
    if (item.extra) { const extra = [...ex.extra]; extra.splice(extra.indexOf(item.p), 1); setEx({ extra }); }
    else setEx({ minus: [...ex.minus, item.p] });
  };
  const toggleStep = (index) => setEx({
    key: load.key, done: done.includes(index) ? done.filter((i) => i !== index) : [...done, index],
  });

  return <>
    <NavBar inline
      back={{ label: ex.free ? 'Execute' : moveInfo(ex.move).group.name, onClick: () => go({ view: ex.free ? 'pick' : 'moves' }) }}
      title={title}
      trailing={<>
        {ex.free
          ? <button type="button" className="nav-text" onClick={() => setEx({ base: 0, ...resetAdj, sel: 0, done: [], editBase: true, pct: DEFAULT_PCT })}>Limpiar</button>
          : <button type="button" className="nav-icon" aria-label="Cálculo libre" onClick={() => go({ view: 'run', free: true, editBase: false })}><Icon name="pencil" /></button>}
        <button type="button" className="nav-icon" aria-label="Barra y discos" onClick={onOpenSettings}><Icon name="gear" /></button>
      </>}
    />

    <div className="workbench">
      <section className="card weight-card" data-tour="weight">
        <div className="card-head">
          <span><Icon name="number" weight={2.4} /> Peso total</span>
          {!editing && <button type="button" className="base-chip" onClick={() => setEx({ editBase: true })} aria-label="Editar RM y porcentaje">
            {!ex.free && <span>{ex.rm}RM · </span>}<b className="num">{num(ex.base)} lb</b> · <b className="num">{num(ex.pct)}%</b>
            <Icon name="pencil" />
          </button>}
        </div>
        {editing && <BaseEditor ex={ex} setEx={setEx} records={records} resetAdj={resetAdj} />}
        {ex.base > 0
          ? <div className="hero" data-status={status} data-editing={editing}>
            <div className="hero-weight num rounded" key={load.target}>{load.target}<span>lb</span></div>
            <div className="hero-sub num">{num(adjusted ? load.target / ex.base * 100 : ex.pct)}% de {num(ex.base)} lb · {toKg(load.target)} kg</div>
            {!adjusted && <div className="hero-exact num">{num(ex.pct)}% exacto = {num2(load.raw)} lb · {load.target} lb es el {num2(load.target / ex.base * 100)}%</div>}
          </div>
          : <p className="empty compact">{ex.free ? 'Escribe un peso y el porcentaje para empezar' : 'Sin PR para este RM'}</p>}
        {ex.base > 0 && adjusted && <TargetStatus status={status} load={load} pct={ex.pct} onReset={() => setEx(resetAdj)} />}
      </section>

      {ex.base > 0 && <div className={`workbench-panel${simple ? ' simple' : ''}`} data-tour="exec-panel">
        {!simple && <SegmentedControl label="Vista" value={ex.panel} onChange={(panel) => setEx({ panel })}
          options={[{ value: 'load', label: 'Barra' }, { value: 'warm', label: 'Calentamiento' }]} />}
        {ex.panel === 'load' || simple
          ? <LoadCard load={load} ex={ex} setEx={setEx} settings={settings} simple={simple} onAdd={addPlate} onRemove={removePlate} />
          : <Warmup load={load} base={ex.base} done={done} onToggle={toggleStep} onReset={() => setEx({ key: load.key, done: [] })} />}
      </div>}
    </div>
  </>;
}

// Where the adjusted load stands against the percentage target: short of it, over it or on it.
const TARGET_STATUS = {
  under: { icon: 'arrowDown', title: (lb) => `Faltan ${lb} lb`, detail: (side, goal) => `${side} lb por lado · meta ${goal} lb` },
  over: { icon: 'arrowUp', title: (lb) => `${lb} lb arriba`, detail: (side, goal) => `${side} lb por lado · meta ${goal} lb` },
  exact: { icon: 'check', title: () => 'En el objetivo', detail: (_, goal, pct) => `Meta ${goal} lb · ${pct}%` },
};

function TargetStatus({ status, load, pct, onReset }) {
  const copy = TARGET_STATUS[status];
  const diff = Math.abs(load.target - load.start);
  return <div className="target-status" data-status={status} role="status">
    <span className="target-icon"><Icon name={copy.icon} weight={2.8} /></span>
    <span className="target-copy">
      <b className="num">{copy.title(num(diff))}</b>
      <small className="num">{copy.detail(num(diff / 2), load.start, num(pct))}</small>
    </span>
    <button type="button" className="target-reset num" onClick={onReset} aria-label={`Volver al ${num(pct)}%`}>
      <Icon name="undo" weight={2.4} />{num(pct)}%
    </button>
  </div>;
}

// Editor for the RM (or free base weight) and the percentage.
function BaseEditor({ ex, setEx, records, resetAdj }) {
  const [pctText, setPctText] = useState(num(ex.pct));
  const [baseText, setBaseText] = useState(ex.base ? String(ex.base) : '');
  useEffect(() => { setPctText((text) => (parseFloat(text.replace(',', '.')) === ex.pct ? text : num(ex.pct))); }, [ex.pct]);
  useEffect(() => { if (!ex.base) setBaseText(''); }, [ex.base]);

  const close = () => {
    if (!(ex.base > 0)) return;
    document.activeElement?.blur();
    setEx({ editBase: false });
  };
  const onKey = (event) => { if (event.key === 'Enter') close(); };

  const step = (delta) => setEx({ pct: Math.min(150, Math.max(5, Math.round((ex.pct + delta) * 10) / 10)), ...resetAdj });
  return <div className="base-editor" data-tour="base-editor">
    <div className="base-editor-row">
      {ex.free
        ? <label className="base-input"><input className="num" inputMode="decimal" placeholder="Peso" value={baseText} autoFocus={!ex.base}
          aria-label="Peso base en libras" onKeyDown={onKey}
          onChange={(event) => { setBaseText(event.target.value); setEx({ base: parseFloat(event.target.value.replace(',', '.')) || 0, ...resetAdj }); }} /><span>lb</span></label>
        : <SegmentedControl label="Repeticiones máximas" value={ex.rm} className="compact"
          onChange={(rm) => setEx({ rm, base: bestRecord(records, ex.move, rm)?.value || 0, ...resetAdj })}
          options={RMS.map((rm) => ({ value: rm, label: `${rm}RM`, disabled: !bestRecord(records, ex.move, rm) }))} />}
      <button type="button" className="round-button filled" onClick={close} disabled={!(ex.base > 0)} aria-label="Listo"><Icon name="check" weight={3} /></button>
    </div>
    <div className="pct-stepper">
      <button type="button" className="num" onClick={() => step(-10)}>−10</button>
      <button type="button" className="num" onClick={() => step(-5)}>−5</button>
      <label className="pct-input"><input className="num" inputMode="decimal" value={pctText} aria-label="Porcentaje" onKeyDown={onKey}
        onChange={(event) => {
          setPctText(event.target.value);
          const pct = parseFloat(event.target.value.replace(',', '.'));
          if (pct > 0) setEx({ pct, ...resetAdj });
        }} /><span>%</span></label>
      <button type="button" className="num" onClick={() => step(5)}>+5</button>
      <button type="button" className="num" onClick={() => step(10)}>+10</button>
    </div>
  </div>;
}

const plateVars = (plate) => {
  const [color, height] = PLATE_STYLE[plate] || ['--label3', 50];
  return { '--h': height, '--pc': `var(${color})` };
};

function LoadCard({ load, ex, setEx, settings, simple, onAdd, onRemove }) {
  if (!load.plates) {
    return <p className="empty">No se puede armar {load.target} lb con tus discos.<br />Revisa Barra y discos en Ajustes.</p>;
  }
  const option = load.options[load.selected];
  const small = load.plates.length > 5;
  return <section className="card load-card" data-tour="barbell">
    <div className="card-head">
      <span><Icon name="barbell" weight={2.4} /> Por lado · <b className="num">{num(sum(load.plates))} lb</b></span>
      <span className="card-head-detail">Barra {settings.bar} lb</span>
    </div>
    <div className={`barbell${small ? ' small' : ''}`}>
      <span className="collar num">{settings.bar}</span>
      {load.plates.length
        ? load.items.map((item, index) => <button
          type="button" key={`${index}-${item.p}-${item.extra}`} className={`plate${item.extra ? ' extra' : ''}`}
          style={plateVars(item.p)} disabled={simple} onClick={() => onRemove(item)}
          aria-label={simple ? `Disco de ${item.p}` : `Quitar disco de ${item.p}`}
        >{item.p}</button>)
        : <span className="barbell-empty">Solo la barra</span>}
    </div>
    {!simple && load.options.length > 1 && <div className="option-nav">
      <button type="button" disabled={load.selected === 0} aria-label="Opción anterior"
        onClick={() => setEx({ sel: load.selected - 1, minus: [] })}><Icon name="chevronLeft" weight={2.6} /></button>
      <div className="option-mid">
        <b>{option.label}{ex.extra.length ? ' + extra' : ''}</b>
        <div className="page-dots">{load.options.map((_, i) => <i key={i} className={i === load.selected ? 'on' : ''} />)}</div>
      </div>
      <button type="button" disabled={load.selected === load.options.length - 1} aria-label="Opción siguiente"
        onClick={() => setEx({ sel: load.selected + 1, minus: [] })}><Icon name="chevronRight" weight={2.6} /></button>
    </div>}
    {!simple && <>
      <div className="plate-chips">
        {[...settings.plates].sort((a, b) => a - b).map((plate) => <button type="button" key={plate}
          onClick={() => onAdd(plate)} aria-label={`Agregar disco de ${plate}`}><PlateDisc plate={plate} /></button>)}
      </div>
      <p className="hint">Toca un disco para agregarlo · tócalo en la barra para quitarlo</p>
    </>}
  </section>;
}

function MiniPlates({ plates }) {
  return <span className="mini-plates">{plates.map((plate, i) => {
    const [color, height] = PLATE_STYLE[plate] || ['--label3', 50];
    return <i key={i} style={{ height: Math.round(height * 0.26), '--pc': `var(${color})` }} />;
  })}</span>;
}

function Warmup({ load, base, done, onToggle, onReset }) {
  const next = load.ladder.findIndex((_, i) => !done.includes(i));
  return <>
    <div className="list steps">
      {load.ladder.map((step, i) => {
        const goal = i === load.ladder.length - 1;
        const isDone = done.includes(i);
        return <button type="button" key={i} className={`step${isDone ? ' done' : ''}${i === next ? ' next' : ''}${goal ? ' goal' : ''}`}
          aria-pressed={isDone} onClick={() => onToggle(i)}>
          <span className="check-circle"><Icon name="check" weight={3.2} /></span>
          <span className="step-weight"><b className="num rounded">{step.total}</b><small className="num">{Math.round(step.total / base * 100)}% · {goal ? 'objetivo' : `×${step.reps}`}</small></span>
          <span className="step-note"><MiniPlates plates={step.plates} />{step.note}</span>
        </button>;
      })}
    </div>
    {done.length > 0 && <div className="center"><button type="button" className="plain-button" onClick={onReset}>Reiniciar escalera</button></div>}
  </>;
}
