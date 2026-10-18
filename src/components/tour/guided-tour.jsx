'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../ui/icon';
import { useModalLayer, usePresence } from '../ui/sheet';

/**
 * Steps of the basic app flow. `target` matches a `data-tour` attribute; steps
 * without one show a centered card. `tab` is the tab the step needs visible.
 */
export const TOUR_STEPS = [
  {
    tab: 'exec', icon: 'sparkles', title: 'Bienvenido a PRs',
    body: 'En un minuto te mostramos cómo calcular tus cargas, guardar tus récords y usar el timer.',
  },
  {
    tab: 'exec', target: 'categories', title: 'Elige qué vas a levantar',
    body: 'Toca una categoría y luego un movimiento. La app toma tu PR y calcula el peso al porcentaje que quieras, con los discos por lado.',
  },
  {
    tab: 'exec', target: 'free-calc', title: 'Cálculo libre',
    body: '¿Sin PR guardado? Escribe cualquier peso y porcentaje y obtén la carga al momento.',
  },
  {
    tab: 'exec', target: 'settings', title: 'Tu barra y tus discos',
    body: 'En Ajustes eliges la barra y los discos que tienes. Las combinaciones y el calentamiento solo usan esos discos.',
  },
  {
    tab: 'prs', target: 'prs-groups', title: 'Tus récords',
    body: 'Aquí está tu mejor marca de cada movimiento, agrupada por categoría. Toca un movimiento para ver su historial.',
  },
  {
    tab: 'prs', target: 'quick-upload', title: 'Carga rápida',
    body: 'Escribe varios PRs de una vez para empezar sin perder tiempo.',
  },
  {
    tab: 'prs', target: 'add', title: 'Registra un nuevo PR',
    body: 'Con + guardas una marca desde cualquier pestaña. En Execute se llena con el movimiento que tienes abierto.',
  },
  {
    tab: 'timer', target: 'timer-templates', title: 'Timer para tus workouts',
    body: 'AMRAP, EMOM, TABATA y For Time. El timer sigue corriendo y visible aunque cambies de pestaña.',
  },
  {
    tab: 'exec', target: 'tabs', title: 'Muévete entre secciones',
    body: 'Execute, PRs y Timer siempre están aquí abajo.',
  },
  {
    tab: 'exec', icon: 'check', title: '¡Listo para entrenar!',
    body: 'Puedes repetir este tour cuando quieras desde Ajustes.',
  },
];

const GUTTER = 16;
const GAP = 14;
const PAD = 8;
const CARD_WIDTH = 340;
const CARD_ESTIMATE = 210;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const findTarget = (name) => (name ? document.querySelector(`[data-tour="${name}"]`) : null);
const isVisible = (node) => !!node && node.getClientRects().length > 0;

// Padded highlight around the target, keeping its own corner radius.
function spotFor(node) {
  const box = node.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 12;
  // Keep the highlight inside the screen for targets at its edges.
  const top = Math.max(4, box.top - PAD);
  const left = Math.max(4, box.left - PAD);
  const width = Math.min(window.innerWidth - 4, box.right + PAD) - left;
  const height = Math.min(window.innerHeight - 4, box.bottom + PAD) - top;
  return {
    top, left, width, height,
    radius: Math.min(radius + PAD, height / 2),
  };
}

const sameLayout = (a, b) => a.vw === b.vw && a.vh === b.vh && (a.spot === b.spot || (a.spot && b.spot
  && ['top', 'left', 'width', 'height', 'radius'].every((key) => Math.abs(a.spot[key] - b.spot[key]) < 0.5)));

// Scrolls so the target and the card below it fit on screen; tall targets go near the top.
function revealTarget(node) {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (getComputedStyle(node).position === 'fixed') return;
  // The modal layer locks page scrolling, which also unsticks the bar, so bar targets need the top.
  if (node.closest('.navbar')) { window.scrollTo({ top: 0, behavior }); return; }
  const box = node.getBoundingClientRect();
  const total = box.height + GAP + CARD_ESTIMATE;
  const desired = total <= window.innerHeight - GUTTER * 2 ? (window.innerHeight - total) / 2 : 72;
  window.scrollTo({ top: window.scrollY + box.top - desired, behavior });
}

function cardPosition({ spot, vw, vh }, cardHeight, cardWidth) {
  const height = cardHeight || CARD_ESTIMATE;
  if (!spot) return { top: Math.max(GUTTER, (vh - height) / 2), left: (vw - cardWidth) / 2, place: 'center' };
  const left = Math.min(Math.max(spot.left + spot.width / 2 - cardWidth / 2, GUTTER), vw - cardWidth - GUTTER);
  const below = spot.top + spot.height + GAP;
  if (below + height <= vh - GUTTER) return { top: below, left, place: 'below' };
  const above = spot.top - GAP - height;
  if (above >= GUTTER) return { top: above, left, place: 'above' };
  return { top: vh - height - GUTTER, left, place: 'over' };
}

/**
 * Coach-mark tour: dims the app, moves an animated spotlight to each target and
 * shows a card with progress, Back, Next and Skip. `onStep` lets the app show the
 * tab a step needs; `onClose` receives whether the tour reached its last step.
 */
export default function GuidedTour({ open, steps = TOUR_STEPS, onStep, onClose }) {
  const { mounted, shown } = usePresence(open, 320);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [layout, setLayout] = useState({ spot: null, vw: 0, vh: 0 });
  const [cardHeight, setCardHeight] = useState(0);
  const root = useRef(null);
  const card = useRef(null);
  const primary = useRef(null);
  const stepHandler = useRef(onStep);
  const titleId = useId();
  const bodyId = useId();
  useModalLayer(mounted && open, root);
  useEffect(() => { stepHandler.current = onStep; }, [onStep]);

  const step = steps[index];
  const last = index === steps.length - 1;

  // Start over after the exit animation, so a replay begins at the welcome step.
  useEffect(() => { if (!mounted) { setIndex(0); setDirection(1); } }, [mounted]);

  // Show the step's tab, then bring its target into view once it renders.
  useEffect(() => {
    if (!open) return undefined;
    stepHandler.current?.(step);
    let first, second;
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const node = findTarget(step.target);
        if (isVisible(node)) revealTarget(node);
        else if (!step.target) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [open, step]);

  // Follow the target every frame (tab changes, scrolling, resizing, animations).
  useEffect(() => {
    if (!mounted) return undefined;
    let frame;
    const tick = () => {
      const node = findTarget(step.target);
      const visible = isVisible(node);
      // Keep the previous spot while a target is still rendering so it glides instead of collapsing.
      if (visible || !step.target) {
        const next = { spot: visible ? spotFor(node) : null, vw: window.innerWidth, vh: window.innerHeight };
        setLayout((current) => (sameLayout(current, next) ? current : next));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mounted, step.target]);

  useEffect(() => {
    const node = card.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => setCardHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => { if (shown) primary.current?.focus({ preventScroll: true }); }, [shown, index]);

  const go = (delta) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) { onClose?.(true); return; }
    setDirection(delta);
    setIndex(next);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.(false);
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!mounted) return null;
  const vw = layout.vw || window.innerWidth;
  const vh = layout.vh || window.innerHeight;
  const cardWidth = Math.min(CARD_WIDTH, vw - GUTTER * 2);
  const position = cardPosition({ spot: layout.spot, vw, vh }, cardHeight, cardWidth);
  // Without a target the spotlight shrinks to the center, so the whole screen dims.
  const spot = layout.spot || { top: vh / 2, left: vw / 2, width: 0, height: 0, radius: 0 };

  return createPortal(<div ref={root} className="tour-root" data-state={shown ? 'open' : 'closed'}>
    <div className="tour-spot" data-empty={!layout.spot} aria-hidden="true" style={{
      top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: spot.radius,
    }} />
    <div
      ref={card} className="tour-card" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
      data-place={position.place} style={{ top: position.top, left: position.left, width: cardWidth }}
    >
      <div className="tour-content" key={index} data-direction={direction > 0 ? 'next' : 'back'} aria-live="polite">
        {step.icon && <span className="tour-badge"><Icon name={step.icon} weight={2.6} /></span>}
        <p className="tour-count num">{index + 1} de {steps.length}</p>
        <h2 id={titleId}>{step.title}</h2>
        <p id={bodyId}>{step.body}</p>
      </div>
      <div className="tour-progress" aria-hidden="true">
        {steps.map((_, i) => <i key={i} data-state={i === index ? 'current' : i < index ? 'done' : undefined} />)}
      </div>
      <div className="tour-actions">
        {!last && <button type="button" className="tour-skip" onClick={() => onClose?.(false)}>Saltar tour</button>}
        <span className="tour-actions-end">
          {index > 0 && <button type="button" className="tour-back" onClick={() => go(-1)} aria-label="Paso anterior">
            <Icon name="chevronLeft" weight={2.6} />
          </button>}
          <button type="button" ref={primary} className="tour-next" onClick={() => go(1)}>
            {index === 0 ? 'Empezar' : last ? 'A entrenar' : 'Siguiente'}
            {!last && <Icon name="chevronRight" weight={2.8} />}
          </button>
        </span>
      </div>
    </div>
  </div>, document.body);
}
