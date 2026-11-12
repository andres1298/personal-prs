'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_PLATES } from '../lib/plates';
import { readStored, useStoredState, useWakeLock, writeStored } from '../components/hooks';
import useRecords from '../components/use-records';
import useMovements from '../components/use-movements';
import usePlan from '../components/plan/use-plan';
import PlanView from '../components/plan/plan-view';
import { today } from '../lib/catalog';
import { DEFAULT_PCT } from '../lib/plates';
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
import { useHistoryBack, useOpenLayers } from '../components/back-navigation';
import EdgeSwipeBack from '../components/edge-swipe-back';

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
  if (demo) return <div className="banner warn"><span>Datos de ejemplo · cambios solo en esta sesión</span><Link className="pill-btn" href="/app">Iniciar sesión</Link></div>;
  if (error) return <div className="banner warn" role="alert"><span>{error}</span><button type="button" className="pill-btn" onClick={onRetry}>Reintentar</button></div>;
  if (stale) return <div className="banner warn" aria-live="polite"><span>{stale}</span><button type="button" className="pill-btn" onClick={onRetry}>Actualizar</button></div>;
  return null;
}

function PrsApp({ hasBackend, isAdmin = false, isCoach = false, hasPlan = false, userId, tourPending: newMember = false, scope }) {
  const alert = useAlert();
  const {
    records, loading: loadingRecords, error: recordsError, stale: recordsStale, synced, reload: reloadRecords, addRecord, addRecords,
  } = useRecords(hasBackend, scope);
  const movements = useMovements(hasBackend, scope);
  const plan = usePlan(hasBackend, scope);
  // The server's answer at page load holds until the plan itself arrives, so the tab does not flicker.
  const planEnabled = hasBackend && (plan.loaded ? Boolean(plan.coach) || plan.sessions.length > 0 : hasPlan || Boolean(plan.coach));
  const planBadge = plan.sessions.some((session) => session.unread > 0 || (session.date === today() && !session.completedAt));
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
  const [newMovement, setNewMovement] = useState(null); // { tab, group }
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

  // A stored plan tab falls back to Execute once the member no longer follows a plan.
  const tab = settings.tab === 'plan' && !planEnabled ? 'exec' : settings.tab;
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
  // A join link opened before signing in is kept on the device and resumed here.
  useEffect(() => {
    const code = hasBackend && readStored('prs_pending_join', null);
    if (typeof code !== 'string') return;
    writeStored('prs_pending_join', null);
    window.location.assign(`/join/${encodeURIComponent(code)}`);
  }, [hasBackend]);
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

  // Simple mode has no percentages panel, so its step is left out.
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

  // Members who follow a plan open on it, once per visit; afterwards the tab they pick is kept.
  const home = planEnabled && plan.coach ? 'plan' : 'exec';
  const homed = useRef(false);
  useEffect(() => {
    if (!ready || home !== 'plan' || homed.current) return;
    homed.current = true;
    updateSettings({ tab: 'plan' });
  }, [ready, home, updateSettings]);

  // Back goes up Execute's screens (working screen, group, picker) and from any other tab to the home tab:
  // the plan for members who follow one, Execute for everyone else, who pass through its screens on the way.
  // While the tour runs it moves between screens itself, so the depth it found stays in place.
  const execDepth = ex.view === 'run' ? (ex.free ? 1 : 2) : ex.view === 'moves' ? 1 : 0;
  const inExec = tab === 'exec' && execDepth > 0;
  const liveDepth = home === 'exec' ? execDepth + (tab === 'exec' ? 0 : 1) : (tab === 'exec' ? execDepth : 0) + (tab === home ? 0 : 1);
  const tourDepth = useRef(liveDepth);
  if (!tourOpen) tourDepth.current = liveDepth;
  const screenDepth = tourOpen ? tourDepth.current : liveDepth;
  const screenBack = () => {
    if (inExec) setEx({ view: ex.view === 'run' && !ex.free ? 'moves' : 'pick' });
    else if (tab !== home) updateSettings({ tab: home });
    window.scrollTo({ top: 0 });
  };
  useHistoryBack(screenDepth, screenBack, ready && connected);
  const openLayers = useOpenLayers();
  const page = useRef(null);
  // The screen going back would show, drawn under the edge swipe.
  const previousScreen = () => <section className="wrap">
    {home === 'plan' && !inExec
      ? <PlanView plan={plan} records={records} userId={userId} active={false} onExecute={() => {}} onAddRecord={() => {}} onSaveRecord={() => {}} />
      : <ExecuteView ex={tab === 'exec' ? { ...ex, view: ex.view === 'run' && !ex.free ? 'moves' : 'pick' } : ex} setEx={() => {}}
        settings={settings} records={records} banner={banner} onOpenSettings={() => {}} />}
  </section>;

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
    if (ex.move === name) setEx({ view: 'pick', move: null, free: false, base: 0, extra: [], minus: [] });
    return result;
  }
  // A prescribed load opens on the barbell: on its movement when the percentage is of its own
  // record, otherwise as a free calculation of the resolved weight.
  function executeLoad({ movement, rm, pct, base, weight }) {
    const patch = movement && pct <= 100
      ? { ...selectMovePatch(records, movement), rm, base, pct }
      : { view: 'run', free: true, move: null, base: weight, pct: 100, extra: [], minus: [], sel: 0, panel: 'load' };
    updateSettings({ tab: 'exec' });
    setEx(patch);
    window.scrollTo({ top: 0 });
  }
  // Coach movements arrive with the plan, so joining or leaving one reloads the catalog.
  async function joinPlan(code) {
    const joined = await plan.join(code);
    movements.reload();
    return joined;
  }
  async function leavePlan() {
    await plan.leave();
    movements.reload();
  }
  async function saveQuick(list) {
    await addRecords(list);
    setQuickOpen(false);
  }

  const banner = <Banner loading={loading} demo={!hasBackend} error={error} stale={stale} onRetry={reload} />;
  if (!ready || !connected) return <SignalLoader />;

  return <>
    <TimerPill />
    <main className="page" ref={page} data-focus={focus}>
      {planEnabled && <section className="tab-view wrap" hidden={tab !== 'plan'}>
        <PlanView plan={plan} records={records} userId={userId} active={tab === 'plan'} onExecute={executeLoad} onAddRecord={openForm} onSaveRecord={addRecord} />
      </section>}
      <section className="tab-view wrap" hidden={tab !== 'exec'}>
        <ExecuteView ex={ex} setEx={setEx} settings={settings} records={records} banner={banner} onOpenSettings={() => setSettingsOpen(true)}
          onOpenRecord={(move) => setDetail({ move })} />
      </section>
      <section className="tab-view wrap" hidden={tab !== 'prs'}>
        <PrsView records={records} banner={banner} busy={loading || !!error} onQuick={() => setQuickOpen(true)} onOpen={(move) => setDetail({ move })} />
      </section>
      <section className="tab-view wrap" hidden={tab !== 'timer'}>
        <TimerView />
      </section>
    </main>
    <TabBar tab={tab} onTab={goTab} onAdd={onAdd} hidden={focus} plan={planEnabled} planBadge={planBadge} />
    <EdgeSwipeBack target={page} enabled={screenDepth > 0 && !openLayers} onBack={screenBack} renderPrevious={previousScreen} />

    <MoveDetailSheet detail={detail} records={records} onClose={() => setDetail(null)}
      onChangeRm={(rm) => setDetail((d) => ({ ...d, rm }))} onAdd={openForm}
      onExecute={(move) => { setDetail(null); updateSettings({ tab: 'exec' }); setEx(selectMovePatch(records, move)); window.scrollTo({ top: 0 }); }} />
    <RecordFormSheet form={form} onClose={() => setForm(null)} onSave={saveRecord} />
    <QuickUploadSheet open={quickOpen} records={records} onClose={() => setQuickOpen(false)} onSave={saveQuick} />
    <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} updateSettings={updateSettings}
      demo={!hasBackend} isAdmin={isAdmin} isCoach={isCoach} coach={plan.coach} division={plan.division} onDivision={plan.setDivision} onJoin={joinPlan} onLeave={leavePlan} onTour={replayTour} onMyMovements={() => setMyMovementsOpen(true)} />
    <MyMovementsSheet open={myMovementsOpen} onClose={() => setMyMovementsOpen(false)} movements={movements.movements}
      onNew={() => setNewMovement({})} onHide={movements.setHidden} onDelete={deleteMovement} />
    <NewMovementSheet preset={newMovement} onClose={() => setNewMovement(null)} onCreate={movements.createMovement} />
    <TimerRunSheet />
    <GuidedTour open={tourOpen} steps={tourSteps} onStep={showTourStep} onClose={closeTour} />
  </>;
}
