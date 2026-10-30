'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './icon';

// Tracks the title against the bar's real bottom edge, which grows with the safe area and the timer pill:
// `scrolled` once the title slides under the bar, `collapsed` once it is fully hidden.
function useBarState() {
  const barRef = useRef(null);
  const titleRef = useRef(null);
  const [state, setState] = useState({ scrolled: false, collapsed: false });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = barRef.current;
      const title = titleRef.current;
      if (!bar || !title) return;
      const edge = bar.getBoundingClientRect().bottom;
      // A bar that overlaps the title block (negative bottom margin) only turns solid once the title moves.
      const overlap = Math.max(0, -parseFloat(getComputedStyle(bar).marginBottom) || 0);
      const box = title.getBoundingClientRect();
      const scrolled = box.top < edge - overlap - 0.5;
      const collapsed = box.bottom <= edge;
      setState((prev) => (prev.scrolled === scrolled && prev.collapsed === collapsed ? prev : { scrolled, collapsed }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return [barRef, titleRef, state];
}

export function BackButton({ label, onClick }) {
  return <button type="button" className="nav-back" onClick={onClick}>
    <Icon name="chevronLeft" weight={2.8} /><span>{label}</span>
  </button>;
}

/** Large title under a kicker; the bar keeps the screen's action and shows the title once the large one scrolls away. */
export function LargeTitle({ title, subtitle, trailing, wideAction = false }) {
  const [barRef, titleRef, { scrolled, collapsed }] = useBarState();
  return <>
    <div className="navbar over" ref={barRef} data-scrolled={scrolled} data-collapsed={collapsed}>
      <span />
      <span className="navbar-title" aria-hidden={!collapsed}>{title}</span>
      <span className="navbar-side end">{trailing}</span>
    </div>
    <header className={`large-title${wideAction ? ' wide-action' : ''}`} ref={titleRef}>
      {subtitle && <p>{subtitle}</p>}
      <h1 className="display">{title}</h1>
    </header>
  </>;
}

/** Bar with a back button for pushed screens; the large title (or `children`) collapses into it.
 *  `inline` keeps the title in the bar and skips the large title, for screens that must fit the viewport. */
export function NavBar({ back, title, trailing, inline = false, children }) {
  const [barRef, titleRef, { scrolled, collapsed }] = useBarState();
  const showInline = inline || collapsed;
  return <>
    <div className="navbar" ref={barRef} data-scrolled={scrolled} data-collapsed={showInline}>
      <span className="navbar-side">{back && <BackButton {...back} />}</span>
      <span className="navbar-title" aria-hidden={!showInline} role={inline ? 'heading' : undefined} aria-level={inline ? 1 : undefined}>{title}</span>
      <span className="navbar-side end">{trailing}</span>
    </div>
    {!inline && <div ref={titleRef}>{children ?? <h1 className="page-title display">{title}</h1>}</div>}
  </>;
}
