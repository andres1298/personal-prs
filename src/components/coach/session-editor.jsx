'use client';

import { useEffect, useMemo, useState } from 'react';
import { bestRecord, formatValue, moveInfo } from '../../lib/catalog';
import {
  allItems, itemName, LIMITS, newBlock, newItem, resolveLoad, volumeText,
} from '../../lib/training';
import { useAlert } from '../ui/alert';
import { SegmentedControl, Switch } from '../ui/controls';
import Icon from '../ui/icon';
import LineEditor, { Choice, DEFAULT_LOAD } from './line-editor';
import { blockColor, PlanPreview } from '../plan/plan-view';
import BlockTimer from './block-timer';
import { normalizeConfig } from '../../lib/timer-engine';
import { TEMPLATES } from '../timer/timer-views';

const SCORE_OPTIONS = [{ value: 'none', label: 'Nada' }, { value: 'time', label: 'Tiempo' }, { value: 'reps', label: 'Repeticiones' }, { value: 'weight', label: 'Peso' }];
const WOD_TYPES = ['amrap', 'emom', 'fortime', 'tabata'];
const letter = (index) => String.fromCharCode(65 + index);
const longDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const clock = (value) => new Date(value).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function swap(list, index, direction) {
  const next = [...list];
  const other = index + direction;
  if (other < 0 || other >= next.length) return list;
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

/**
 * Full page to program one day for one target and to read what athletes did. "Previsualizar"
 * shows the day as the athlete's phone would, next to the form on a wide screen and instead of it
 * on a narrow one. Saving replaces the day's session; results already logged stay as written.
 */
export default function SessionEditor({ date, session, targetName, group, athletes, movements, initialTab, focusAthleteId, api, onSave, onDelete, onCopy, onClose }) {
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
  // One line is open for editing at a time; the rest read as a summary.
  const [openId, setOpenId] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  // Leaving the site with unsaved work asks first, as leaving the page does.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
    // So are the parts of a complex that never got their movement.
    const content = { blocks: draft.content.blocks.map((block) => ({
      ...block,
      items: block.items.filter((item) => item.movement || item.label.trim())
        .map((item) => (item.parts ? { ...item, parts: item.parts.filter((part) => part.movement) } : item)),
    })) };
    const incomplete = content.blocks.flatMap((block) => block.items).find((item) => ['weight', 'percent'].includes(item.load.type) && !(item.load.value > 0));
    if (incomplete) {
      await alert({ title: 'Falta una carga', message: `Escribe ${incomplete.load.type === 'percent' ? 'el porcentaje' : 'el peso'} de «${itemName(incomplete)}» o cambia su tipo de carga.` });
      return;
    }
    const baseless = content.blocks.flatMap((block) => block.items)
      .find((item) => item.load.type === 'percent' && item.load.base.kind === 'pr' && !item.movement && !item.load.base.movement);
    if (baseless) {
      await alert({ title: 'Falta la base del porcentaje', message: `«${itemName(baseless)}» no tiene récord propio. Elige de qué movimiento se calcula su porcentaje, o cambia su tipo de carga.` });
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

  // A new line opens right away, ready to pick its movement.
  function addLine(block) {
    const item = newItem({ load: DEFAULT_LOAD });
    patchBlock(block.id, { items: [...block.items, item] });
    setOpenId(item.id);
  }
  function addStrengthBlock() {
    const item = newItem({ load: DEFAULT_LOAD });
    setBlocks((blocks) => [...blocks, newBlock({ items: [item] })]);
    setOpenId(item.id);
  }

  // A WOD starts from its kind: the clock comes configured and the score follows it.
  const full = draft.content.blocks.length >= LIMITS.blocks;
  const addWod = (type) => setBlocks((blocks) => [...blocks, newBlock({
    title: TEMPLATES[type].name, timer: normalizeConfig({ type }), score: { amrap: 'reps', fortime: 'time' }[type] ?? 'none',
  })]);

  const earlier = [];
  // What the athlete would get if the day were saved now: lines without a name are left out.
  const previewSession = {
    id: 'preview', date, title: draft.title, notes: draft.notes, group: group ? { name: group.name, color: group.color } : null,
    content: { blocks: draft.content.blocks.map((block) => ({ ...block, items: block.items.filter((item) => item.movement || item.label.trim()) })) },
    results: { items: {}, blocks: {} }, completedAt: null, comments: [], unread: 0,
  };
  const previewName = athletes.find((athlete) => athlete.id === previewId)?.name;
  const canPreview = tab === 'program';

  return <div className="editor-page" data-preview={previewing && canPreview}>
    <section className="editor-main" aria-label={`Sesión del ${longDate(date)}`}>
      <header className="editor-head">
        <button type="button" className="nav-back" onClick={close}><Icon name="chevronLeft" weight={2.8} /><span>Calendario</span></button>
        <div className="editor-head-title">
          <p className="drawer-kicker">{targetName}</p>
          <h1 className="display">{longDate(date)}</h1>
        </div>
        {canPreview && <button type="button" className="nav-text preview-toggle" aria-pressed={previewing} onClick={() => setPreviewing(!previewing)}>
          <Icon name="person" />{previewing ? 'Ocultar vista previa' : 'Previsualizar'}
        </button>}
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

        {draft.content.blocks.map((block, blockIndex) => {
          const rows = block.items.map((item) => {
            const row = <LineEditor key={item.id} item={item} content={draft.content} earlier={[...earlier]} weightNames={weightNames}
              preview={previewId ? resolveLoad(item, null, bestOf) : null} open={openId === item.id}
              onOpen={() => setOpenId(item.id)} onClose={() => setOpenId(null)}
              onChange={(patch) => patchItem(block.id, item.id, patch)}
              onMove={(direction) => patchBlock(block.id, { items: swap(block.items, block.items.indexOf(item), direction) })}
              onRemove={() => patchBlock(block.id, { items: block.items.filter((other) => other.id !== item.id) })}
              onCreateMovement={() => createMovement(block.id, item)} />;
            earlier.push(item);
            return row;
          });
          return <section className="editor-block" key={block.id} style={{ '--b': `var(${blockColor(block)})` }}>
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
            <BlockTimer timer={block.timer} onChange={(timer) => patchBlock(block.id, { timer: timer ?? undefined })} />
            {rows}
            <footer className="editor-block-foot">
              <button type="button" className="tinted-button" disabled={block.items.length >= LIMITS.items}
                onClick={() => addLine(block)}><Icon name="plus" weight={2.8} />Agregar línea</button>
              <div className="block-score">
                <span className="line-label">Al terminar el bloque, el atleta anota</span>
                <Choice label="Resultado del bloque" size="small" options={SCORE_OPTIONS} value={block.score} onChange={(score) => patchBlock(block.id, { score })} />
              </div>
            </footer>
          </section>;
        })}
        <div className="editor-add">
          <span className="line-label">Agregar bloque</span>
          <div>
            <button type="button" className="tinted-button" disabled={full} onClick={addStrengthBlock}><Icon name="barbell" />Fuerza</button>
            {WOD_TYPES.map((type) => <button type="button" key={type} className="tinted-button wod" disabled={full} style={{ '--c': `var(${TEMPLATES[type].color})` }}
              onClick={() => addWod(type)}><i aria-hidden="true">{TEMPLATES[type].icon}</i>{TEMPLATES[type].name}</button>)}
            <button type="button" className="tinted-button" disabled={full} onClick={() => setBlocks((blocks) => [...blocks, newBlock()])}><Icon name="pencil" />Texto libre</button>
          </div>
        </div>
      </>}

      {tab === 'program' && <footer className="editor-foot">
        <label className="editor-publish">
          <Switch checked={draft.published} label="Publicada" onChange={(published) => change({ published })} />
          <span>{draft.published ? 'Publicada: tus atletas la ven' : 'Borrador: solo tú la ves'}</span>
        </label>
        <span className="editor-foot-actions">
          {session && <button type="button" className="nav-text danger" onClick={remove}>Borrar</button>}
          {session && <button type="button" className="nav-text" disabled={dirty} title={dirty ? 'Guarda antes de copiar' : undefined} onClick={onCopy}>Copiar día</button>}
          <button type="button" className="nav-text strong" disabled={saving || (!dirty && Boolean(session))} onClick={save}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </span>
      </footer>}
    </section>

    {previewing && canPreview && <aside className="editor-aside" aria-label="Vista previa">
      <div className="preview-bar">
        <p><b>Así lo verá {previewName ?? 'un atleta sin PRs registrados'}</b>{dirty ? ' · incluye lo que aún no guardas' : ''}</p>
        <button type="button" className="nav-text preview-close" onClick={() => setPreviewing(false)}>Volver a editar</button>
      </div>
      <div className="phone">
        <PlanPreview session={previewSession} records={previewRecords ?? []} />
      </div>
      {!draft.published && <p className="line-hint">Es un borrador: tus atletas no lo ven hasta que lo publiques.</p>}
    </aside>}
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
