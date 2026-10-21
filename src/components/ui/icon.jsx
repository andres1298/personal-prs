// SF Symbols–style glyphs drawn on a 24 pt grid. `fill` variants are used for
// selected tab bar items, as iOS does.

const STROKE = {
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  trophy: <><path d="M8 21h8M12 17v4M7 3.5h10V9a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2M9.5 2.5h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="m15 4.5-7.5 7.5 7.5 7.5" />,
  chevronRight: <path d="m9 4.5 7.5 7.5L9 19.5" />,
  chevronDown: <path d="m4.5 9 7.5 7.5L19.5 9" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  pencil: <><path d="M13 20h8" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  xmark: <path d="M6 6l12 12M18 6 6 18" />,
  number: <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />,
  barbell: <path d="M6.5 6v12M3 9v6M17.5 6v12M21 9v6M6.5 12h11" />,
  flame: <path d="M12 21.5c3.9 0 6.5-2.6 6.5-6.3 0-3.4-2.4-5.6-4-8.2-.5 2-1.6 3.1-2.7 3.5C12.2 7.4 10.9 4.6 8.5 2.5c.3 3.4-3 6.3-3 11 0 4.4 2.6 8 6.5 8z" />,
  arrowUpRight: <path d="M7 17 17 7M8.5 7H17v8.5" />,
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  stop: <rect x="5.5" y="5.5" width="13" height="13" rx="2" />,
  flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  simple: <><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M8 12h8" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.3A6.5 6.5 0 0 1 21.5 20" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  chart: <path d="M4 20V4M4 20h16M8 15l3.5-4 3 2.5L20 7" />,
  sparkles: <path d="M10 3.5 11.6 8.4 16.5 10l-4.9 1.6L10 16.5 8.4 11.6 3.5 10l4.9-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3.5 7.5 8.5 6 8.5-6" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>,
};

const FILL = {
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" fill="currentColor" />,
  trophy: <><path d="M8 21h8M12 17v4M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /><path d="M7 3.5h10V9a5 5 0 0 1-10 0z" fill="currentColor" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" fill="currentColor" /><path d="M9.5 2.5h5" /><path d="M12 9.5v4l2.5 2" stroke="var(--icon-knockout, #000)" /></>,
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />,
  stop: <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" />,
  flame: <path d="M12 21.5c3.9 0 6.5-2.6 6.5-6.3 0-3.4-2.4-5.6-4-8.2-.5 2-1.6 3.1-2.7 3.5C12.2 7.4 10.9 4.6 8.5 2.5c.3 3.4-3 6.3-3 11 0 4.4 2.6 8 6.5 8z" fill="currentColor" />,
};

export default function Icon({ name, fill = false, size, weight = 2, className, style }) {
  const glyph = (fill && FILL[name]) || STROKE[name];
  return <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round"
    width={size} height={size} className={className} style={style} aria-hidden="true" focusable="false"
  >{glyph}</svg>;
}
