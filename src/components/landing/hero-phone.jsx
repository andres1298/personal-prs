'use client';

import { useEffect, useState } from 'react';
import { EXERCISE_DEFAULTS, selectMovePatch } from '../execute/execute-view';
import { DEMO_RECORDS } from '../../lib/catalog';
import AppDevice from './app-device';
import { useInView, useReducedMotion } from './use-in-view';

const PERCENTS = [70, 80, 90, 75, 60];
const BACK_SQUAT = { ...EXERCISE_DEFAULTS, ...selectMovePatch(DEMO_RECORDS, 'Back Squat') };
const noop = () => {};

// The app's working screen playing by itself: the percentage moves and the barbell reloads.
export default function HeroPhone() {
  const [ref, inView] = useInView();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const playing = inView && !reduced;

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % PERCENTS.length), 2600);
    return () => clearInterval(id);
  }, [playing]);

  return <div ref={ref}>
    <AppDevice ex={{ ...BACK_SQUAT, pct: PERCENTS[index] }} setEx={noop} interactive={false} />
  </div>;
}
