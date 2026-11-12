'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../../app/admin-request';
import { buildCatalog, setCatalog } from '../../lib/catalog';
import { clearCaches, useStoredState } from '../hooks';
import { AlertProvider } from '../ui/alert';
import Icon from '../ui/icon';
import SignalLoader from '../ui/signal-loader';
import ActivityView from './activity-view';
import CalendarView from './calendar-view';
import PeopleView from './people-view';

const SECTIONS = [
  { value: 'calendar', label: 'Calendario', icon: 'calendar' },
  { value: 'people', label: 'Atletas', icon: 'people' },
  { value: 'activity', label: 'Actividad', icon: 'bolt' },
];
const send = (url, method, body) => request(url, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });

export default function CoachApp({ userId }) {
  return <AlertProvider><Workspace userId={userId} /></AlertProvider>;
}

/** The coach's workspace: a sidebar on wide screens (tabs on phones) over calendar, people and activity. */
function Workspace({ userId }) {
  const [prefs, updatePrefs, ready] = useStoredState(`prs_coach_${userId}`, { section: 'calendar', target: null, seenAt: 0 });
  const [overview, setOverview] = useState(null);
  const [movements, setMovements] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  // A session another screen asked the calendar to open, e.g. from the activity feed.
  const [focus, setFocus] = useState(null);
  const recordCache = useRef(new Map());

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
  useEffect(() => { loadOverview(); loadMovements(); loadActivity(); }, [loadOverview, loadMovements, loadActivity]);

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
    updatePrefs({ section, ...(section === 'activity' ? { seenAt: Date.now() } : {}) });
    if (section === 'activity') loadActivity();
  };
  const openSession = (event) => {
    const { session } = event;
    updatePrefs({ section: 'calendar', target: session.groupId ? { kind: 'group', id: session.groupId } : { kind: 'athlete', id: session.athleteId } });
    setFocus({ date: session.date, athleteId: event.athleteId, key: Date.now() });
  };

  if (!ready || (!overview && !error)) return <SignalLoader />;
  const api = { send, recordsOf, reloadOverview: loadOverview, reloadMovements: loadMovements };

  return <div className="coach">
    <aside className="coach-side">
      <p className="coach-brand display">Coach</p>
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
      {error && <div className="banner warn" role="alert"><span>{error}</span><button type="button" className="pill-btn" onClick={loadOverview}>Reintentar</button></div>}
      {overview && prefs.section === 'calendar' && <CalendarView overview={overview} movements={movements} target={target} focus={focus}
        onTarget={(next) => updatePrefs({ target: next })} onPeople={() => go('people')} api={api} />}
      {overview && prefs.section === 'people' && <PeopleView overview={overview} api={api} />}
      {overview && prefs.section === 'activity' && <ActivityView events={events} onOpen={openSession} onReload={loadActivity} />}
    </main>
  </div>;
}
