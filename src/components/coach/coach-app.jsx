'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../../app/admin-request';
import { buildCatalog, setCatalog } from '../../lib/catalog';
import { clearCaches, useRefreshOnReturn, useStoredState } from '../hooks';
import { AlertProvider, useAlert } from '../ui/alert';
import Icon from '../ui/icon';
import { BellButton, NoticeSheet } from '../notifications';
import SignalLoader from '../ui/signal-loader';
import ActivityView from './activity-view';
import CalendarView from './calendar-view';
import PeopleView from './people-view';
import ProgressView from './progress-view';

const SECTIONS = [
  { value: 'calendar', label: 'Calendario', icon: 'calendar' },
  { value: 'progress', label: 'Progreso', icon: 'chart' },
  { value: 'people', label: 'Atletas', icon: 'people' },
  { value: 'activity', label: 'Actividad', icon: 'bolt' },
];
const shortDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
const clock = (value) => new Date(value).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const send = (url, method, body) => request(url, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });

export default function CoachApp({ userId }) {
  return <AlertProvider><Workspace userId={userId} /></AlertProvider>;
}

/** The coach's workspace: a sidebar on wide screens (tabs on phones) over calendar, people and activity. */
function Workspace({ userId }) {
  const alert = useAlert();
  const [prefs, updatePrefs, ready] = useStoredState(`prs_coach_${userId}`, { section: 'calendar', target: null, seenAt: 0 });
  const [overview, setOverview] = useState(null);
  const [movements, setMovements] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  // A session another screen asked the calendar to open, e.g. from the activity feed.
  const [focus, setFocus] = useState(null);
  const recordCache = useRef(new Map());
  // Athletes' comments for the bell; the server keeps what the coach already read.
  const [notices, setNotices] = useState([]);
  const [noticesOpen, setNoticesOpen] = useState(false);
  // Whether the session editor holds unsaved work, so opening a notice asks first.
  const editorDirty = useRef(false);

  const loadOverview = useCallback(async () => {
    try { setOverview(await request('/api/coach/overview')); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  const loadMovements = useCallback(async () => {
    try { setMovements((await request('/api/movements')).movements); } catch {}
  }, []);
  const loadActivity = useCallback(async () => {
    try { setEvents((await request('/api/coach/activity')).events); } catch {}
  }, []);
  const loadNotices = useCallback(async () => {
    try { setNotices((await request('/api/coach/notifications')).notifications); } catch {}
  }, []);
  useEffect(() => { loadOverview(); loadMovements(); loadActivity(); loadNotices(); }, [loadOverview, loadMovements, loadActivity, loadNotices]);
  useRefreshOnReturn(loadNotices, true);
  // Opening a session's results reads every thread in it.
  const markThreadsSeen = useCallback((sessionId) => {
    setNotices((current) => current.map((notice) => (notice.sessionId === sessionId ? { ...notice, unread: false } : notice)));
    send('/api/coach/notifications', 'PUT', { sessionId }).catch(() => {});
  }, []);
  const setEditorDirty = useCallback((dirty) => { editorDirty.current = dirty; }, []);

  // The editor resolves movement types through the shared catalog helpers.
  const catalog = useMemo(() => (movements.length ? buildCatalog(movements) : null), [movements]);
  setCatalog(catalog);

  // An athlete's records, read once per visit to preview their loads.
  const recordsOf = useCallback(async (athleteId) => {
    if (!recordCache.current.has(athleteId)) {
      recordCache.current.set(athleteId, request(`/api/coach/athletes/${athleteId}`).then((data) => data.records)
        .catch((err) => { recordCache.current.delete(athleteId); throw err; }));
    }
    return recordCache.current.get(athleteId);
  }, []);

  // The stored target may be gone (an archived group, an athlete who left): fall back to the first one.
  const target = useMemo(() => {
    if (!overview) return null;
    const stored = prefs.target;
    if (stored?.kind === 'group' && overview.groups.some((group) => group.id === stored.id)) return stored;
    if (stored?.kind === 'athlete' && overview.athletes.some((athlete) => athlete.id === stored.id)) return stored;
    if (overview.groups[0]) return { kind: 'group', id: overview.groups[0].id };
    return overview.athletes[0] ? { kind: 'athlete', id: overview.athletes[0].id } : null;
  }, [overview, prefs.target]);

  const unseen = events.filter((event) => new Date(event.at).getTime() > prefs.seenAt).length;
  const go = (section) => {
    // A session opened from elsewhere is not opened again when the calendar comes back.
    setFocus(null);
    updatePrefs({ section, ...(section === 'activity' ? { seenAt: Date.now() } : {}) });
    if (section === 'activity') loadActivity();
  };
  const openSession = (event) => {
    const { session } = event;
    updatePrefs({ section: 'calendar', target: session.groupId ? { kind: 'group', id: session.groupId } : { kind: 'athlete', id: session.athleteId } });
    setFocus({ date: session.date, athleteId: event.athleteId, key: Date.now() });
  };
  const openNotices = () => { setNoticesOpen(true); loadNotices(); };
  async function openNotice(notice) {
    setNoticesOpen(false);
    if (editorDirty.current && !(await alert({
      title: '¿Salir sin guardar?', message: 'Los cambios de la sesión que estás editando se perderán.',
      actions: [{ label: 'Seguir editando', role: 'cancel' }, { label: 'Salir', role: 'destructive', value: true }],
    }))) return;
    updatePrefs({ section: 'calendar', target: notice.groupId ? { kind: 'group', id: notice.groupId } : { kind: 'athlete', id: notice.athleteId } });
    setFocus({ date: notice.date, athleteId: notice.athleteId, key: Date.now() });
  }
  const unread = notices.filter((notice) => notice.unread).length;
  const bell = (place) => <BellButton count={unread} onClick={openNotices} className={place} />;

  // Stable, so the screens below do not reload their data every time this one renders.
  const api = useMemo(() => ({ send, recordsOf, reloadOverview: loadOverview, reloadMovements: loadMovements, markThreadsSeen }),
    [recordsOf, loadOverview, loadMovements, markThreadsSeen]);
  if (!ready || (!overview && !error)) return <SignalLoader />;

  return <div className="coach">
    <aside className="coach-side">
      <div className="coach-brand-row">
        <p className="coach-brand display">Coach</p>
        {bell('coach-bell')}
      </div>
      <nav className="coach-nav" aria-label="Secciones">
        {SECTIONS.map((section) => <button type="button" key={section.value} aria-current={prefs.section === section.value ? 'page' : undefined} onClick={() => go(section.value)}>
          <Icon name={section.icon} /><span>{section.label}</span>
          {section.value === 'activity' && unseen > 0 && prefs.section !== 'activity' && <i className="coach-count num">{unseen}</i>}
        </button>)}
      </nav>
      <Link className="coach-exit" href="/app?personal=1"><Icon name="barbell" /><span>Mi entrenamiento</span></Link>
      <form className="coach-logout" action="/auth/logout" method="post" onSubmit={clearCaches}>
        <button className="coach-exit"><Icon name="logout" /><span>Cerrar sesión</span></button>
      </form>
    </aside>
    <main className="coach-main">
      {/* On phones the sidebar is a bottom bar, so the bell sits at the top of the page. */}
      <div className="coach-topbar">{bell('coach-bell')}</div>
      {error && <div className="banner warn" role="alert"><span>{error}</span><button type="button" className="pill-btn" onClick={loadOverview}>Reintentar</button></div>}
      {overview && prefs.section === 'calendar' && <CalendarView overview={overview} movements={movements} target={target} focus={focus}
        onTarget={(next) => updatePrefs({ target: next })} onPeople={() => go('people')} onDirty={setEditorDirty} api={api} />}
      {overview && prefs.section === 'progress' && <ProgressView api={api} onPeople={() => go('people')} />}
      {overview && prefs.section === 'people' && <PeopleView overview={overview} api={api} />}
      {overview && prefs.section === 'activity' && <ActivityView events={events} onOpen={openSession} onReload={loadActivity} />}
    </main>
    <NoticeSheet open={noticesOpen} onClose={() => setNoticesOpen(false)} onOpen={openNotice}
      empty="Aquí verás los comentarios que tus atletas te dejen en sus sesiones. Se muestran los últimos 30 días."
      notices={notices.map((notice) => ({
        ...notice, heading: notice.athleteName, time: clock(notice.createdAt),
        context: `Sesión del ${shortDate(notice.date)}${notice.title ? ` · ${notice.title}` : ''}`,
      }))} />
  </div>;
}
