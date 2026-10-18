import {
  TIMER_TYPES, addRound, cuesBetween, finish, formatClock, normalizeConfig, pause, restoreRun, resume, snapshot, start, undoRound,
} from './timer-engine.js';
import { createSoundPlayer } from './timer-sounds.js';

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const TEMPLATES = {
  amrap:   { name: 'AMRAP',    color: '--lime',   icon: svg('<path d="M6 5v14M10 5v14M14 5v14M18 5v14M3.5 15.5l17-7"/>') },
  emom:    { name: 'EMOM',     color: '--cyan',   icon: svg('<path d="M2.5 12h3M8 12h3M13.5 12h3M19 12h2.5"/>') },
  tabata:  { name: 'TABATA',   color: '--violet', icon: svg('<path d="M5 6v12M9.5 9v6M14 6v12M18.5 9v6"/>') },
  fortime: { name: 'FOR TIME', color: '--amber',  icon: svg('<path d="M4 9h7M4 13h16M13 17h7"/>') },
};
const FIELDS = {
  amrap: [['duration', 'Duración']],
  emom: [['interval', 'Intervalo'], ['rounds', 'Rondas']],
  tabata: [['work', 'Trabajo'], ['rest', 'Descanso'], ['rounds', 'Rondas']],
  fortime: [['cap', 'Límite de tiempo']],
};
const ARROW = svg('<path d="M7 17 17 7M8 7h9v9"/>');
const CHEVRON_DOWN = svg('<path d="m6 9 6 6 6-6"/>');

const span = (ms) => (ms < 60_000 ? `${ms / 1000} s` : formatClock(ms));
const describe = (c) => ({
  amrap: () => `Máximas rondas en ${formatClock(c.duration)}`,
  emom: () => `Cada ${span(c.interval)} por ${c.rounds} rondas`,
  tabata: () => `${span(c.work)} de trabajo y ${span(c.rest)} de descanso por ${c.rounds} rondas`,
  fortime: () => `Lo más rápido posible · límite ${formatClock(c.cap)}`,
})[c.type]();

// Finer steps for short segments: 5 s under a minute, 15 s under ten, then a minute.
function stepValue(key, value, direction) {
  if (key === 'rounds') return value + direction;
  const reference = direction > 0 ? value : value - 1;
  const step = reference < 60_000 ? 5_000 : reference < 600_000 ? 15_000 : 60_000;
  return value + direction * step;
}

export function initTimer({ scope, signal, setWake, isActiveTab }) {
  const $ = (selector) => document.querySelector(selector);
  const runKey = `prs_timer_run_${scope}`;
  const configKey = `prs_timer_cfg_${scope}`;
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const sound = createSoundPlayer();
  const storedConfigs = read(configKey) || {};
  const configs = Object.fromEntries(TIMER_TYPES.map((type) => {
    try { return [type, normalizeConfig({ ...storedConfigs[type], type })]; } catch { return [type, normalizeConfig({ type })]; }
  }));
  let run = restoreRun(read(runKey));
  let editing = null;
  let confirmEnd = false;
  let lastElapsed = 0;
  let intervalId = null;

  const isActive = () => !!run && run.finalElapsed === null;
  const runOpen = () => $('#timerRun').classList.contains('open');
  const saveRun = () => write(runKey, run);

  /* ---------- Template list ---------- */
  function renderView() {
    const current = isActive() ? TEMPLATES[run.config.type] : null;
    $('#vTimer').innerHTML = `
      <div class="hdr"><h1>Timer</h1><p>Elige una plantilla para tu workout.</p></div>
      ${current ? `<button class="tcur" data-a="t-open" style="--c:var(${current.color})">
        <span><small>Timer en curso</small><b>${current.name}</b></span><span class="num" id="tCurClock"></span></button>` : ''}
      <div class="sec">Plantillas</div>
      <div class="tcards">${TIMER_TYPES.map((type) => {
        const t = TEMPLATES[type];
        return `<button class="tcard" data-a="t-cfg" data-v="${type}">
          <span class="ticon" style="--c:var(${t.color})">${t.icon}</span>
          <span class="tcopy"><b>${t.name}</b><small>${describe(configs[type])}</small></span>
          <span class="tarrow">${ARROW}</span></button>`;
      }).join('')}</div>`;
    updateLive();
  }

  /* ---------- Configuration sheet ---------- */
  function openConfig(type) {
    editing = { ...configs[type] };
    renderConfig();
    $('#timerCfg').classList.add('open');
  }
  function renderConfig() {
    const t = TEMPLATES[editing.type];
    const total = normalizeConfig(editing);
    const workTotal = { amrap: total.duration, fortime: total.cap, emom: total.interval * total.rounds,
      tabata: total.work * total.rounds + total.rest * (total.rounds - 1) }[editing.type];
    $('#tCfgBody').innerHTML = `
      <div class="navbar"><button class="nbtn" data-a="close">Cancelar</button><div class="ttl">${t.name}</div><span></span></div>
      <div class="tcfghead"><span class="ticon big" style="--c:var(${t.color})">${t.icon}</span><p class="sub">${describe(total)}</p></div>
      <div class="tfields">${FIELDS[editing.type].map(([key, label]) => `
        <div class="setrow"><span>${label}</span>
          <div class="tstep">
            <button data-a="t-step" data-v="${key}:-1" aria-label="Menos ${label.toLowerCase()}">−</button>
            <b class="num">${key === 'rounds' ? total[key] : span(total[key])}</b>
            <button data-a="t-step" data-v="${key}:1" aria-label="Más ${label.toLowerCase()}">+</button>
          </div></div>`).join('')}</div>
      <p class="sub tnote">Duración total ${formatClock(workTotal)} · empieza con 10 s para prepararte${isActive() ? '. Reemplaza el timer en curso.' : '.'}</p>
      <button class="primary" data-a="t-start">Iniciar</button>`;
  }

  /* ---------- Running and summary sheet ---------- */
  function openRun() {
    renderRun();
    $('#timerRun').classList.add('open');
    updatePill();
  }
  function renderRun() {
    const body = $('#tRunBody');
    if (!run) { body.innerHTML = ''; return; }
    const { type } = run.config;
    const t = TEMPLATES[type];
    const view = snapshot(run, Date.now());
    body.style.setProperty('--c', `var(${t.color})`);
    const nav = `<div class="navbar"><button class="nbtn" data-a="t-min" aria-label="Minimizar">${CHEVRON_DOWN}</button><div class="ttl">${t.name}</div><span></span></div>`;
    if (view.done) {
      body.innerHTML = nav + summary(view) + `
        <button class="primary" data-a="t-clear">Listo</button>
        <button class="quiet tfull" data-a="t-repeat">Repetir</button>`;
      return;
    }
    body.innerHTML = nav + `
      <div class="tstage" id="tStage">
        <p class="tphase" id="tPhase"></p>
        <div class="tclock num" id="tClock"></div>
        <p class="tsub" id="tSub"></p>
        <div class="tbar"><i id="tBar"></i></div>
      </div>
      ${type === 'amrap' ? `<button class="tbig" data-a="t-round">+1 ronda</button>
        <div class="tcount"><span><b class="num" id="tRounds"></b> rondas</span><button class="quiet" data-a="t-undo">Deshacer</button></div>` : ''}
      ${type === 'fortime' ? '<button class="tbig" data-a="t-done">Terminé</button>' : ''}
      <div class="tctls">${confirmEnd
        ? `<p class="sub">¿Terminar el workout?</p><div class="two"><button class="tctl" data-a="t-end-no">Seguir</button><button class="tctl danger" data-a="t-end-yes">Terminar</button></div>`
        : `<div class="two"><button class="tctl" data-a="t-pause" id="tPause"></button><button class="tctl danger" data-a="t-end">Terminar</button></div>`}</div>`;
    updateRun(view);
  }
  function summary(view) {
    const { type } = run.config;
    const reason = run.finishReason;
    let title = 'Completado', big = formatClock(view.workElapsed), detail = '';
    if (reason === 'stopped') { title = 'Terminado antes'; detail = `Tiempo de trabajo ${formatClock(view.workElapsed)}`; }
    if (type === 'amrap') { big = `${run.rounds}`; detail = `${run.rounds === 1 ? 'ronda' : 'rondas'} en ${formatClock(view.workElapsed)}`; }
    if (type === 'fortime' && reason === 'done') { title = 'Tu tiempo'; detail = `Límite ${formatClock(run.config.cap)}`; }
    if (type === 'fortime' && reason === 'cap') { title = 'Llegaste al límite'; detail = 'Se acabó el tiempo'; }
    if ((type === 'emom' || type === 'tabata') && reason !== 'stopped') detail = `${view.plan.totalRounds} rondas`;
    return `<div class="tstage tsum"><p class="tphase">${title}</p><div class="tclock num">${big}</div><p class="tsub">${detail}</p></div>`;
  }
  function phaseOf(view) {
    if (view.paused) return 'En pausa';
    if (view.segment.kind === 'prep') return 'Prepárate';
    return view.segment.kind === 'rest' ? 'Descanso' : 'Trabajo';
  }
  function clockOf(view) {
    if (run.config.type === 'fortime' && view.segment.kind !== 'prep') return formatClock(view.workElapsed);
    return formatClock(view.segmentRemaining, { ceil: true });
  }
  function updateRun(view) {
    if (!$('#tClock')) return;
    const { type } = run.config;
    const t = TEMPLATES[type];
    const remaining = formatClock(view.workRemaining, { ceil: true });
    let sub = `Quedan ${remaining}`;
    if (view.segment.kind === 'prep') sub = `Empieza ${t.name}`;
    else if (type === 'emom' || type === 'tabata') sub = `Ronda ${view.segment.round} de ${view.plan.totalRounds} · quedan ${remaining}`;
    else if (type === 'fortime') sub = `Límite ${formatClock(run.config.cap)}`;
    $('#tPhase').textContent = phaseOf(view);
    $('#tClock').textContent = clockOf(view);
    $('#tSub').textContent = sub;
    $('#tBar').style.width = `${Math.min(100, (view.segmentElapsed / view.segment.duration) * 100)}%`;
    $('#tStage').dataset.kind = view.paused ? 'paused' : view.segment.kind;
    if ($('#tPause')) $('#tPause').textContent = view.paused ? 'Reanudar' : 'Pausa';
    if ($('#tRounds')) $('#tRounds').textContent = run.rounds;
  }

  /* ---------- Compact indicator ---------- */
  function updatePill(view) {
    const pill = $('#timerPill');
    const show = isActive() && !runOpen();
    pill.classList.toggle('hidden', !show);
    if (!show) return;
    view ??= snapshot(run, Date.now());
    const { type } = run.config;
    let label = TEMPLATES[type].name;
    if (view.paused) label = 'En pausa';
    else if (view.segment.kind === 'prep') label = 'Prepárate';
    else if (type === 'emom' || type === 'tabata') label = `R${view.segment.round}/${view.plan.totalRounds}`;
    pill.style.setProperty('--c', `var(${TEMPLATES[type].color})`);
    pill.innerHTML = `<i class="dot"></i><b class="num">${clockOf(view)}</b><span>${label}</span>`;
    pill.setAttribute('aria-label', `Timer ${TEMPLATES[type].name}: ${clockOf(view)}, ${label}. Abrir timer`);
  }
  function updateLive(view) {
    if (!isActive()) return;
    view ??= snapshot(run, Date.now());
    if ($('#tCurClock')) $('#tCurClock').textContent = clockOf(view);
    updatePill(view);
    if (runOpen()) updateRun(view);
  }

  /* ---------- Clock loop ---------- */
  function tick() {
    if (!isActive()) return;
    const view = snapshot(run, Date.now());
    if (!view.paused) {
      // Skip cues missed while the page was suspended instead of replaying a burst.
      const gap = view.elapsed - lastElapsed;
      if (gap > 0 && gap <= 1500) {
        const cues = cuesBetween(view.plan, lastElapsed, view.elapsed);
        if (cues.length) sound.play(cues[cues.length - 1].cue);
      }
      lastElapsed = view.elapsed;
    }
    if (view.done) { complete(); return; }
    updateLive(view);
  }
  function complete() {
    run = finish(run, Date.now(), run.config.type === 'fortime' ? 'cap' : 'complete');
    confirmEnd = false;
    saveRun();
    sync();
    openRun();
  }
  function sync() {
    const active = isActive();
    setWake(active);
    if (active && !intervalId) intervalId = setInterval(tick, 200);
    if (!active && intervalId) { clearInterval(intervalId); intervalId = null; }
    document.body.classList.toggle('has-timer', active);
    updatePill();
    if (isActiveTab()) renderView();
  }

  function begin(config) {
    sound.unlock();
    run = start(config, Date.now());
    lastElapsed = 0;
    confirmEnd = false;
    saveRun();
    sync();
    openRun();
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-a^="t-"]');
    if (!target || target.disabled) return;
    const action = target.dataset.a;
    const now = Date.now();
    sound.unlock();   // every tap is a chance to (re)unlock audio on iOS
    switch (action) {
      case 't-cfg': openConfig(target.dataset.v); break;
      case 't-step': {
        const [key, direction] = target.dataset.v.split(':');
        editing = normalizeConfig({ ...editing, [key]: stepValue(key, editing[key], +direction) });
        renderConfig(); break;
      }
      case 't-start':
        configs[editing.type] = normalizeConfig(editing);
        write(configKey, configs);
        $('#timerCfg').classList.remove('open');
        begin(configs[editing.type]); break;
      case 't-open': openRun(); break;
      case 't-min': $('#timerRun').classList.remove('open'); updatePill(); if (isActiveTab()) renderView(); break;
      case 't-pause': run = snapshot(run, now).paused ? resume(run, now) : pause(run, now); saveRun(); renderRun(); updatePill(); break;
      case 't-end': confirmEnd = true; renderRun(); break;
      case 't-end-no': confirmEnd = false; renderRun(); break;
      case 't-end-yes': run = finish(run, now, 'stopped'); confirmEnd = false; saveRun(); sync(); renderRun(); break;
      case 't-round': run = addRound(run); saveRun(); updateLive(); break;
      case 't-undo': run = undoRound(run); saveRun(); updateLive(); break;
      case 't-done': run = finish(run, now, 'done'); saveRun(); sync(); renderRun(); break;
      case 't-clear': run = null; saveRun(); $('#timerRun').classList.remove('open'); sync(); break;
      case 't-repeat': begin(run.config); break;
    }
  }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); }, { signal });

  // A run that ended while the app was closed shows its summary; an acknowledged one is discarded.
  if (run && run.finalElapsed !== null) { run = null; saveRun(); }
  if (run) {
    const view = snapshot(run, Date.now());
    lastElapsed = view.elapsed;
    if (view.done) complete(); else sync();
  }

  return {
    renderView,
    destroy() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      sound.close();
      document.body.classList.remove('has-timer');
    },
  };
}
