'use client';

import { useEffect, useState } from 'react';
import { RMS, bestRecord, firstRm, getCatalog, moveInfo, num, toKg } from '../../lib/catalog';
import { DEFAULT_PCT, PLATE_STYLE, computeLoad, plateOptions, round5, sum } from '../../lib/plates';
import Icon from '../ui/icon';
import { List, Row } from '../ui/list';
import { BackButton, LargeTitle, NavBar } from '../ui/nav-bar';
import { SegmentedControl } from '../ui/controls';
import PlateDisc from '../ui/plate-disc';

export const EXERCISE_DEFAULTS = {
  view: 'pick', cat: null, move: null, free: false, rm: 1, base: 0, pct: 80,
  extra: [], minus: [], sel: 0, panel: 'load', ts: 0,
};
const PANELS = ['load', 'pcts'];

// Old sessions go back to the picker; malformed stored lists are reset. Fields of earlier versions (the base
// editor and the warm-up ladder) are dropped, and the warm-up panel opens as the barbell.
export function restoreExercise(stored) {
  const { editBase, done, key, ...rest } = stored;
  const ex = { ...rest, extra: Array.isArray(rest.extra) ? rest.extra : [], minus: Array.isArray(rest.minus) ? rest.minus : [] };
  if (!PANELS.includes(ex.panel)) ex.panel = 'load';
  if (Date.now() - (ex.ts || 0) > 8 * 3600e3 && ex.view !== 'pick') ex.view = 'pick';
  return ex;
}

export function selectMovePatch(records, move) {
  const rm = firstRm(records, move) || 1;
  return {
    view: 'run', move, free: false, cat: moveInfo(move).group.name, extra: [], minus: [], sel: 0, panel: 'load',
    rm, base: bestRecord(records, move, rm)?.value || 0, pct: DEFAULT_PCT,
  };
}

// Exercise the guided tour shows: the first lift with a PR, or a free calculation.
export function tourExercise(records) {
  const move = getCatalog().Lift.groups.flatMap((group) => group.moves).find((name) => firstRm(records, name));
  if (move) return selectMovePatch(records, move);
  return { ...EXERCISE_DEFAULTS, view: 'run', free: true, base: 225, pct: DEFAULT_PCT };
}

const scrollTop = () => window.scrollTo({ top: 0 });
const block = (color) => ({ '--b': `var(${color})` });
const FREE_PATCH = { view: 'run', free: true };

export default function ExecuteView({ ex, setEx, settings, records, banner, onOpenSettings }) {
  const go = (patch) => { setEx(patch); scrollTop(); };
  if (ex.view === 'pick') {
    return <Picker ex={ex} go={go} settings={settings} records={records} banner={banner} onOpenSettings={onOpenSettings} />;
  }
  if (ex.view === 'moves') return <Moves ex={ex} go={go} records={records} />;
  return <Workbench ex={ex} setEx={setEx} go={go} settings={settings} records={records} onOpenSettings={onOpenSettings} />;
}

/* ---------- Picker ---------- */
function Picker({ ex, go, settings, records, banner, onOpenSettings }) {
  const canResume = ex.base > 0 && (ex.move || ex.free);
  const resumeTarget = canResume ? computeLoad(ex, settings, settings.simple).target : 0;
  return <>
    <LargeTitle title="Execute" subtitle="¿Qué vas a levantar?"
      trailing={<button type="button" className="sq-btn" aria-label="Ajustes" data-tour="settings" onClick={onOpenSettings}><Icon name="gear" /></button>} />
    {banner}
    {canResume && <div className="resume-card">
      <button type="button" className="resume-main" onClick={() => go({ view: 'run' })}>
        <span className="resume-copy">
          <small>Continuar</small>
          <b>{ex.free ? 'Cálculo libre' : ex.move} · {num(ex.pct)}%</b>
        </span>
        <span className="resume-weight display num">{resumeTarget}<small>lb</small></span>
      </button>
      <button type="button" className="resume-dismiss" aria-label="Quitar cálculo anterior"
        onClick={() => go({ move: null, free: false, base: 0, extra: [], minus: [] })}>
        <Icon name="xmark" weight={2.6} />
      </button>
    </div>}
    <div className="category-grid" data-tour="categories">
      {getCatalog().Lift.groups.map((group) => {
        const count = group.moves.filter((move) => firstRm(records, move)).length;
        return <button type="button" key={group.name} className="category-card" style={block(group.color)}
          onClick={() => go({ cat: group.name, view: 'moves' })}>
          <span className="category-letter display" aria-hidden="true">{group.name[0]}</span>
          <span className="category-count"><b className="display num">{count}</b><small>{count ? 'con PR' : 'Sin PRs'}</small></span>
          <span className="category-name display">{group.name}</span>
        </button>;
      })}
    </div>
    <button type="button" className="outline-row" data-tour="free-calc" onClick={() => go(FREE_PATCH)}>
      <span className="outline-glyph display" aria-hidden="true">%</span>
      <span className="outline-copy"><b>Cálculo libre</b><small>Cualquier peso y porcentaje</small></span>
      <Icon name="arrowRight" weight={2.4} />
    </button>
  </>;
}

/* ---------- Movements of a group ---------- */
function Moves({ ex, go, records }) {
  const { groups } = getCatalog().Lift;
  const group = groups.find((g) => g.name === ex.cat) || groups[0] || { name: '', color: '--b-gray', moves: [] };
  const withPR = group.moves.filter((move) => firstRm(records, move));
  const without = group.moves.filter((move) => !firstRm(records, move));
  const row = (move) => {
    const rm = firstRm(records, move);
    return <Row key={move} disabled={!rm} chevron={!!rm} value={!!rm}
      onClick={() => go(selectMovePatch(records, move))}
      leading={<i className="dot" style={{ '--c': rm ? 'var(--b)' : 'var(--line)' }} />}
      title={move}
      detail={rm ? <>{bestRecord(records, move, rm).value}<small>lb</small>{rm > 1 && <em>{rm}RM</em>}</> : 'Sin PR'} />;
  };
  return <div style={block(group.color)}>
    <NavBar back={{ label: 'Execute', onClick: () => go({ view: 'pick' }) }} title={group.name}>
      <section className="category-hero">
        <span className="category-letter display" aria-hidden="true">{group.name[0]}</span>
        <p>{withPR.length ? `${withPR.length} con PR` : 'Sin PRs'} · {group.moves.length} {group.moves.length === 1 ? 'movimiento' : 'movimientos'}</p>
        <h1 className="display">{group.name}</h1>
      </section>
    </NavBar>
    {withPR.length ? <List>{withPR.map(row)}</List> : <p className="empty">Aún no tienes PRs en {group.name}</p>}
    {without.length > 0 && <List header="Sin PR registrado">{without.map(row)}</List>}
    <List>
      <Row leading={<span className="row-icon display" aria-hidden="true">%</span>} title="Cálculo libre"
        subtitle="Cualquier peso y porcentaje" chevron onClick={() => go(FREE_PATCH)} />
    </List>
  </div>;
}

/* ---------- Working screen ---------- */
function Workbench({ ex, setEx, go, settings, records, onOpenSettings }) {
  const simple = !!settings.simple;
  const load = computeLoad(ex, settings, simple);
  const adjusted = !simple && (ex.extra.length > 0 || ex.minus.length > 0);
  const resetAdj = { extra: [], minus: [] };
  const group = ex.free ? null : moveInfo(ex.move).group;
  const diff = load.target - load.start;
  const status = !adjusted ? null : diff > 0 ? 'over' : diff < 0 ? 'under' : 'exact';
  const panel = PANELS.includes(ex.panel) ? ex.panel : 'load';

  // Store a desired load as the difference against the selected option.
  const addPlate = (plate) => load.plates && setEx({ extra: [...ex.extra, plate].sort((a, b) => b - a) });
  const removePlate = (item) => {
    if (simple) return;
    if (item.extra) { const extra = [...ex.extra]; extra.splice(extra.indexOf(item.p), 1); setEx({ extra }); }
    else setEx({ minus: [...ex.minus, item.p] });
  };

  return <div className="workbench" style={block(group ? group.color : '--ink')}>
    {/* Navigation and the weight stay at the top while the rest scrolls. */}
    <div className="wb-head">
      <nav className="wb-nav">
        <BackButton label={ex.free ? 'Execute' : group.name} onClick={() => go({ view: ex.free ? 'pick' : 'moves' })} />
        <h1 className="wb-title">{ex.free ? 'Cálculo libre' : ex.move}</h1>
        <span className="wb-actions">
          {ex.free
            ? <button type="button" className="nav-text" onClick={() => setEx({ base: 0, ...resetAdj, sel: 0, pct: DEFAULT_PCT })}>Limpiar</button>
            : <button type="button" className="nav-icon" aria-label="Cálculo libre" onClick={() => go(FREE_PATCH)}><Icon name="pencil" /></button>}
          <button type="button" className="nav-icon" aria-label="Barra y discos" onClick={onOpenSettings}><Icon name="gear" /></button>
        </span>
      </nav>
      <section className="weight-card" data-tour="weight" aria-label="Peso total">
        {ex.base > 0
          ? <div className="hero">
            <div className="hero-weight display num" key={load.target}>{load.target}<small>lb</small></div>
            <div className="hero-meta num">
              <b>{num(adjusted ? load.target / ex.base * 100 : ex.pct)}% de {num(ex.base)}</b>
              <span>{toKg(load.target)} kg</span>
            </div>
          </div>
          : <p className="hero-empty">{ex.free ? 'Escribe un peso y el porcentaje para empezar' : 'Sin PR para este RM'}</p>}
        {ex.base > 0 && adjusted && <TargetStatus status={status} load={load} pct={ex.pct} onReset={() => setEx(resetAdj)} />}
        <BaseControls ex={ex} setEx={setEx} records={records} resetAdj={resetAdj} />
      </section>
    </div>

    {ex.base > 0 && <div className={`workbench-panel${simple ? ' simple' : ''}`}>
      {!simple && <div data-tour="exec-panel">
        <SegmentedControl label="Vista" value={panel} onChange={(next) => setEx({ panel: next })}
          options={[{ value: 'load', label: 'Barra' }, { value: 'pcts', label: 'Porcentajes' }]} />
      </div>}
      {panel === 'load' || simple
        ? <LoadCard load={load} ex={ex} setEx={setEx} settings={settings} simple={simple} onAdd={addPlate} onRemove={removePlate} />
        : <Percents base={ex.base} current={adjusted ? null : ex.pct} settings={settings}
          onPick={(pct) => setEx({ pct, ...resetAdj, sel: 0 })} />}
    </div>}
  </div>;
}

// Where the adjusted load stands against the percentage target: short of it, over it or on it.
const TARGET_STATUS = {
  under: { icon: 'arrowDown', title: (lb) => `Faltan ${lb} lb`, detail: (side, goal) => `${side} lb por lado · meta ${goal} lb` },
  over: { icon: 'arrowUp', title: (lb) => `${lb} lb arriba`, detail: (side, goal) => `${side} lb por lado · meta ${goal} lb` },
  exact: { icon: 'check', title: () => 'En el objetivo', detail: (_, goal) => `Meta ${goal} lb` },
};

function TargetStatus({ status, load, pct, onReset }) {
  const copy = TARGET_STATUS[status];
  const diff = Math.abs(load.target - load.start);
  return <div className="target-status" data-status={status} role="status">
    <span className="target-icon"><Icon name={copy.icon} weight={3} /></span>
    <span className="target-copy num">
      <b>{copy.title(num(diff))}</b>
      <small>{copy.detail(num(diff / 2), load.start)}</small>
    </span>
    <button type="button" className="target-reset num" onClick={onReset} aria-label={`Volver al ${num(pct)}%`}>
      <Icon name="undo" weight={2.6} />{num(pct)}%
    </button>
  </div>;
}

// RM (or the free base weight) on the left and the percentage on the right, always visible under the weight.
function BaseControls({ ex, setEx, records, resetAdj }) {
  const [pctText, setPctText] = useState(num(ex.pct));
  const [baseText, setBaseText] = useState(ex.base ? num(ex.base) : '');
  useEffect(() => { setPctText((text) => (parseFloat(text.replace(',', '.')) === ex.pct ? text : num(ex.pct))); }, [ex.pct]);
  useEffect(() => { if (!ex.base) setBaseText(''); }, [ex.base]);

  const onKey = (event) => { if (event.key === 'Enter') event.currentTarget.blur(); };
  const step = (delta) => setEx({ pct: Math.min(150, Math.max(5, Math.round((ex.pct + delta) * 10) / 10)), ...resetAdj });
  return <div className="base-controls" data-tour="base-editor">
    {ex.free
      ? <label className="base-field"><input className="display num" inputMode="decimal" placeholder="Peso" value={baseText} autoFocus={!ex.base}
        aria-label="Peso base en libras" enterKeyHint="done" onKeyDown={onKey}
        onChange={(event) => { setBaseText(event.target.value); setEx({ base: parseFloat(event.target.value.replace(',', '.')) || 0, ...resetAdj }); }} />lb</label>
      : <div className="rm-tabs" role="group" aria-label="Repeticiones máximas">
        {RMS.map((rm) => <button type="button" key={rm} aria-pressed={rm === ex.rm} disabled={!bestRecord(records, ex.move, rm)}
          onClick={() => rm !== ex.rm && setEx({ rm, base: bestRecord(records, ex.move, rm)?.value || 0, ...resetAdj })}>{rm}RM</button>)}
      </div>}
    <div className="pct-stepper">
      <button type="button" onClick={() => step(-5)} aria-label="Bajar 5 %"><Icon name="minus" weight={2.8} /></button>
      <label className="pct-field"><input className="display num" inputMode="decimal" value={pctText} aria-label="Porcentaje" enterKeyHint="done"
        onKeyDown={onKey} onChange={(event) => {
          setPctText(event.target.value);
          const pct = parseFloat(event.target.value.replace(',', '.'));
          if (pct > 0) setEx({ pct, ...resetAdj });
        }} />%</label>
      <button type="button" onClick={() => step(5)} aria-label="Subir 5 %"><Icon name="plus" weight={2.8} /></button>
    </div>
  </div>;
}

const plateStyle = (plate) => PLATE_STYLE[plate] || ['--ink3', 50];
const plateVars = (plate) => {
  const [color, height] = plateStyle(plate);
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
      <span>Por lado · <b className="num">{num(sum(load.plates))} lb</b></span>
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
  return <span className="mini-plates" aria-hidden="true">{plates.map((plate, i) => {
    const [color, height] = plateStyle(plate);
    return <i key={i} style={{ height: Math.round(height * 0.26), '--pc': `var(${color})` }} />;
  })}</span>;
}

// Every 5% from 100 down to 40 on the current base, each loaded with the recommended option.
// Tapping one sets that percentage in the card above without moving the scroll.
function Percents({ base, current, settings, onPick }) {
  const rows = [];
  for (let pct = 100; pct >= 40; pct -= 5) {
    const goal = Math.max(settings.bar, round5(base * pct / 100));
    const plates = plateOptions(goal, settings)[0]?.plates ?? null;
    rows.push({ pct, total: plates ? settings.bar + 2 * sum(plates) : goal, plates });
  }
  return <div className="percents">
    {rows.map(({ pct, total, plates }) => <button type="button" key={pct} className="pct-row" aria-pressed={pct === current}
      aria-label={`Usar ${pct}%: ${total} lb`} onClick={() => onPick(pct)}>
      <span className="pct-value display num">{pct}<small>%</small></span>
      <span className="pct-load">
        <b className="num">{total} lb</b>
        <small className="num">{!plates ? 'Sin combinación con tus discos' : plates.length ? `${plates.join(' · ')} por lado` : 'Solo la barra'}</small>
      </span>
      {plates?.length ? <MiniPlates plates={plates} /> : <span />}
    </button>)}
  </div>;
}
