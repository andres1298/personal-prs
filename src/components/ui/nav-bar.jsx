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
      const box = title.getBoundingClientRect();
      const scrolled = box.top < edge - 0.5;
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
    <Icon name="chevronLeft" weight={2.6} /><span>{label}</span>
  </button>;
}

/** Large title that collapses into the inline title of a translucent bar on scroll. */
export function LargeTitle({ title, subtitle, trailing }) {
  const [barRef, titleRef, { scrolled, collapsed }] = useBarState();
  return <>
    <div className="navbar" ref={barRef} data-scrolled={scrolled} data-collapsed={collapsed}>
      <span />
      <span className="navbar-title" aria-hidden={!collapsed}>{title}</span>
      <span className="navbar-side end">{trailing}</span>
    </div>
    <header className="large-title" ref={titleRef}>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  </>;
}

/** Bar with a back button for pushed screens; the large title collapses into it. */
export function NavBar({ back, title, trailing }) {
  const [barRef, titleRef, { scrolled, collapsed }] = useBarState();
  return <>
    <div className="navbar" ref={barRef} data-scrolled={scrolled} data-collapsed={collapsed}>
      <span className="navbar-side">{back && <BackButton {...back} />}</span>
      <span className="navbar-title" aria-hidden={!collapsed}>{title}</span>
      <span className="navbar-side end">{trailing}</span>
    </div>
    <h1 className="page-title" ref={titleRef}>{title}</h1>
  </>;
}
