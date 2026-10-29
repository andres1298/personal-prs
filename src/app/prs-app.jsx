'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_PLATES } from '../lib/plates';
import { readStored, useStoredState, useWakeLock, writeStored } from '../components/hooks';
import useRecords from '../components/use-records';
import useMovements from '../components/use-movements';
import { AlertProvider, useAlert } from '../components/ui/alert';
import TabBar from '../components/tab-bar';
import SignalLoader from '../components/ui/signal-loader';
import ExecuteView, { EXERCISE_DEFAULTS, restoreExercise, selectMovePatch, tourExercise } from '../components/execute/execute-view';
import PrsView from '../components/prs/prs-view';
import MoveDetailSheet from '../components/prs/move-detail-sheet';
import RecordFormSheet from '../components/prs/record-form-sheet';
import QuickUploadSheet from '../components/prs/quick-upload-sheet';
import MyMovementsSheet from '../components/movements/my-movements-sheet';
import NewMovementSheet from '../components/movements/new-movement-sheet';
import SettingsSheet from '../components/settings-sheet';
import GuidedTour, { TOUR_STEPS } from '../components/tour/guided-tour';
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

function Banner({ loading, demo, error, stale, onRetry }) {
  if (loading) return <div className="banner" role="status"><span className="spinner" aria-hidden="true" />Cargando tus PRs…</div>;
  if (demo) return <div className="banner warn"><span>Datos de ejemplo · cambios solo en esta sesión</span><Link href="/">Iniciar sesión</Link></div>;
  if (error) return <div className="banner warn" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Reintentar</button></div>;
  if (stale) return <div className="banner warn" aria-live="polite"><span>{stale}</span><button type="button" onClick={onRetry}>Actualizar</button></div>;
  return null;
}

function PrsApp({ hasBackend, isAdmin = false, tourPending: newMember = false, scope }) {
  const alert = useAlert();
  const {
    records, loading: loadingRecords, error: recordsError, stale: recordsStale, synced, reload: reloadRecords, addRecord, addRecords,
  } = useRecords(hasBackend, scope);
  const movements = useMovements(hasBackend, scope);
  const loading = loadingRecords || movements.loading;
  const error = recordsError || movements.error;
  const stale = recordsStale || movements.stale;
  const reload = () => { reloadRecords(); movements.reload(); };
  const [settings, updateSettings, ready] = useStoredState(`prs_settings_${scope}`, SETTINGS_DEFAULTS);
  const [ex, updateEx] = useStoredState(`prs_exec_${scope}`, EXERCISE_DEFAULTS, restoreExercise);
  const [detail, setDetail] = useState(null);       // { move, rm }
  const [form, setForm] = useState(null);           // { id, move, rm }
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myMovementsOpen, setMyMovementsOpen] = useState(false);
  const [newMovement, setNewMovement] = useState(null); // { tab, group, forForm }
  const [tour, updateTour, tourReady] = useStoredState(`prs_tour_${scope}`, { seen: false });
  const [tourOpen, setTourOpen] = useState(false);
  const tourSnapshot = useRef(null);
  const formCount = useRef(0);
  // The loader stays up until the first load settles; later reloads use the banner.
  const [connected, setConnected] = useState(false);
  useEffect(() => { if (!loading) setConnected(true); }, [loading]);

  const setEx = useCallback((patch) => updateEx((current) => ({
    ...(typeof patch === 'function' ? patch(current) : patch), ts: Date.now(),
  })), [updateEx]);

  const tab = settings.tab;
  const running = tab === 'exec' && ex.view === 'run';
  useWakeLock(running && settings.wake !== false);
  // Simple mode hides the tab bar while lifting.
  const focus = running && !!settings.simple;

  // The guided tour opens by itself for new members (and once per device in the demo).
  // The device flag also covers the moment between closing the tour and the server saving it.
  const autoTour = (hasBackend ? newMember : true) && !tour.seen;
  useEffect(() => {
    if (ready && tourReady && autoTour) setTourOpen(true);
  }, [ready, tourReady, autoTour]);

  // Offer the quick upload once to accounts that have no records yet, after the tour.
  // The device copy can be out of date, so it waits for the server's answer.
  const tourPending = !tourReady || autoTour || tourOpen;
  useEffect(() => {
    const key = `prs_quick_prompt_${scope}`;
    if (tourPending || !hasBackend || !synced || error || records.length || readStored(key, {}).seen) return;
    writeStored(key, { seen: true });
    alert({
      title: '¿Quieres hacer un cargado rápido de tus pesos?',
      message: 'Escribe tus PRs de una vez y empieza a calcular tus cargas.',
      actions: [{ label: 'Ahora no', role: 'cancel' }, { label: 'Empezar', value: true }],
    }).then((start) => start && setQuickOpen(true));
  }, [tourPending, hasBackend, synced, error, records.length, scope, alert]);

  // Simple mode has no warm-up ladder, so its step is left out.
  const tourSteps = useMemo(() => TOUR_STEPS.filter((step) => !(settings.simple && step.advanced)), [settings.simple]);
  // Each tour step shows its tab and Execute screen. The working screen uses a sample
  // lift, so the exercise in progress is kept aside and restored when the tour closes.
  const showTourStep = useCallback((step) => {
    if (step.tab) updateSettings((current) => (current.tab === step.tab ? {} : { tab: step.tab }));
    if (!step.exec) return;
    updateEx((current) => {
      tourSnapshot.current ??= current;
      const sample = step.exec.view === 'run' ? tourExercise(records) : {};
      return { ...current, ...sample, ...step.exec };
    });
  }, [updateSettings, updateEx, records]);
  const closeTour = useCallback(() => {
    if (hasBackend && newMember && !tour.seen) fetch('/api/tour', { method: 'POST' }).catch(() => {});
    updateTour({ seen: true });
    setTourOpen(false);
    if (tourSnapshot.current) updateEx(tourSnapshot.current);
    tourSnapshot.current = null;
  }, [hasBackend, newMember, tour.seen, updateTour, updateEx]);
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

  async function saveRecord(record) {
    await addRecord(record);
    setForm(null);
    if (detail?.move === record.move) setDetail({ move: record.move, rm: record.rm });
  }
  // Deleting a movement also deletes its records, so the list is loaded again and any
  // screen that was showing the movement is cleared.
  async function deleteMovement(id, confirmed) {
    const result = await movements.removeMovement(id, confirmed);
    const name = movements.movements.find((movement) => movement.id === id)?.name;
    if (result.deletedRecords) reloadRecords();
    if (detail?.move === name) setDetail(null);
    if (ex.move === name) setEx({ view: 'pick', move: null, free: false, base: 0, extra: [], minus: [], done: [] });
    return result;
  }
  // Demo sessions keep the static catalog, so they have no entry points to create movements.
  const openNewMovement = hasBackend ? (preset = {}) => setNewMovement(preset) : undefined;
  // A movement created from the record form becomes that form's movement.
  const movementCreated = (movement) => {
    if (newMovement?.forForm) setForm((current) => current && { ...current, created: movement.name });
  };
  async function saveQuick(list) {
    await addRecords(list);
    setQuickOpen(false);
  }

  const banner = <Banner loading={loading} demo={!hasBackend} error={error} stale={stale} onRetry={reload} />;
  if (!ready || !connected) return <SignalLoader />;

  return <>
    <TimerPill />
    <main className="page" data-focus={focus}>
      <section className="tab-view wrap" hidden={tab !== 'exec'}>
        <ExecuteView ex={ex} setEx={setEx} settings={settings} records={records} banner={banner} onOpenSettings={() => setSettingsOpen(true)}
          onNewMovement={openNewMovement} />
      </section>
      <section className="tab-view wrap" hidden={tab !== 'prs'}>
        <PrsView records={records} banner={banner} busy={loading || !!error} onQuick={() => setQuickOpen(true)} onOpen={(move) => setDetail({ move })}
          onNewMovement={openNewMovement} />
      </section>
      <section className="tab-view wrap" hidden={tab !== 'timer'}>
        <TimerView />
      </section>
    </main>
    <TabBar tab={tab} onTab={goTab} onAdd={onAdd} hidden={focus} />

    <MoveDetailSheet detail={detail} records={records} onClose={() => setDetail(null)}
      onChangeRm={(rm) => setDetail((d) => ({ ...d, rm }))} onAdd={openForm}
      onExecute={(move) => { setDetail(null); updateSettings({ tab: 'exec' }); setEx(selectMovePatch(records, move)); window.scrollTo({ top: 0 }); }} />
    <RecordFormSheet form={form} demo={!hasBackend} onClose={() => setForm(null)} onSave={saveRecord}
      onNewMovement={(preset) => setNewMovement({ ...preset, forForm: true })} />
    <QuickUploadSheet open={quickOpen} records={records} onClose={() => setQuickOpen(false)} onSave={saveQuick} />
    <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} updateSettings={updateSettings}
      demo={!hasBackend} isAdmin={isAdmin} onTour={replayTour} onMyMovements={() => setMyMovementsOpen(true)} />
    <MyMovementsSheet open={myMovementsOpen} onClose={() => setMyMovementsOpen(false)} movements={movements.movements}
      onNew={() => setNewMovement({})} onHide={movements.setHidden} onDelete={deleteMovement} />
    <NewMovementSheet preset={newMovement} onClose={() => setNewMovement(null)} onCreate={movements.createMovement}
      onCreated={movementCreated} />
    <TimerRunSheet />
    <GuidedTour open={tourOpen} steps={tourSteps} onStep={showTourStep} onClose={closeTour} />
  </>;
}
