'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { today } from '../../lib/catalog';
import { addDays, addMonths, allItems, cloneContent, itemName, monthWeeks, weekDays } from '../../lib/training';
import { useAlert } from '../ui/alert';
import Icon from '../ui/icon';
import Skeleton from '../ui/skeleton';
import SessionEditor from './session-editor';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Sessions take one block color per weekday, so a week reads as distinct days at a glance.
const DAY_COLORS = ['--b-blue', '--b-pink', '--b-green', '--b-yellow', '--b-lilac', '--b-cyan', '--b-coral'];
const monthLabel = (month) => new Date(`${month}-15T12:00`).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
const shortDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });

// What a day's card lists: block titles, or the lines of an untitled block.
function summary(session) {
  return session.content.blocks.flatMap((block) => (block.title ? [block.title] : block.items.map(itemName))).slice(0, 4);
}

/** Month calendar of one group or athlete: open a day to program it, copy and paste days or whole weeks. */
export default function CalendarView({ overview, movements, target, focus, onTarget, onPeople, onDirty, api }) {
  const alert = useAlert();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  // Which target and month the sessions on hand belong to. The editor waits for them, so a day opened from
  // elsewhere shows what it already has, and the days hold placeholders instead of their actions meanwhile.
  const [loadedFor, setLoadedFor] = useState(null);
  const request = useRef(0);
  const [editing, setEditing] = useState(null);     // { date, tab?, athleteId?, key? }
  const [clipboard, setClipboard] = useState(null); // { kind: 'day', date, session } | { kind: 'week', monday, sessions }
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const from = weeks[0];
  const to = addDays(weeks.at(-1), 6);
  const query = target && `${target.kind}=${target.id}&from=${from}&to=${to}`;
  const loaded = Boolean(query) && loadedFor === query;

  // Only the answer for the target and month on screen is kept, whatever order the answers arrive in.
  const load = useCallback(async () => {
    if (!query) return;
    const id = ++request.current;
    try {
      const { sessions: list } = await api.send(`/api/coach/sessions?${query}`, 'GET');
      if (id !== request.current) return;
      setSessions(list);
      setError('');
      setLoadedFor(query);
    } catch (err) { if (id === request.current) setError(err.message); }
  }, [api, query]);
  useEffect(() => { load(); }, [load]);

  // Another screen asked for a session: show its month and open it on the results.
  useEffect(() => {
    if (!focus) return;
    setMonth(focus.date.slice(0, 7));
    // The key opens the editor afresh even when that day is already open, so it lands on the results.
    setEditing({ date: focus.date, tab: 'results', athleteId: focus.athleteId, key: focus.key });
  }, [focus]);

  const byDate = useMemo(() => new Map((loaded ? sessions : []).map((session) => [session.date, session])), [loaded, sessions]);
  const group = target?.kind === 'group' ? overview.groups.find((candidate) => candidate.id === target.id) : null;
  const athletes = !target ? [] : group
    ? overview.athletes.filter((athlete) => group.memberIds.includes(athlete.id))
    : overview.athletes.filter((athlete) => athlete.id === target.id);
  const targetName = group ? `Grupo ${group.name}` : athletes[0]?.name ?? '';
  const now = today();

  async function put(date, source) {
    const { session } = await api.send('/api/coach/sessions', 'PUT', {
      target: target.kind === 'group' ? { groupId: target.id } : { athleteId: target.id },
      date, title: source.title, notes: source.notes, content: source.content, published: source.published,
    });
    setSessions((current) => [...current.filter((other) => other.date !== date), session]);
    return session;
  }

  // Pasting over existing days replaces them; athletes' logged results are kept either way.
  async function paste(entries) {
    const replaced = entries.filter(({ date }) => byDate.has(date));
    if (replaced.length) {
      const logged = replaced.some(({ date }) => byDate.get(date).logged > 0);
      const confirmed = await alert({
        title: replaced.length === 1 ? `¿Reemplazar la sesión del ${shortDate(replaced[0].date)}?` : `¿Reemplazar ${replaced.length} sesiones?`,
        message: logged ? 'Hay atletas con resultados en ellas; sus registros se conservan.' : 'La programación actual de esos días se pierde.',
        actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Reemplazar', role: 'destructive', value: true }],
      });
      if (!confirmed) return;
    }
    try {
      for (const { date, session } of entries) await put(date, { ...session, content: cloneContent(session.content) });
    } catch (err) {
      await alert({ title: 'No se pudo pegar', message: err.message });
      load();
    }
  }
  const pasteDay = (date) => paste([{ date, session: clipboard.session }]);
  const pasteWeek = (monday) => paste(clipboard.sessions.map((session) => ({
    date: addDays(monday, (new Date(`${session.date}T00:00:00Z`) - new Date(`${clipboard.monday}T00:00:00Z`)) / 86400000), session,
  })));

  async function remove(session) {
    await api.send(`/api/coach/sessions/${session.id}`, 'DELETE');
    setSessions((current) => current.filter((other) => other.id !== session.id));
    setEditing(null);
  }

  if (!target) {
    return <section className="coach-empty">
      <h1 className="display">Calendario</h1>
      <p>Para programar necesitas al menos un grupo o un atleta. Crea un grupo y comparte su código, o invita a alguien con un link personal.</p>
      <button type="button" className="pill-btn" onClick={onPeople}><Icon name="people" />Ir a Atletas</button>
    </section>;
  }

  const editingSession = editing && byDate.get(editing.date);
  // Programming a day takes the whole page; the calendar comes back when it closes.
  if (editing && loaded) {
    return <SessionEditor key={`${target.id}:${editing.date}:${editing.key ?? ''}`} date={editing.date} session={editingSession} targetName={targetName} group={group}
      athletes={athletes} movements={movements} initialTab={editing.tab} focusAthleteId={editing.athleteId} api={api} onDirty={onDirty}
      onSave={(draft) => put(editing.date, draft)} onDelete={() => remove(editingSession)}
      onCopy={() => { setClipboard({ kind: 'day', date: editing.date, session: editingSession }); setEditing(null); }}
      onClose={() => setEditing(null)} />;
  }
  return <>
    <header className="coach-head">
      <h1 className="display">{monthLabel(month)}</h1>
      <div className="coach-head-tools">
        <label className="target-select">
          <span>Programar para</span>
          <select value={`${target.kind}:${target.id}`} onChange={(event) => { const [kind, id] = event.target.value.split(':'); onTarget({ kind, id }); }}>
            {overview.groups.length > 0 && <optgroup label="Grupos">
              {overview.groups.map((candidate) => <option key={candidate.id} value={`group:${candidate.id}`}>{candidate.name} · {candidate.memberIds.length}</option>)}
            </optgroup>}
            {overview.athletes.length > 0 && <optgroup label="Atletas (plan individual)">
              {overview.athletes.map((athlete) => <option key={athlete.id} value={`athlete:${athlete.id}`}>{athlete.name}</option>)}
            </optgroup>}
          </select>
        </label>
        <button type="button" className="pill-btn program-today" onClick={() => { setMonth(now.slice(0, 7)); setEditing({ date: now }); }}>
          <Icon name="pencil" />{byDate.has(now) && month === now.slice(0, 7) ? 'Editar hoy' : 'Programar hoy'}
        </button>
        <span className="month-nav">
          <button type="button" className="icon-button" aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronLeft" weight={2.6} /></button>
          <button type="button" className="nav-text" disabled={month === now.slice(0, 7)} onClick={() => setMonth(now.slice(0, 7))}>Hoy</button>
          <button type="button" className="icon-button" aria-label="Mes siguiente" onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronRight" weight={2.6} /></button>
        </span>
      </div>
    </header>
    {error && <div className="banner warn" role="alert"><span>{error}</span><button type="button" className="pill-btn" onClick={load}>Reintentar</button></div>}
    <p className="coach-lead">Programas para <b>{targetName}</b>. Elige un día del calendario para escribir su sesión.</p>
    {clipboard && <p className="clipboard" role="status">
      <Icon name="check" weight={3} />
      {clipboard.kind === 'day' ? `Día ${shortDate(clipboard.date)} copiado: elige «Pegar» en otro día.` : `Semana del ${shortDate(clipboard.monday)} copiada: elige «Pegar semana» en otra.`}
      <button type="button" className="tinted-button small" onClick={() => setClipboard(null)}>Soltar</button>
    </p>}

    <div className="calendar" aria-busy={!loaded} style={group ? { '--b': `var(${group.color})` } : undefined}>
      {!loaded && <span className="visually-hidden" role="status">Cargando el calendario</span>}
      <div className="cal-names" aria-hidden="true">{DAY_NAMES.map((name) => <span key={name}>{name}</span>)}</div>
      {weeks.map((monday) => {
        const days = weekDays(monday);
        const inWeek = days.map((date) => byDate.get(date)).filter(Boolean);
        return <div className="cal-week" key={monday}>
          <div className="cal-week-tools">
            <span>Semana del {shortDate(monday)}</span>
            {loaded && inWeek.length > 0 && <button type="button" className="tinted-button small" onClick={() => setClipboard({ kind: 'week', monday, sessions: inWeek })}>Copiar semana</button>}
            {loaded && clipboard?.kind === 'week' && clipboard.monday !== monday && <button type="button" className="tinted-button small" onClick={() => pasteWeek(monday)}>Pegar semana</button>}
          </div>
          {days.map((date, index) => {
            const session = byDate.get(date);
            const lines = session ? summary(session) : [];
            const day = <span className="cal-day"><small>{DAY_NAMES[index]}</small><b className="num">{Number(date.slice(8))}</b></span>;
            if (!loaded) {
              return <div className="cal-cell" key={date} data-out={date.slice(0, 7) !== month} data-today={date === now}>
                <header>{day}</header>
                <Skeleton />
              </div>;
            }
            return <div className="cal-cell" key={date} data-out={date.slice(0, 7) !== month} data-today={date === now}>
              <header>
                {day}
                {session && <button type="button" className="cal-tool" onClick={() => setClipboard({ kind: 'day', date, session })}>Copiar</button>}
                {clipboard?.kind === 'day' && clipboard.date !== date && <button type="button" className="cal-tool" onClick={() => pasteDay(date)}>Pegar</button>}
              </header>
              {session ? <button type="button" className="cal-session" data-draft={!session.published} style={{ '--b': `var(${DAY_COLORS[index]})` }} onClick={() => setEditing({ date })}>
                <b>{session.title || 'Sesión'}</b>
                {lines.map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}
                {allItems(session.content).length === 0 && !lines.length && session.notes && <span>{session.notes}</span>}
                <em>{session.published ? (athletes.length ? `${session.completed}/${athletes.length} completaron` : 'Visible') : 'Oculta'}</em>
              </button> : <button type="button" className="cal-add" aria-label={`Programar el ${shortDate(date)}`} onClick={() => setEditing({ date })}>
                <Icon name="plus" weight={2.6} /><span>Programar</span>
              </button>}
            </div>;
          })}
        </div>;
      })}
    </div>

  </>;
}
