'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const EDGE = 28;
const START = 10;
const SETTLE_MS = 280;

// Installed on an iPhone or iPad: Safari has its own edge gesture, so only the home screen app gets this one.
function isInstalledIos() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && (navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches);
}

/**
 * Swipe from the left edge to go back, as in iOS: the screen (`target`) follows the finger and the
 * previous one (`renderPrevious`) shows underneath, shifted and dimmed. Releasing past a third of the
 * width, or with a quick flick, calls `onBack`; otherwise the screen settles back.
 */
export default function EdgeSwipeBack({ target, enabled, onBack, renderPrevious }) {
  const [supported, setSupported] = useState(false);
  const [dragging, setDragging] = useState(false);
  const under = useRef(null);
  const swipe = useRef(null);
  const latest = useRef({ enabled, onBack });
  useEffect(() => { latest.current = { enabled, onBack }; }, [enabled, onBack]);
  useEffect(() => { setSupported(isInstalledIos()); }, []);

  useEffect(() => {
    const node = target.current;
    if (!supported || !node) return undefined;
    let suppressClick = false;
    const width = () => window.innerWidth;
    const paint = (dx, transition = 'none') => {
      const progress = Math.min(1, dx / width());
      node.style.transition = transition;
      node.style.transform = dx ? `translateX(${dx}px)` : '';
      if (under.current) {
        under.current.style.transition = transition;
        under.current.style.transform = `translateX(${-30 * (1 - progress)}%)`;
        under.current.style.setProperty('--dim', String(0.25 * (1 - progress)));
      }
    };
    const reset = () => {
      node.style.transition = ''; node.style.transform = '';
      node.classList.remove('swiping');
      setDragging(false);
    };

    const onDown = (event) => {
      if (swipe.current || event.button > 0 || !latest.current.enabled || event.clientX > EDGE) return;
      swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, dx: 0, vx: 0, active: false };
    };
    const onMove = (event) => {
      const current = swipe.current;
      if (!current || event.pointerId !== current.id) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.active) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { swipe.current = null; return; }
        if (dx < START) return;
        current.active = true;
        node.setPointerCapture?.(event.pointerId);
        node.classList.add('swiping');
        flushSync(() => setDragging(true));
      }
      const next = Math.max(0, dx);
      current.vx = (next - current.dx) / Math.max(1, event.timeStamp - current.t);
      current.t = event.timeStamp;
      current.dx = next;
      paint(next);
    };
    const onUp = (event) => {
      const current = swipe.current;
      if (!current || event.pointerId !== current.id) return;
      swipe.current = null;
      if (!current.active) return;
      // The touch that ends a swipe must not also tap what is under the finger.
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      const commit = event.type === 'pointerup' && (current.dx > width() / 3 || current.vx > 0.6);
      const ease = `transform ${SETTLE_MS}ms cubic-bezier(.22, 1, .36, 1)`;
      paint(commit ? width() : 0, ease);
      setTimeout(() => {
        if (commit) flushSync(() => latest.current.onBack());
        reset();
      }, SETTLE_MS + 10);
    };
    const onClick = (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    node.addEventListener('click', onClick, true);
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('click', onClick, true);
    };
  }, [supported, target]);

  if (!dragging) return null;
  return <div ref={under} className="swipe-under" aria-hidden="true" inert>{renderPrevious()}</div>;
}
