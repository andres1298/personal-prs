'use client';

import { useEffect, useRef, useState } from 'react';
import ExecuteView from '../execute/execute-view';
import TabBar from '../tab-bar';
import { DEMO_RECORDS } from '../../lib/catalog';
import { ALL_PLATES } from '../../lib/plates';

// The app's defaults: 45 lb bar, every plate, the full working screen.
const DEMO_SETTINGS = { bar: 45, plates: [...ALL_PLATES], simple: false };
const noop = () => {};

// The app's real Execute screen and tab bar inside a phone, always in the app's dark theme. It renders after
// mount, so the page's HTML keeps a single heading outline for search engines and the app UI hydrates nothing.
export default function AppDevice({ ex, setEx, interactive = true, label, onTab = noop, onAdd = noop }) {
  const scroller = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const scrollToTop = () => scroller.current?.scrollTo({ top: 0 });

  return <div className="lp-device" role={interactive ? 'region' : undefined} aria-label={interactive ? label : undefined}
    aria-hidden={interactive ? undefined : true} inert={!interactive}>
    <div className="lp-device-screen lp-app-dark">
      <div className="lp-device-status" aria-hidden="true"><span>9:41</span><i /><span>100%</span></div>
      <div className="lp-device-scroll" ref={scroller}>
        {mounted && <section className="wrap">
          <ExecuteView ex={ex} setEx={setEx} settings={DEMO_SETTINGS} records={DEMO_RECORDS}
            onOpenSettings={noop} onOpenRecord={noop} scrollToTop={scrollToTop} />
        </section>}
      </div>
      {mounted && <TabBar tab="exec" onTab={onTab} onAdd={onAdd} />}
    </div>
  </div>;
}
