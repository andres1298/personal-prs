'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXERCISE_DEFAULTS, selectMovePatch } from '../execute/execute-view';
import { DEMO_RECORDS } from '../../lib/catalog';
import AppDevice from './app-device';

const SECTIONS = { prs: 'progreso', timer: 'timer' };

// The real app with sample data, starting on Back Squat. Nothing is stored; the PRs and Timer tabs scroll
// to their sections of this page and + leads to creating an account.
export default function PlateDemo() {
  const router = useRouter();
  const [ex, setState] = useState(() => ({ ...EXERCISE_DEFAULTS, ...selectMovePatch(DEMO_RECORDS, 'Back Squat') }));
  const setEx = useCallback((patch) => setState((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);
  const onTab = (tab) => document.getElementById(SECTIONS[tab])?.scrollIntoView();

  return <AppDevice ex={ex} setEx={setEx} label="Demo interactiva de la app" onTab={onTab} onAdd={() => router.push('/register')} />;
}
