'use client';

import Icon from './ui/icon';
import Sheet from './ui/sheet';

/** The bell that opens the comments list; the badge counts the ones not read yet. */
export function BellButton({ count, onClick, className = '' }) {
  return <button type="button" className={`bell-button ${className}`} onClick={onClick}
    aria-label={count > 0 ? `Comentarios: ${count} ${count === 1 ? 'nuevo' : 'nuevos'}` : 'Comentarios'}>
    <Icon name="bell" weight={2.2} />
    {count > 0 && <i className="bell-count num" aria-hidden="true">{count > 99 ? '99+' : count}</i>}
  </button>;
}

/**
 * Recent comments, newest first: who wrote, on which session, the text and when. New ones carry a
 * dot; read ones stay listed, dimmed. Tapping one hands it to `onOpen`.
 * notices: [{ id, unread, heading, context, body, time, ...whatever onOpen needs }]
 */
export function NoticeSheet({ open, onClose, notices, empty, onOpen }) {
  return <Sheet open={open} onClose={onClose} title="Comentarios"
    trailing={<button type="button" className="nav-text strong" onClick={onClose}>Listo</button>}>
    {!notices.length && <p className="empty">{empty}</p>}
    <div className="notice-list">
      {notices.map((notice) => <button type="button" key={notice.id} className="notice-row" data-unread={notice.unread} onClick={() => onOpen(notice)}>
        <i className="notice-dot" aria-hidden="true" />
        <span className="notice-text">
          <b>{notice.unread && <span className="visually-hidden">Nuevo: </span>}{notice.heading}</b>
          <small>{notice.context}</small>
          <span className="notice-body">{notice.body}</span>
          <small>{notice.time}</small>
        </span>
        <Icon name="chevronRight" className="row-chevron" weight={2.4} />
      </button>)}
    </div>
  </Sheet>;
}
