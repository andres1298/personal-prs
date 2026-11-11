'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { bestRecord, formatValue, moveInfo } from '../../lib/catalog';
import {
  allItems, BASE_RMS, itemName, LIMITS, loadText, newBlock, newItem, resolveLoad, volumeText,
} from '../../lib/training';
import { useAlert } from '../ui/alert';
import { SegmentedControl, Switch } from '../ui/controls';
import Icon from '../ui/icon';

const LOAD_OPTIONS = [['none', 'Sin carga'], ['weight', 'Peso (lb)'], ['percent', 'Porcentaje'], ['max', 'Máximo del día']];
const SCORE_OPTIONS = [['none', 'Sin resultado'], ['time', 'Tiempo'], ['reps', 'Repeticiones'], ['weight', 'Peso']];
const letter = (index) => String.fromCharCode(65 + index);
const longDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const clock = (value) => new Date(value).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const numberOrNull = (text) => (text.trim() === '' || !Number.isFinite(Number(text.replace(',', '.'))) ? null : Number(text.replace(',', '.')));

function swap(list, index, direction) {
  const next = [...list];
  const other = index + direction;
  if (other < 0 || other >= next.length) return list;
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

/**
 * Side panel to program one day for one target and to read what athletes did. Saving replaces
 * the day's session; results already logged stay as the athletes wrote them.
 */
export default function SessionEditor({ date, session, targetName, athletes, movements, initialTab, focusAthleteId, api, onSave, onDelete, onCopy, onClose }) {
  const alert = useAlert();
  const [draft, setDraft] = useState(() => ({
    title: session?.title ?? '', notes: session?.notes ?? '', content: session?.content ?? { blocks: [] }, published: session?.published ?? true,
  }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(session && initialTab === 'results' ? 'results' : 'program');
  // Whose numbers the percentages show: the only athlete of a 1:1 day, or one picked from the group.
  const [previewId, setPreviewId] = useState(athletes.length === 1 ? athletes[0].id : '');
  const [previewRecords, setPreviewRecords] = useState(null);
  const listId = useId();

  useEffect(() => {
    setPreviewRecords(null);
    if (!previewId) return undefined;
    let current = true;
    api.recordsOf(previewId).then((records) => { if (current) setPreviewRecords(records); }).catch(() => {});
    return () => { current = false; };
  }, [previewId, api]);

  const change = (patch) => { setDraft((current) => ({ ...current, ...patch })); setDirty(true); };
  const setBlocks = (update) => change({ content: { blocks: update(draft.content.blocks) } });
  const patchBlock = (id, patch) => setBlocks((blocks) => blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  const names = useMemo(() => movements.filter((movement) => !movement.hidden).map((movement) => movement.name), [movements]);
  const weightNames = useMemo(() => names.filter((name) => moveInfo(name).type === 'weight'), [names]);
  const bestOf = (movement, rm) => (previewRecords ? bestRecord(previewRecords, movement, rm)?.value ?? null : null);

  async function close() {
    if (dirty && !(await alert({
      title: '¿Salir sin guardar?', message: 'Los cambios de esta sesión se perderán.',
      actions: [{ label: 'Seguir editando', role: 'cancel' }, { label: 'Salir', role: 'destructive', value: true }],
    }))) return;
    onClose();
  }
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !document.querySelector('.alert-root')) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  async function save() {
    // Lines left without a name are dropped instead of blocking the save.
    const content = { blocks: draft.content.blocks.map((block) => ({ ...block, items: block.items.filter((item) => item.movement || item.label.trim()) })) };
    const incomplete = content.blocks.flatMap((block) => block.items).find((item) => ['weight', 'percent'].includes(item.load.type) && !(item.load.value > 0));
    if (incomplete) {
      await alert({ title: 'Falta una carga', message: `Escribe ${incomplete.load.type === 'percent' ? 'el porcentaje' : 'el peso'} de «${itemName(incomplete)}» o cambia su tipo de carga.` });
      return;
    }
    if (session?.logged > 0 && !(await alert({
      title: 'Esta sesión ya tiene resultados',
      message: `${session.logged === 1 ? '1 atleta ya registró' : `${session.logged} atletas ya registraron`} resultados. Sus registros se conservan tal como los anotaron, aunque cambies la sesión.`,
      actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Guardar cambios', value: true }],
    }))) return;
    setSaving(true);
    try {
      await onSave({ ...draft, content });
      setDraft((current) => ({ ...current, content }));
      setDirty(false);
    } catch (err) {
      await alert({ title: 'No se pudo guardar', message: err.message });
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!(await alert({
      title: '¿Borrar esta sesión?', message: 'Se quita del calendario de tus atletas.',
      actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Borrar', role: 'destructive', value: true }],
    }))) return;
    try { await onDelete(); }
    catch (err) { await alert({ title: 'No se pudo borrar', message: err.message }); }
  }

  async function createMovement(blockId, item) {
    try {
      const { movement } = await api.send('/api/movements', 'POST', { name: item.label.trim(), category: 'LIFT' });
      await api.reloadMovements();
      patchItem(blockId, item.id, { movement: movement.name, label: '' });
    } catch (err) {
      await alert({ title: 'No se pudo crear el movimiento', message: err.message });
    }
  }
  const patchItem = (blockId, itemId, patch) => setBlocks((blocks) => blocks.map((block) => (block.id !== blockId ? block
    : { ...block, items: block.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) })));

  const earlier = [];
  return <div className="drawer-root">
    <div className="drawer-scrim" onClick={close} aria-hidden="true" />
    <section className="drawer" role="dialog" aria-modal="true" aria-label={`Sesión del ${longDate(date)}`}>
      <header className="drawer-head">
        <div>
          <p className="drawer-kicker">{targetName}</p>
          <h2 className="display">{longDate(date)}</h2>
        </div>
        <button type="button" className="nav-text" onClick={close}>Cerrar</button>
      </header>
      {session && <SegmentedControl label="Vista" value={tab} onChange={setTab}
        options={[{ value: 'program', label: 'Programación' }, { value: 'results', label: `Resultados${session.logged ? ` · ${session.logged}` : ''}` }]} />}

      {tab === 'results' ? <Results sessionId={session.id} content={session.content} focusAthleteId={focusAthleteId} api={api} /> : <>
        <div className="editor-meta">
          <input className="editor-title" value={draft.title} maxLength={LIMITS.title} placeholder="Título de la sesión (opcional)"
            aria-label="Título de la sesión" onChange={(event) => change({ title: event.target.value })} />
          <textarea rows={2} value={draft.notes} maxLength={LIMITS.notes} placeholder="Notas del día: calentamiento, enfoque, recordatorios…"
            aria-label="Notas del día" onChange={(event) => change({ notes: event.target.value })} />
          {athletes.length > 1 && <label className="editor-preview">
            <span>Ver los pesos de</span>
            <select value={previewId} onChange={(event) => setPreviewId(event.target.value)}>
              <option value="">Nadie · solo porcentajes</option>
              {athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}
            </select>
          </label>}
        </div>

        <datalist id={listId}>{names.map((name) => <option key={name} value={name} />)}</datalist>
        {draft.content.blocks.map((block, blockIndex) => {
          const rows = block.items.map((item) => {
            const row = <ItemRow key={item.id} item={item} content={draft.content} earlier={[...earlier]} listId={listId} names={names} weightNames={weightNames}
              preview={previewId ? resolveLoad(item, null, bestOf) : null}
              onChange={(patch) => patchItem(block.id, item.id, patch)}
              onMove={(direction) => patchBlock(block.id, { items: swap(block.items, block.items.indexOf(item), direction) })}
              onRemove={() => patchBlock(block.id, { items: block.items.filter((other) => other.id !== item.id) })}
              onCreateMovement={() => createMovement(block.id, item)} />;
            earlier.push(item);
            return row;
          });
          return <section className="editor-block" key={block.id}>
            <header className="editor-block-head">
              <span className="plan-letter display" aria-hidden="true">{letter(blockIndex)}</span>
              <input value={block.title} maxLength={LIMITS.title} placeholder={`Bloque ${letter(blockIndex)} · p. ej. Fuerza, WOD, Accesorios`}
                aria-label={`Título del bloque ${letter(blockIndex)}`} onChange={(event) => patchBlock(block.id, { title: event.target.value })} />
              <button type="button" className="icon-button" aria-label="Subir bloque" disabled={blockIndex === 0}
                onClick={() => setBlocks((blocks) => swap(blocks, blockIndex, -1))}><Icon name="arrowUp" /></button>
              <button type="button" className="icon-button" aria-label="Bajar bloque" disabled={blockIndex === draft.content.blocks.length - 1}
                onClick={() => setBlocks((blocks) => swap(blocks, blockIndex, 1))}><Icon name="arrowDown" /></button>
              <button type="button" className="icon-button danger" aria-label="Quitar bloque"
                onClick={() => setBlocks((blocks) => blocks.filter((other) => other.id !== block.id))}><Icon name="xmark" /></button>
            </header>
            <textarea rows={2} value={block.notes} maxLength={LIMITS.notes} aria-label={`Notas del bloque ${letter(blockIndex)}`}
              placeholder="Notas o descripción: «RPE 8», «21-15-9 de thrusters y pull-ups», descansos…"
              onChange={(event) => patchBlock(block.id, { notes: event.target.value })} />
            {rows}
            <footer className="editor-block-foot">
              <button type="button" className="tinted-button" disabled={block.items.length >= LIMITS.items}
                onClick={() => patchBlock(block.id, { items: [...block.items, newItem()] })}><Icon name="plus" weight={2.8} />Línea</button>
              <label>
                <span>El atleta anota</span>
                <select value={block.score} onChange={(event) => patchBlock(block.id, { score: event.target.value })}>
                  {SCORE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </footer>
          </section>;
        })}
        <div className="editor-add">
          <button type="button" className="tinted-button" disabled={draft.content.blocks.length >= LIMITS.blocks}
            onClick={() => setBlocks((blocks) => [...blocks, newBlock({ items: [newItem()] })])}><Icon name="barbell" />Bloque de fuerza</button>
          <button type="button" className="tinted-button" disabled={draft.content.blocks.length >= LIMITS.blocks}
            onClick={() => setBlocks((blocks) => [...blocks, newBlock({ title: 'WOD', score: 'time' })])}><Icon name="timer" />WOD o texto libre</button>
        </div>
      </>}

      {tab === 'program' && <footer className="drawer-foot">
        <label className="editor-publish">
          <Switch checked={draft.published} label="Publicada" onChange={(published) => change({ published })} />
          <span>{draft.published ? 'Publicada: tus atletas la ven' : 'Borrador: solo tú la ves'}</span>
        </label>
        <span className="drawer-foot-actions">
          {session && <button type="button" className="nav-text danger" onClick={remove}>Borrar</button>}
          {session && <button type="button" className="nav-text" disabled={dirty} title={dirty ? 'Guarda antes de copiar' : undefined} onClick={onCopy}>Copiar día</button>}
          <button type="button" className="nav-text strong" disabled={saving || (!dirty && Boolean(session))} onClick={save}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </span>
      </footer>}
    </section>
  </div>;
}

function ItemRow({ item, content, earlier, listId, names, weightNames, preview, onChange, onMove, onRemove, onCreateMovement }) {
  const { load } = item;
  const name = item.movement ?? item.label;
  // A typed name that matches the catalog links the athlete's records; anything else stays free text.
  const setName = (text) => {
    const match = names.find((candidate) => candidate.toLowerCase() === text.trim().toLowerCase());
    onChange(match ? { movement: match, label: '' } : { movement: null, label: text });
  };
  const setLoad = (patch) => onChange({ load: { ...load, ...patch } });
  const setType = (type) => {
    if (type === 'percent') setLoad({ type, value: load.type === 'percent' ? load.value : 75, base: { kind: 'pr', movement: null, rm: 1 } });
    else setLoad({ type, value: type === 'weight' && load.type === 'weight' ? load.value : null, base: null });
  };
  const baseValue = load.base?.kind === 'item' ? `item:${load.base.itemId}` : `pr:${load.base?.rm ?? 1}`;
  const setBase = (value) => {
    const [kind, key] = value.split(':');
    setLoad({ base: kind === 'item' ? { kind: 'item', itemId: key } : { kind: 'pr', movement: load.base?.kind === 'pr' ? load.base.movement : null, rm: Number(key) } });
  };
  // Lines the athlete logs a weight on can be the base of a later percentage ("85 % of today's heavy single").
  const baseLines = earlier.filter((other) => other.log || other.load.type === 'max');
  const needsMovement = load.type === 'percent' && load.base.kind === 'pr' && !item.movement && !load.base.movement;

  return <div className="editor-item">
    <div className="editor-item-main">
      <input className="editor-move" list={listId} value={name} maxLength={LIMITS.label} placeholder="Movimiento o texto libre"
        aria-label="Movimiento" onChange={(event) => setName(event.target.value)} />
      <input className="editor-num" inputMode="numeric" value={item.sets ?? ''} placeholder="Series" aria-label="Series"
        onChange={(event) => onChange({ sets: /^\d{1,2}$/.test(event.target.value) && Number(event.target.value) > 0 ? Number(event.target.value) : null })} />
      <span aria-hidden="true">×</span>
      <input className="editor-num wide" value={item.reps} maxLength={LIMITS.reps} placeholder="Reps" aria-label="Repeticiones"
        onChange={(event) => onChange({ reps: event.target.value })} />
      <select aria-label="Tipo de carga" value={load.type} onChange={(event) => setType(event.target.value)}>
        {LOAD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {(load.type === 'weight' || load.type === 'percent') && <label className="editor-value">
        <input inputMode="decimal" value={load.value ?? ''} aria-label={load.type === 'weight' ? 'Peso en libras' : 'Porcentaje'}
          onChange={(event) => setLoad({ value: numberOrNull(event.target.value) })} />
        <span>{load.type === 'weight' ? 'lb' : '%'}</span>
      </label>}
      {load.type === 'percent' && <select aria-label="Base del porcentaje" value={baseValue} onChange={(event) => setBase(event.target.value)}>
        {BASE_RMS.map((rm) => <option key={rm} value={`pr:${rm}`}>de su {rm}RM</option>)}
        {baseLines.map((other) => <option key={other.id} value={`item:${other.id}`}>del peso de hoy en «{itemName(other)}»</option>)}
      </select>}
      {load.type === 'percent' && load.base.kind === 'pr' && <select aria-label="Movimiento base" value={load.base.movement ?? ''}
        onChange={(event) => setLoad({ base: { ...load.base, movement: event.target.value || null } })}>
        <option value="">del mismo movimiento</option>
        {weightNames.filter((candidate) => candidate !== item.movement).map((candidate) => <option key={candidate} value={candidate}>de {candidate}</option>)}
      </select>}
      <span className="editor-item-tools">
        <button type="button" className="icon-button" aria-label="Subir línea" onClick={() => onMove(-1)}><Icon name="arrowUp" /></button>
        <button type="button" className="icon-button" aria-label="Bajar línea" onClick={() => onMove(1)}><Icon name="arrowDown" /></button>
        <button type="button" className="icon-button danger" aria-label="Quitar línea" onClick={onRemove}><Icon name="xmark" /></button>
      </span>
    </div>
    <div className="editor-item-sub">
      <label className="editor-log">
        <Switch checked={item.log || load.type === 'max'} disabled={load.type === 'max'} label="El atleta anota peso y reps" onChange={(log) => onChange({ log })} />
        <span>El atleta anota peso y reps</span>
      </label>
      <input className="editor-note" value={item.notes} maxLength={LIMITS.notes} placeholder="Nota de la línea (tempo, descanso, RPE…)"
        aria-label="Nota de la línea" onChange={(event) => onChange({ notes: event.target.value })} />
    </div>
    {!item.movement && item.label.trim() && <p className="editor-hint">
      Texto libre: no se enlaza con los PRs.{' '}
      <button type="button" onClick={onCreateMovement}>Crear «{item.label.trim()}» como movimiento</button>
    </p>}
    {needsMovement && <p className="editor-hint warn">Un porcentaje necesita un movimiento del catálogo o un movimiento base.</p>}
    {preview && load.type === 'percent' && <p className="editor-hint">
      {preview.weight != null ? <>→ <b className="num">{preview.weight} lb</b> ({loadText(item, content)}, base {preview.base} lb)</>
        : preview.missing === 'pr' ? 'Este atleta todavía no tiene ese PR: verá el porcentaje y un aviso para registrarlo.'
          : 'Se calcula cuando el atleta anote la línea base.'}
    </p>}
  </div>;
}

/** What each athlete did in a saved session, with the private thread the coach can answer. */
function Results({ sessionId, content, focusAthleteId, api }) {
  const alert = useAlert();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    api.send(`/api/coach/sessions/${sessionId}`, 'GET').then((data) => { if (current) setDetail(data.session); })
      .catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [sessionId, api]);

  async function reply(athleteId, body) {
    try {
      const { comment } = await api.send(`/api/coach/sessions/${sessionId}/comments`, 'POST', { athleteId, body });
      setDetail((current) => ({ ...current, athletes: current.athletes.map((athlete) => (athlete.id === athleteId ? { ...athlete, comments: [...athlete.comments, comment] } : athlete)) }));
      return true;
    } catch (err) {
      await alert({ title: 'No se pudo enviar', message: err.message });
      return false;
    }
  }

  if (error) return <p className="field-error" role="alert">{error}</p>;
  if (!detail) return <p className="empty compact">Cargando…</p>;
  if (!detail.athletes.length) return <p className="empty">Todavía no hay atletas en este grupo.</p>;
  const items = allItems(content);
  // The athlete the coach came for goes first.
  const athletes = [...detail.athletes].sort((a, b) => Number(b.id === focusAthleteId) - Number(a.id === focusAthleteId));
  return athletes.map((athlete) => {
    const lines = items.filter((item) => athlete.results.items[item.id]);
    const scores = content.blocks.filter((block) => athlete.results.blocks[block.id]);
    return <section className="result-card" key={athlete.id}>
      <header>
        <h3>{athlete.name}</h3>
        <span className="result-state" data-done={Boolean(athlete.completedAt)}>{athlete.completedAt ? `Completada · ${clock(athlete.completedAt)}` : 'Sin completar'}</span>
      </header>
      {!lines.length && !scores.length && <p className="result-empty">Sin resultados anotados.</p>}
      {lines.map((item) => {
        const result = athlete.results.items[item.id];
        return <p className="result-line" key={item.id}>
          <span>{itemName(item)} <small>{volumeText(item)}</small></span>
          <b className="num">{[result.weight != null && `${result.weight} lb`, result.reps != null && `${result.reps} reps`].filter(Boolean).join(' × ')}</b>
        </p>;
      })}
      {scores.map((block) => <p className="result-line" key={block.id}>
        <span>{block.title || 'Resultado'}</span><b className="num">{formatValue(athlete.results.blocks[block.id].value, block.score)}</b>
      </p>)}
      {athlete.comments.map((comment) => <p key={comment.id} className="bubble" data-mine={comment.authorId !== athlete.id}>
        {comment.body}<small>{clock(comment.createdAt)}</small>
      </p>)}
      <ReplyForm onSend={(body) => reply(athlete.id, body)} name={athlete.name} />
    </section>;
  });
}

function ReplyForm({ onSend, name }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSending(true);
    if (await onSend(text.trim())) setText('');
    setSending(false);
  }
  return <form className="thread-form" onSubmit={submit}>
    <textarea rows={1} maxLength={LIMITS.comment} placeholder={`Comentario para ${name}…`} value={text} onChange={(event) => setText(event.target.value)} />
    <button className="pill-btn" disabled={sending || !text.trim()}>Enviar</button>
  </form>;
}
