'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const EXIT_MS = 420;
const DISMISS_DISTANCE = 110;
let openSheets = 0;

/**
 * While a modal layer is up, the page behind stops scrolling and everything
 * else in <body> becomes inert, so focus and screen readers stay in the layer.
 */
export function useModalLayer(active, layer) {
  useEffect(() => {
    if (!active || !layer.current) return undefined;
    openSheets += 1;
    document.documentElement.classList.add('sheet-open');
    const silenced = [...document.body.children].filter((node) => node !== layer.current && !node.inert && node.tagName !== 'SCRIPT');
    silenced.forEach((node) => { node.inert = true; });
    return () => {
      silenced.forEach((node) => { node.inert = false; });
      openSheets -= 1;
      if (!openSheets) document.documentElement.classList.remove('sheet-open');
    };
  }, [active, layer]);
}

// Mounts while open and through the exit animation.
export function usePresence(open, exitMs = EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames so the entering state paints before transitioning.
      let second;
      const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setShown(true)); });
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    }
    setShown(false);
    const timeout = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timeout);
  }, [open, exitMs]);
  return { mounted, shown };
}

/**
 * iOS page sheet: grabber, rounded top corners, dimmed backdrop and
 * swipe-down to dismiss from the header.
 */
export default function Sheet({ open, onClose, title, leading, trailing, children, className = '', tone, layer = 0 }) {
  const { mounted, shown } = usePresence(open);
  const root = useRef(null);
  const panel = useRef(null);
  const drag = useRef(null);
  const titleId = useId();
  useModalLayer(mounted && open, root);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => { if (shown) panel.current?.focus({ preventScroll: true }); }, [shown]);

  function onPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button, a, input, select, textarea')) return;
    drag.current = { y: event.clientY, t: event.timeStamp, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.current.style.transition = 'none';
  }
  function onPointerMove(event) {
    if (!drag.current) return;
    const dy = event.clientY - drag.current.y;
    // Rubber-band upward pulls, follow the finger downward.
    drag.current.dy = dy;
    panel.current.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
  }
  function onPointerUp(event) {
    if (!drag.current) return;
    const { dy, t } = drag.current;
    const velocity = dy / Math.max(1, event.timeStamp - t);
    drag.current = null;
    panel.current.style.transition = '';
    panel.current.style.transform = '';
    if (dy > DISMISS_DISTANCE || (dy > 30 && velocity > 0.6)) onClose?.();
  }

  if (!mounted) return null;
  return createPortal(<div ref={root} className="sheet-root" data-state={shown ? 'open' : 'closed'} style={{ '--layer': layer }}>
    <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
    <div
      ref={panel} className={`sheet ${className}`} role="dialog" aria-modal="true"
      aria-labelledby={title ? titleId : undefined} tabIndex={-1} data-tone={tone}
    >
      <header
        className="sheet-header" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-bar">
          <div className="sheet-bar-side">{leading}</div>
          <h2 className="sheet-title" id={titleId}>{title}</h2>
          <div className="sheet-bar-side end">{trailing}</div>
        </div>
      </header>
      <div className="sheet-body">{children}</div>
    </div>
  </div>, document.body);
}
