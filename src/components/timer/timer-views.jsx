'use client';

import { useEffect, useRef, useState } from 'react';
import { PRESETS, TIMER_TYPES, formatClock, matchesPreset, normalizeConfig, parseDigits } from '../../lib/timer-engine';
import Icon from '../ui/icon';
import Sheet from '../ui/sheet';
import { useAlert } from '../ui/alert';
import { List, Row } from '../ui/list';
import { LargeTitle } from '../ui/nav-bar';
import { useTimer } from './timer-provider';

const glyph = (d) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
export const TEMPLATES = {
  amrap: { name: 'AMRAP', color: '--green', icon: glyph('M6 5v14M10 5v14M14 5v14M18 5v14M3.5 15.5l17-7') },
  emom: { name: 'EMOM', color: '--cyan', icon: glyph('M2.5 12h3M8 12h3M13.5 12h3M19 12h2.5') },
  tabata: { name: 'TABATA', color: '--indigo', icon: glyph('M5 6v12M9.5 9v6M14 6v12M18.5 9v6') },
  fortime: { name: 'FOR TIME', color: '--amber', icon: glyph('M4 9h7M4 13h16M13 17h7') },
};
const FIELDS = {
  amrap: [['duration', 'Duración']],
  emom: [['interval', 'Intervalo'], ['rounds', 'Rondas']],
  tabata: [['work', 'Trabajo'], ['rest', 'Descanso'], ['rounds', 'Rondas']],
  fortime: [['cap', 'Límite de tiempo']],
};

const span = (ms) => (ms < 60_000 ? `${ms / 1000} s` : formatClock(ms));
const describe = (c) => ({
  amrap: () => `Máximas rondas en ${formatClock(c.duration)}`,
  emom: () => `Cada ${span(c.interval)} por ${c.rounds} rondas`,
  tabata: () => `${span(c.work)} de trabajo y ${span(c.rest)} de descanso por ${c.rounds} rondas`,
  fortime: () => `Lo más rápido posible · límite ${formatClock(c.cap)}`,
})[c.type]();

const minutes = (ms) => (ms % 60_000 ? formatClock(ms) : `${ms / 60_000} min`);
const presetLabel = (type, p) => ({
  amrap: () => minutes(p.duration),
  emom: () => `${p.rounds} × ${span(p.interval)}`,
  tabata: () => `${p.work / 1000}/${p.rest / 1000} × ${p.rounds}`,
  fortime: () => minutes(p.cap),
})[type]();

// Finer steps for short segments: 5 s under a minute, 15 s under ten, then a minute.
function stepValue(key, value, direction) {
  if (key === 'rounds') return value + direction;
  const reference = direction > 0 ? value : value - 1;
  const step = reference < 60_000 ? 5_000 : reference < 600_000 ? 15_000 : 60_000;
  return value + direction * step;
}

function clockOf(run, view) {
  if (run.config.type === 'fortime' && view.segment.kind !== 'prep') return formatClock(view.workElapsed);
  return formatClock(view.segmentRemaining, { ceil: true });
}

function phaseOf(view) {
  if (view.paused) return 'En pausa';
  if (view.segment.kind === 'prep') return 'Prepárate';
  return view.segment.kind === 'rest' ? 'Descanso' : 'Trabajo';
}

function TemplateTile({ type, size = 'md' }) {
  const t = TEMPLATES[type];
  return <span className={`tile tile-${size}`} style={{ '--c': `var(${t.color})` }}>{t.icon}</span>;
}

/* ---------- Tab ---------- */
export function TimerView() {
  const timer = useTimer();
  const [editing, setEditing] = useState(null);
  const current = timer.active ? TEMPLATES[timer.run.config.type] : null;
  return <>
    <LargeTitle title="Timer" subtitle="Elige una plantilla para tu workout." />
    {current && <button type="button" className="live-card" style={{ '--c': `var(${current.color})` }} onClick={timer.openRun}>
      <span className="live-dot" aria-hidden="true" />
      <span className="live-copy"><small>Timer en curso</small><b>{current.name}</b></span>
      <span className="live-clock num rounded">{clockOf(timer.run, timer.view)}</span>
    </button>}
    <List header="Plantillas" data-tour="timer-templates">
      {TIMER_TYPES.map((type) => <Row key={type} className="template-row" leading={<TemplateTile type={type} size="lg" />}
        title={TEMPLATES[type].name} subtitle={describe(timer.configs[type])} chevron
        onClick={() => { timer.unlock(); setEditing({ ...timer.configs[type] }); }} />)}
    </List>
    <TimerConfigSheet editing={editing} setEditing={setEditing} />
  </>;
}

/* ---------- Configuration ---------- */
function TimerConfigSheet({ editing, setEditing }) {
  const timer = useTimer();
  const [shown, setShown] = useState(editing);
  useEffect(() => { if (editing) setShown(editing); }, [editing]);
  const close = () => setEditing(null);
  // Shown keeps the last configuration while the sheet slides away.
  const config = (editing || shown) && normalizeConfig(editing || shown);
  const workTotal = config && {
    amrap: config.duration, fortime: config.cap, emom: config.interval * config.rounds,
    tabata: config.work * config.rounds + config.rest * (config.rounds - 1),
  }[config.type];

  return <Sheet open={!!editing} onClose={close} title={config && TEMPLATES[config.type].name}
    trailing={<button type="button" className="nav-text strong" onClick={close}>Cancelar</button>}>
    {config && <>
      <div className="template-head">
        <TemplateTile type={config.type} size="xl" />
        <p>{describe(config)}</p>
      </div>
      <div className="chips preset-chips" role="group" aria-label="Presets recomendados">
        {PRESETS[config.type].map((preset) => <button key={presetLabel(config.type, preset)} type="button" className="chip"
          style={{ '--c': `var(${TEMPLATES[config.type].color})` }} aria-pressed={matchesPreset(config, preset)}
          onClick={() => setEditing({ ...config, ...preset })}>{presetLabel(config.type, preset)}</button>)}
      </div>
      <List footer={`Duración total ${formatClock(workTotal)} · empieza con 10 s para prepararte${timer.active ? '. Reemplaza el timer en curso.' : '.'}`}>
        {FIELDS[config.type].map(([key, label]) => <Row key={key} title={label}>
          <span className="stepper">
            <button type="button" aria-label={`Menos ${label.toLowerCase()}`}
              onClick={() => setEditing(normalizeConfig({ ...config, [key]: stepValue(key, config[key], -1) }))}>−</button>
            <ValueInput field={key} label={label} value={config[key]}
              onCommit={(value) => setEditing(normalizeConfig({ ...config, [key]: value }))} />
            <button type="button" aria-label={`Más ${label.toLowerCase()}`}
              onClick={() => setEditing(normalizeConfig({ ...config, [key]: stepValue(key, config[key], 1) }))}>+</button>
          </span>
        </Row>)}
      </List>
      <button type="button" className="filled-button" style={{ '--tint': `var(${TEMPLATES[config.type].color})` }}
        onClick={() => { setEditing(null); timer.saveConfig(config); }}><Icon name="play" fill /> Iniciar</button>
    </>}
  </Sheet>;
}

// Typed digits shown as a clock while editing: "130" reads 1:30.
const digitClock = (digits) => (digits ? `${digits.slice(0, -2) || '0'}:${digits.slice(-2).padStart(2, '0')}` : '');

// Tapping the value opens the numeric keyboard; the typed value replaces the
// current one on blur or Enter, and Escape or an empty field keep it.
function ValueInput({ field, label, value, onCommit }) {
  const rounds = field === 'rounds';
  const [draft, setDraft] = useState(null);
  const cancelled = useRef(false);
  const display = rounds ? `${value}` : span(value);

  function commit() {
    const digits = draft;
    setDraft(null);
    if (cancelled.current || !digits) { cancelled.current = false; return; }
    onCommit(rounds ? Number(digits) : parseDigits(digits));
  }

  return <input className="num" type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off"
    aria-label={rounds ? label : `${label}, minutos y segundos`}
    placeholder={display} value={draft === null ? display : rounds ? draft : digitClock(draft)}
    onFocus={() => { cancelled.current = false; setDraft(''); }}
    onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, rounds ? 2 : 4))}
    onBlur={commit}
    onKeyDown={(e) => {
      // Escape cancels the edit without closing the sheet.
      if (e.key === 'Escape') { cancelled.current = true; e.stopPropagation(); }
      if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
    }} />;
}

/* ---------- Running and summary ---------- */
// Pulse style of the wave emitted at an elapsed instant: stronger on the 3-2-1
// ticks and segment changes, distinct at half time, soft on every other second.
function beatAt(plan, at) {
  const cue = plan.cues.find((event) => event.at === at)?.cue;
  if (!cue) return 'soft';
  return cue === 'tick' || cue === 'half' ? cue : 'mark';
}

function Wave({ at, elapsed, beat }) {
  // Fixed at mount so the wave keeps its phase while the clock re-renders.
  const [delay] = useState(() => Math.min(0, at - elapsed));
  return <i className="wave" data-beat={beat} style={{ animationDelay: `${delay}ms` }} />;
}

// Waves ripple out from the ring once per second; each lives a few seconds.
function Waves({ view }) {
  if (view.paused) return null;
  const second = Math.floor(view.elapsed / 1000);
  const beats = [];
  for (let s = Math.max(0, second - 2); s <= second; s++) beats.push(s * 1000);
  return <div className="ring-waves" aria-hidden="true">
    {beats.map((at) => <Wave key={at} at={at} elapsed={view.elapsed} beat={beatAt(view.plan, at)} />)}
  </div>;
}

function ProgressRing({ value, waves, children }) {
  const radius = 128;
  const length = 2 * Math.PI * radius;
  return <div className="ring">
    {waves}
    <svg viewBox="0 0 280 280" aria-hidden="true">
      <circle className="ring-track" cx="140" cy="140" r={radius} />
      <circle className="ring-value" cx="140" cy="140" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - value)} />
    </svg>
    <div className="ring-content">{children}</div>
  </div>;
}

function Summary({ run, view }) {
  const { type } = run.config;
  const reason = run.finishReason;
  let title = 'Completado', big = formatClock(view.workElapsed), detail = '';
  if (reason === 'stopped') { title = 'Terminado antes'; detail = `Tiempo de trabajo ${formatClock(view.workElapsed)}`; }
  if (type === 'amrap') { big = `${run.rounds}`; detail = `${run.rounds === 1 ? 'ronda' : 'rondas'} en ${formatClock(view.workElapsed)}`; }
  if (type === 'fortime' && reason === 'done') { title = 'Tu tiempo'; detail = `Límite ${formatClock(run.config.cap)}`; }
  if (type === 'fortime' && reason === 'cap') { title = 'Llegaste al límite'; detail = 'Se acabó el tiempo'; }
  if ((type === 'emom' || type === 'tabata') && reason !== 'stopped') detail = `${view.plan.totalRounds} rondas`;
  return <div className="timer-stage summary">
    <span className="summary-badge"><Icon name={reason === 'stopped' ? 'flag' : 'check'} weight={3} /></span>
    <p className="timer-phase">{title}</p>
    <div className="timer-clock num rounded">{big}</div>
    <p className="timer-sub">{detail}</p>
  </div>;
}

export function TimerRunSheet() {
  const timer = useTimer();
  const alert = useAlert();
  // Keep the last screen while the sheet slides away after Listo.
  const last = useRef(null);
  if (timer.run) last.current = { run: timer.run, view: timer.view };
  const { run, view } = last.current || {};
  const open = timer.runOpen && !!timer.run;
  const t = run && TEMPLATES[run.config.type];

  async function confirmEnd() {
    timer.unlock();
    const confirmed = await alert({
      title: '¿Terminar el workout?', message: 'Verás el resumen con el tiempo hasta ahora.',
      actions: [{ label: 'Seguir', role: 'cancel' }, { label: 'Terminar', role: 'destructive', value: true }],
    });
    if (confirmed) timer.end();
  }

  let body = null;
  if (run && view) {
    const { type } = run.config;
    const remaining = formatClock(view.workRemaining, { ceil: true });
    const rounds = type === 'emom' || type === 'tabata';
    let sub = `Quedan ${remaining}`;
    if (view.segment.kind === 'prep') sub = `Empieza ${t.name}`;
    else if (rounds) sub = `Ronda ${view.segment.round} de ${view.plan.totalRounds}`;
    else if (type === 'fortime') sub = `Límite ${formatClock(run.config.cap)}`;
    const meta = rounds && view.segment.kind !== 'prep' ? `Quedan ${remaining} en total` : null;
    const kind = view.paused ? 'paused' : view.segment.kind;

    body = view.done ? <>
      <Summary run={run} view={view} />
      <div className="timer-footer">
        <button type="button" className="filled-button" onClick={timer.clear}>Listo</button>
        <button type="button" className="plain-button wide" onClick={() => timer.begin(run.config)}><Icon name="undo" /> Repetir</button>
      </div>
    </> : <>
      <div className="timer-stage" data-kind={kind}>
        <ProgressRing value={Math.min(1, view.segmentElapsed / view.segment.duration)} waves={<Waves view={view} />}>
          <p className="timer-phase">{phaseOf(view)}</p>
          <div className="timer-clock num rounded">{clockOf(run, view)}</div>
          <p className="timer-sub">{sub}</p>
        </ProgressRing>
        {meta && <p className="timer-meta num">{meta}</p>}
      </div>
      <div className="timer-panel">
        {type === 'amrap' && <div className="round-counter">
          <div className="round-count">
            <span><b className="num rounded" key={run.rounds}>{run.rounds}</b> {run.rounds === 1 ? 'ronda' : 'rondas'}</span>
            <button type="button" className="plain-button" onClick={timer.undoRound} disabled={!run.rounds}><Icon name="undo" /> Deshacer</button>
          </div>
          <button type="button" className="big-action" onClick={timer.addRound}>+1 ronda</button>
        </div>}
        {type === 'fortime' && <button type="button" className="big-action" onClick={timer.finishNow}><Icon name="flag" /> Terminé</button>}
        <div className="timer-controls">
          <button type="button" className="circle-button" onClick={confirmEnd}><span>Terminar</span></button>
          <button type="button" className={`circle-button ${view.paused ? 'go' : 'hold'}`} onClick={timer.togglePause}>
            <span>{view.paused ? 'Reanudar' : 'Pausa'}</span>
          </button>
        </div>
      </div>
    </>;
  }

  return <Sheet open={open} onClose={timer.minimize} title={t?.name} className="timer-sheet" layer={3}
    leading={<button type="button" className="nav-icon" aria-label="Minimizar" onClick={timer.minimize}><Icon name="chevronDown" weight={2.6} /></button>}>
    <div className="timer-body" data-done={!!view?.done} style={{ '--c': t ? `var(${t.color})` : undefined }}>{body}</div>
  </Sheet>;
}

/* ---------- Compact indicator (Dynamic Island style) ---------- */
export function TimerPill() {
  const timer = useTimer();
  const { run, view } = timer;
  if (!timer.active || timer.runOpen || !view) return null;
  const { type } = run.config;
  let label = TEMPLATES[type].name;
  if (view.paused) label = 'En pausa';
  else if (view.segment.kind === 'prep') label = 'Prepárate';
  else if (type === 'emom' || type === 'tabata') label = `R${view.segment.round}/${view.plan.totalRounds}`;
  const clock = clockOf(run, view);
  return <button type="button" className="timer-pill" style={{ '--c': `var(${TEMPLATES[type].color})` }} onClick={timer.openRun}
    aria-label={`Timer ${TEMPLATES[type].name}: ${clock}, ${label}. Abrir timer`}>
    <i className="live-dot" data-paused={view.paused} />
    <b className="num rounded">{clock}</b>
    <span>{label}</span>
  </button>;
}
