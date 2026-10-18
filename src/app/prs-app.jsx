'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_PLATES } from '../lib/plates';
import { readStored, useStoredState, useWakeLock, writeStored } from '../components/hooks';
import useRecords from '../components/use-records';
import { AlertProvider, useAlert } from '../components/ui/alert';
import TabBar from '../components/tab-bar';
import ExecuteView, { EXERCISE_DEFAULTS, restoreExercise, selectMovePatch } from '../components/execute/execute-view';
import PrsView from '../components/prs/prs-view';
import MoveDetailSheet from '../components/prs/move-detail-sheet';
import RecordFormSheet from '../components/prs/record-form-sheet';
import QuickUploadSheet from '../components/prs/quick-upload-sheet';
import SettingsSheet from '../components/settings-sheet';
import GuidedTour from '../components/tour/guided-tour';
import { TimerProvider } from '../components/timer/timer-provider';
import { TimerPill, TimerRunSheet, TimerView } from '../components/timer/timer-views';

const SETTINGS_DEFAULTS = { bar: 45, plates: [...ALL_PLATES], lastPct: 70, wake: true, simple: false, tab: 'exec' };

export default function App(props) {
  const scope = props.hasBackend ? props.userId : 'demo';
  return <AlertProvider>
    <TimerProvider scope={scope}>
      <PrsApp {...props} scope={scope} />
    </TimerProvider>
  </AlertProvider>;
}

function Banner({ loading, demo, error, onRetry }) {
  if (loading) return <div className="banner" role="status"><span className="spinner" aria-hidden="true" />Cargando tus PRs…</div>;
  if (demo) return <div className="banner warn"><span>Datos de ejemplo · cambios solo en esta sesión</span><Link href="/">Iniciar sesión</Link></div>;
  if (error) return <div className="banner warn" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Reintentar</button></div>;
  return null;
}

function PrsApp({ hasBackend, isAdmin = false, scope }) {
  const alert = useAlert();
  const { records, loading, error, reload, addRecord, addRecords } = useRecords(hasBackend);
  const [settings, updateSettings, ready] = useStoredState(`prs_settings_${scope}`, SETTINGS_DEFAULTS);
  const [ex, updateEx] = useStoredState(`prs_exec_${scope}`, EXERCISE_DEFAULTS, restoreExercise);
  const [detail, setDetail] = useState(null);       // { move, rm }
  const [form, setForm] = useState(null);           // { id, move, rm }
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tour, updateTour, tourReady] = useStoredState(`prs_tour_${scope}`, { seen: false });
  const [tourOpen, setTourOpen] = useState(false);
  const formCount = useRef(0);

  const setEx = useCallback((patch) => updateEx((current) => ({
    ...(typeof patch === 'function' ? patch(current) : patch), ts: Date.now(),
  })), [updateEx]);

  const tab = settings.tab;
  const running = tab === 'exec' && ex.view === 'run';
  useWakeLock(running && settings.wake !== false);
  // Simple mode hides the tab bar while lifting.
  const focus = running && !!settings.simple;

  // The guided tour opens by itself the first time the app is used on this device.
  useEffect(() => {
    if (ready && tourReady && !tour.seen) setTourOpen(true);
  }, [ready, tourReady, tour.seen]);

  // Offer the quick upload once to accounts that have no records yet, after the tour.
  const tourPending = !tourReady || !tour.seen || tourOpen;
  useEffect(() => {
    const key = `prs_quick_prompt_${scope}`;
    if (tourPending || !hasBackend || loading || error || records.length || readStored(key, {}).seen) return;
    writeStored(key, { seen: true });
    alert({
      title: '¿Quieres hacer un cargado rápido de tus pesos?',
      message: 'Escribe tus PRs de una vez y empieza a calcular tus cargas.',
      actions: [{ label: 'Ahora no', role: 'cancel' }, { label: 'Empezar', value: true }],
    }).then((start) => start && setQuickOpen(true));
  }, [tourPending, hasBackend, loading, error, records.length, scope, alert]);

  // Each tour step shows its tab; Execute steps need the movement picker.
  const showTourStep = useCallback((step) => {
    if (step.tab) updateSettings((current) => (current.tab === step.tab ? {} : { tab: step.tab }));
    if (step.tab === 'exec') updateEx((current) => (current.view === 'pick' ? current : { ...current, view: 'pick' }));
  }, [updateSettings, updateEx]);
  const closeTour = useCallback(() => {
    updateTour({ seen: true });
    setTourOpen(false);
  }, [updateTour]);
  const replayTour = () => {
    setSettingsOpen(false);
    // Let the settings sheet slide away first.
    setTimeout(() => setTourOpen(true), 380);
  };

  const goTab = (next) => {
    if (next === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    updateSettings({ tab: next });
    window.scrollTo({ top: 0 });
  };
  const openForm = (move, rm) => {
    formCount.current += 1;
    setForm({ id: formCount.current, move, rm });
  };
  const onAdd = () => openForm(tab === 'exec' && ex.move && !ex.free ? ex.move : undefined, tab === 'exec' ? ex.rm : undefined);

  async function saveRecord(record, file) {
    await addRecord(record, file);
    setForm(null);
    if (detail?.move === record.move) setDetail({ move: record.move, rm: record.rm });
  }
  async function saveQuick(list) {
    await addRecords(list);
    setQuickOpen(false);
  }

  const banner = <Banner loading={loading} demo={!hasBackend} error={error} onRetry={reload} />;
  if (!ready) return <div className="app-loading" aria-busy="true" />;

  return <>
    <TimerPill />
    <main className="page" data-focus={focus}>
      <section className="tab-view wrap" hidden={tab !== 'exec'}>
        <ExecuteView ex={ex} setEx={setEx} settings={settings} records={records} banner={banner} onOpenSettings={() => setSettingsOpen(true)} />
      </section>
      <section className="tab-view wrap" hidden={tab !== 'prs'}>
        <PrsView records={records} banner={banner} busy={loading || !!error} onQuick={() => setQuickOpen(true)} onOpen={(move) => setDetail({ move })} />
      </section>
      <section className="tab-view wrap" hidden={tab !== 'timer'}>
        <TimerView />
      </section>
    </main>
    <TabBar tab={tab} onTab={goTab} onAdd={onAdd} hidden={focus} />

    <MoveDetailSheet detail={detail} records={records} onClose={() => setDetail(null)}
      onChangeRm={(rm) => setDetail((d) => ({ ...d, rm }))} onAdd={openForm}
      onExecute={(move) => { setDetail(null); updateSettings({ tab: 'exec' }); setEx(selectMovePatch(records, move)); window.scrollTo({ top: 0 }); }} />
    <RecordFormSheet form={form} hasBackend={hasBackend} onClose={() => setForm(null)} onSave={saveRecord} />
    <QuickUploadSheet open={quickOpen} records={records} onClose={() => setQuickOpen(false)} onSave={saveQuick} />
    <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} updateSettings={updateSettings}
      demo={!hasBackend} isAdmin={isAdmin} onTour={replayTour} />
    <TimerRunSheet />
    <GuidedTour open={tourOpen} onStep={showTourStep} onClose={closeTour} />
  </>;
}
