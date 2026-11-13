'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { bestRecord, formatValue, moveInfo, parseValue, today } from '../../lib/catalog';
import { addDays, itemName, loadText, recordCandidate, resolveLoad, volumeText, weekDays, weekStart } from '../../lib/training';
import { useAlert } from '../ui/alert';
import Icon from '../ui/icon';
import { useTimer } from '../timer/timer-provider';
import { formatClock } from '../../lib/timer-engine';
import { TEMPLATES } from '../timer/timer-views';

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const SCORE_FIELDS = {
  time: { label: 'Tu tiempo', placeholder: 'mm:ss', inputMode: 'numeric' },
  reps: { label: 'Tus reps', placeholder: 'reps', inputMode: 'numeric' },
  weight: { label: 'Tu peso', placeholder: 'lb', inputMode: 'decimal' },
};
/**
 * One color per block, taken from what it is: its timer's (AMRAP green, EMOM cyan…) when it has
 * one, otherwise its first movement's family (Squats pink, Cleans blue…), and neutral for text.
 */
export function blockColor(block) {
  if (block.timer) return TEMPLATES[block.timer.type].color;
  const first = block.items.find((item) => item.movement || item.parts?.length);
  const move = first?.movement ?? first?.parts?.[0]?.movement;
  return (move && moveInfo(move).group.color) || '--b-gray';
}

const seconds = (ms) => (ms < 60_000 ? `${ms / 1000} s` : formatClock(ms));
/**
 * How the block is done, as short tags under its title: its format first, then its numbers.
 * "FOR TIME · Límite 30:00 · Descanso 2:00", "EMOM · Cada 3:00 · 5 rondas".
 */
export function blockTags(block) {
  const { timer } = block;
  const tags = timer ? {
    fortime: [TEMPLATES.fortime.name, `Límite ${formatClock(timer.cap)}`],
    amrap: [TEMPLATES.amrap.name, formatClock(timer.duration)],
    emom: [TEMPLATES.emom.name, `Cada ${seconds(timer.interval)}`, `${timer.rounds} rondas`],
    tabata: [TEMPLATES.tabata.name, `${seconds(timer.work)} / ${seconds(timer.rest)}`, `${timer.rounds} rondas`],
  }[timer.type] : [];
  return block.rest ? [...tags, `Descanso ${formatClock(block.rest)}`] : tags;
}

const longDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
const clock = (value) => new Date(value).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fieldText = (value) => (value == null ? '' : String(value));

/** The athlete's programming: a week strip and the session of the chosen day. */
export default function PlanView({ plan, records, userId, active, onExecute, onAddRecord, onSaveRecord }) {
  const [selected, setSelected] = useState(today());
  const monday = weekStart(selected);
  const byDate = useMemo(() => {
    const map = new Map();
    for (const session of plan.sessions) map.set(session.date, [...(map.get(session.date) ?? []), session]);
    return map;
  }, [plan.sessions]);
  const sessions = byDate.get(selected) ?? [];
  const move = (weeks) => setSelected((current) => addDays(current, 7 * weeks));
  const now = today();

  return <>
    {/* The week is the first thing on screen; the tab bar already says this is the plan. */}
    <h1 className="visually-hidden">Plan</h1>
    {plan.error && <div className="banner warn" role="alert"><span>{plan.error}</span><button type="button" className="pill-btn" onClick={plan.reload}>Reintentar</button></div>}
    <nav className="week-strip top" aria-label="Semana">
      <button type="button" className="week-arrow" aria-label="Semana anterior" disabled={addDays(monday, -1) < plan.range.from} onClick={() => move(-1)}>
        <Icon name="chevronLeft" weight={2.6} />
      </button>
      {weekDays(monday).map((date, index) => {
        const day = byDate.get(date) ?? [];
        const done = day.length > 0 && day.every((session) => session.completedAt);
        return <button type="button" key={date} className="week-day" aria-pressed={date === selected} data-today={date === now}
          aria-label={longDate(date)} onClick={() => setSelected(date)}>
          <small>{DAY_LETTERS[index]}</small>
          <b className="num">{Number(date.slice(8))}</b>
          <i className="week-mark" data-state={done ? 'done' : day.length ? 'planned' : 'empty'}>{done && <Icon name="check" weight={3.4} />}</i>
        </button>;
      })}
      <button type="button" className="week-arrow" aria-label="Semana siguiente" disabled={addDays(monday, 7) > plan.range.to} onClick={() => move(1)}>
        <Icon name="chevronRight" weight={2.6} />
      </button>
    </nav>
    <div className="plan-date-row">
      <p className="plan-date">{longDate(selected)}</p>
      {selected !== now && <button type="button" className="plan-today" onClick={() => setSelected(now)}>Hoy</button>}
    </div>
    {!sessions.length && <p className="empty">{plan.loaded || plan.sessions.length ? 'No hay sesión programada para este día.' : 'Cargando tu plan…'}</p>}
    {sessions.map((session) => <SessionCard key={session.id} session={session} plan={plan} records={records} userId={userId} active={active}
      onExecute={onExecute} onAddRecord={onAddRecord} onSaveRecord={onSaveRecord} />)}
  </>;
}

function SessionCard({ session, plan, records, userId, active, preview = false, onExecute, onAddRecord, onSaveRecord }) {
  const alert = useAlert();
  const [results, setResults] = useState(session.results);
  const [saving, setSaving] = useState(false);
  const offered = useRef(new Set());
  const bestOf = (movement, rm) => bestRecord(records, movement, rm)?.value ?? null;
  const done = Boolean(session.completedAt);

  async function persist(next, changedItem) {
    setResults(next);
    try {
      await plan.saveLog(session.id, { results: next });
    } catch (err) {
      await alert({ title: 'No se pudo guardar', message: err.message });
      return;
    }
    if (changedItem) offerRecord(changedItem, next.items[changedItem.id]);
  }

  // A logged weight that beats the athlete's record is offered as a new one; it is never saved silently.
  async function offerRecord(item, result) {
    if (moveInfo(item.movement).type !== 'weight' || moveInfo(item.movement).tab == null) return;
    const candidate = recordCandidate(item, result, bestOf);
    const key = candidate && `${item.id}:${candidate.rm}:${candidate.value}`;
    if (!candidate || offered.current.has(key)) return;
    offered.current.add(key);
    const save = await alert({
      title: '¡Registraste un nuevo PR!',
      message: `${candidate.movement} · ${candidate.rm}RM de ${candidate.value} lb${candidate.previous ? ` (antes ${candidate.previous} lb)` : ''}. ¿Quieres guardarlo como tu nuevo récord?`,
      actions: [{ label: 'Ahora no', role: 'cancel' }, { label: 'Guardar PR', value: true }],
    });
    if (!save) return;
    try {
      await onSaveRecord({ move: candidate.movement, value: candidate.value, rm: candidate.rm, date: session.date, notes: '' });
    } catch (err) {
      await alert({ title: 'No se pudo guardar el PR', message: err.message });
    }
  }

  const setItem = (item, patch) => {
    const merged = { ...results.items[item.id], ...patch };
    const clean = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null));
    const items = { ...results.items };
    if (Object.keys(clean).length) items[item.id] = clean; else delete items[item.id];
    persist({ ...results, items }, patch.weight != null || (patch.reps != null && clean.weight != null) ? item : null);
  };
  const setScore = (block, value) => {
    const blocks = { ...results.blocks };
    if (value == null) delete blocks[block.id]; else blocks[block.id] = { value };
    persist({ ...results, blocks });
  };
  async function toggleDone() {
    setSaving(true);
    try { await plan.saveLog(session.id, { completed: !done }); }
    catch (err) { await alert({ title: 'No se pudo guardar', message: err.message }); }
    finally { setSaving(false); }
  }

  return <article className="plan-session" data-done={done}>
    <header className="plan-head">
      <h2 className="display">{session.title || 'Sesión del día'}</h2>
      {session.group && <span className="plan-tag" style={{ '--c': `var(${session.group.color})` }}>{session.group.name}</span>}
    </header>
    {session.notes && <p className="plan-notes">{session.notes}</p>}
    {session.content.blocks.map((block, index) => <PlanBlock key={block.id} block={block} index={index} content={session.content} results={results}
      bestOf={bestOf} division={plan.division} onItemChange={setItem} onScoreChange={setScore} onExecute={onExecute} onAddRecord={onAddRecord} />)}
    <button type="button" className="filled-button plan-done" data-done={done} disabled={saving} onClick={toggleDone}>
      <Icon name="check" weight={3} />{done ? `Completada · ${clock(session.completedAt)}` : 'Marcar como completada'}
    </button>
    {!preview && <Thread session={session} plan={plan} userId={userId} active={active} />}
  </article>;
}

// One block of the session. The movements lead; the block's timer and the athlete's log sit in a
// quiet row at its foot, and the log fields stay folded until asked for, or once something is logged.
function PlanBlock({ block, index, content, results, bestOf, division, onItemChange, onScoreChange, onExecute, onAddRecord }) {
  const letter = String.fromCharCode(65 + index);
  const loggable = block.items.some((item) => item.log) || block.score !== 'none';
  const logged = results.blocks[block.id] != null || block.items.some((item) => item.log && results.items[item.id]);
  const [logging, setLogging] = useState(logged);
  const open = loggable && logging;
  return <section className="plan-block" style={{ '--b': `var(${blockColor(block)})` }}>
    <header className="plan-block-head">
      <span className="plan-letter display" aria-hidden="true">{letter}</span>
      <div className="plan-block-title">
        <h3>{block.title || `Bloque ${letter}`}</h3>
        {blockTags(block).length > 0 && <p className="plan-tags">
          {blockTags(block).map((tag, index) => <span key={tag} data-kind={index === 0 && block.timer ? 'format' : undefined}>{tag}</span>)}
        </p>}
      </div>
    </header>
    {block.notes && <p className="plan-notes">{block.notes}</p>}
    {/* Rounds are the block's: everything below is repeated together, so it is said once, above it. */}
    {block.rounds > 1 && <p className="plan-rounds"><Icon name="repeat" weight={2.4} />{block.rounds} rondas de:</p>}
    {block.items.map((item) => <PlanItem key={item.id} item={item} content={content} results={results} bestOf={bestOf} division={division} logging={open}
      onChange={(patch) => onItemChange(item, patch)} onExecute={onExecute} onAddRecord={onAddRecord} />)}
    {open && block.score !== 'none' && <ScoreField type={block.score} value={results.blocks[block.id]?.value} onChange={(value) => onScoreChange(block, value)} />}
    {(block.timer || loggable) && <div className="plan-block-foot">
      {block.timer && <StartTimer config={block.timer} />}
      {loggable && <button type="button" className="plan-outline" aria-expanded={open} onClick={() => setLogging(!open)}>
        <Icon name="pencil" weight={2.4} />{open ? 'Ocultar registro' : 'Registrar'}
      </button>}
    </div>}
  </section>;
}

// The coach's clock for the block, started on the app's own timer with one tap.
function StartTimer({ config }) {
  const timer = useTimer();
  return <button type="button" className="plan-outline" onClick={() => timer?.begin(config)}><Icon name="play" fill />Iniciar timer</button>;
}

function PlanItem({ item, content, results, bestOf, division, logging, onChange, onExecute, onAddRecord }) {
  const load = resolveLoad(item, results, bestOf, division);
  const prescription = loadText(item, content);
  const volume = volumeText(item);
  const result = results.items[item.id] ?? {};
  const { base } = item.load;
  const baseMove = base?.kind === 'pr' ? base.movement || item.movement : null;
  return <div className="plan-item">
    <div className="plan-item-main">
      <div className="plan-item-text">
        <b>{itemName(item)}</b>
        {item.movement && item.label && <span>{item.label}</span>}
        <span className="plan-rx">{[volume, prescription].filter(Boolean).join(' · ')}{load.base ? ` (${load.base} lb)` : ''}</span>
      </div>
      {load.weight != null && <button type="button" className="plan-weight" aria-label={`Cargar ${load.weight} lb en la barra`}
        onClick={() => onExecute({ movement: item.load.type === 'percent' && baseMove === item.movement ? item.movement : null, rm: base?.rm, pct: item.load.value, base: load.base, weight: load.weight })}>
        <span className="display num">{load.weight}<small>lb</small></span><Icon name="barbell" />
      </button>}
    </div>
    {load.missing === 'pr' && <button type="button" className="plan-missing" onClick={() => onAddRecord(baseMove, base.rm)}>
      <Icon name="plus" weight={2.8} />Agrega tu {base.rm}RM{baseMove === item.movement ? '' : ` de ${baseMove}`}
    </button>}
    {load.missing === 'item' && <p className="plan-missing">Registra primero el peso de la línea base para ver tu carga.</p>}
    {item.notes && <p className="plan-notes">{item.notes}</p>}
    {item.log && logging && <div className="plan-log">
      <LogField label="Peso" unit="lb" inputMode="decimal" value={result.weight} parse={(text) => parseValue(text, 'weight')} onChange={(weight) => onChange({ weight })} />
      <LogField label="Reps" unit="reps" inputMode="numeric" value={result.reps} parse={(text) => parseValue(text, 'reps')} onChange={(reps) => onChange({ reps })} />
    </div>}
  </div>;
}

// Saves on blur, so typing never triggers a request per key. An empty field clears the value.
function LogField({ label, unit, inputMode, value, parse, format = fieldText, onChange }) {
  const [text, setText] = useState(format(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(format(value)); }, [value, format]);
  function commit() {
    const clean = text.trim();
    if (!clean) { setInvalid(false); if (value != null) onChange(null); return; }
    const parsed = parse(clean);
    if (!(parsed > 0)) { setInvalid(true); return; }
    setInvalid(false);
    if (parsed !== value) onChange(parsed);
  }
  return <label className="log-field">
    <span>{label}</span>
    <input inputMode={inputMode} placeholder={unit} value={text} aria-invalid={invalid} enterKeyHint="done"
      onChange={(event) => setText(event.target.value)} onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
  </label>;
}

const formatTime = (value) => (value == null ? '' : formatValue(value, 'time'));

function ScoreField({ type, value, onChange }) {
  const field = SCORE_FIELDS[type];
  return <div className="plan-log score">
    <LogField label={field.label} unit={field.placeholder} inputMode={field.inputMode} value={value}
      parse={(text) => parseValue(text, type)} format={type === 'time' ? formatTime : fieldText} onChange={onChange} />
  </div>;
}

function Thread({ session, plan, userId, active }) {
  const alert = useAlert();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { id, unread } = session;
  const { markSeen } = plan;
  // Reading the thread is what clears the unread mark; the tab stays mounted while hidden, so it must be showing.
  useEffect(() => { if (active && unread > 0) markSeen(id); }, [active, id, unread, markSeen]);

  async function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await plan.addComment(id, body);
      setText('');
    } catch (err) {
      await alert({ title: 'No se pudo enviar', message: err.message });
    } finally { setSending(false); }
  }

  return <section className="thread" aria-label="Comentarios">
    <h3 className="list-header">Comentarios con tu coach</h3>
    {session.comments.map((comment) => <p key={comment.id} className="bubble" data-mine={comment.authorId === userId}>
      {comment.body}<small>{clock(comment.createdAt)}</small>
    </p>)}
    <form className="thread-form" onSubmit={send}>
      <textarea rows={1} maxLength={2000} placeholder="Escribe cómo te fue…" value={text} onChange={(event) => setText(event.target.value)} />
      <button className="pill-btn" disabled={sending || !text.trim()}>Enviar</button>
    </form>
  </section>;
}

const NO_PLAN = { saveLog: async () => {}, addComment: async () => {}, markSeen: () => {} };
const noop = () => {};

/**
 * The plan as an athlete would see a session that is still being written: the week strip on its
 * day and the session card, with loads resolved from `records`. It is a picture, not a working
 * screen: nothing in it can be pressed.
 */
export function PlanPreview({ session, records, division = null }) {
  const monday = weekStart(session.date);
  return <div className="plan-preview" inert aria-label="Vista previa del atleta">
    <nav className="week-strip top" aria-hidden="true">
      <span className="week-arrow"><Icon name="chevronLeft" weight={2.6} /></span>
      {weekDays(monday).map((date, index) => <span key={date} className="week-day" aria-pressed={date === session.date}>
        <small>{DAY_LETTERS[index]}</small>
        <b className="num">{Number(date.slice(8))}</b>
        <i className="week-mark" data-state={date === session.date ? 'planned' : 'empty'} />
      </span>)}
      <span className="week-arrow"><Icon name="chevronRight" weight={2.6} /></span>
    </nav>
    <div className="plan-date-row"><p className="plan-date">{longDate(session.date)}</p></div>
    <SessionCard session={session} plan={{ ...NO_PLAN, division }} records={records} userId="" active={false} preview
      onExecute={noop} onAddRecord={noop} onSaveRecord={noop} />
  </div>;
}
