'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './icon';

// True once the element has scrolled under the navigation bar.
function useScrolledPast() {
  const ref = useRef(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), { rootMargin: '-60px 0px 0px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, past];
}

export function BackButton({ label, onClick }) {
  return <button type="button" className="nav-back" onClick={onClick}>
    <Icon name="chevronLeft" weight={2.6} /><span>{label}</span>
  </button>;
}

/** Large title that collapses into the inline title of a translucent bar on scroll. */
export function LargeTitle({ title, subtitle, trailing }) {
  const [ref, past] = useScrolledPast();
  return <>
    <div className="navbar" data-collapsed={past}>
      <span />
      <span className="navbar-title" aria-hidden={!past}>{title}</span>
      <span className="navbar-side end">{trailing}</span>
    </div>
    <header className="large-title" ref={ref}>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  </>;
}

/** Bar with a back button for pushed screens; the large title collapses into it. */
export function NavBar({ back, title, trailing }) {
  const [ref, past] = useScrolledPast();
  return <>
    <div className="navbar" data-collapsed={past}>
      <span className="navbar-side">{back && <BackButton {...back} />}</span>
      <span className="navbar-title" aria-hidden={!past}>{title}</span>
      <span className="navbar-side end">{trailing}</span>
    </div>
    <h1 className="page-title" ref={ref}>{title}</h1>
  </>;
}
