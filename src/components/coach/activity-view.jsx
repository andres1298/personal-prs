'use client';

import Icon from '../ui/icon';

const clock = (value) => new Date(value).toLocaleString('es-CR', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const shortDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });

/** What athletes did in the last two weeks: sessions they finished and comments they left. */
export default function ActivityView({ events, onOpen, onReload }) {
  return <>
    <header className="coach-head">
      <h1 className="display">Actividad</h1>
      <div className="coach-head-tools"><button type="button" className="nav-text" onClick={onReload}>Actualizar</button></div>
    </header>
    {!events.length && <p className="coach-empty-note">Aquí verás cuando tus atletas completen una sesión o te dejen un comentario. Se muestran los últimos 14 días.</p>}
    <div className="feed">
      {events.map((event, index) => <button type="button" className="feed-row" key={index} onClick={() => onOpen(event)}>
        <span className="tile" style={{ '--c': `var(${event.kind === 'completed' ? '--b-green' : '--b-yellow'})` }}><Icon name={event.kind === 'completed' ? 'check' : 'mail'} weight={2.6} /></span>
        <span className="feed-text">
          <b>{event.athleteName} {event.kind === 'completed' ? 'completó' : 'comentó en'} {event.session.title || 'la sesión'} del {shortDate(event.session.date)}</b>
          {event.body && <span>«{event.body}»</span>}
          <small>{clock(event.at)}</small>
        </span>
        <Icon name="chevronRight" className="row-chevron" weight={2.4} />
      </button>)}
    </div>
  </>;
}
