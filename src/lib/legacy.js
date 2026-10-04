export function initLegacyApp(hasBackend){
const controller = new AbortController();
const { signal } = controller;
/* =========================================================
   CATÁLOGO — agrega/quita categorías y movimientos aquí
   type: 'weight' (lb, mayor es mejor, con 1RM/3RM/5RM) | 'time' (menor es mejor)
   ========================================================= */
const LB_TO_KG = 0.45359237;
const RMS = [1, 3, 5];
const CATALOG = {
  Lift: { type:'weight', groups: [
    { name:'Squats',    color:'--red',    moves:['Back Squat','Front Squat','Overhead Squat'] },
    { name:'Cleans',    color:'--blue',   moves:['Clean','Hang Power Clean','Hang Squat Clean','Muscle Clean','Power Clean','Squat Clean'] },
    { name:'Presses',   color:'--amber',  moves:['Strict Press','Push Press','Bench Press'] },
    { name:'Jerks',     color:'--green',  moves:['Push Jerk','Split Jerk','Clean & Jerk'] },
    { name:'Snatches',  color:'--purple', moves:['Snatch','Power Snatch','Hang Power Snatch','Squat Snatch'] },
    { name:'Deadlifts', color:'--teal',   moves:['Deadlift','Sumo Deadlift'] },
  ]},
  Cardio: { type:'time', groups: [
    { name:'Run',  color:'--red',   moves:['400 m','1 mile','5 km'] },
    { name:'Row',  color:'--teal',  moves:['500 m Row','2 km Row'] },
    { name:'Bike', color:'--amber', moves:['50 cal Bike'] },
  ]},
  Benchmarks: { type:'time', groups: [
    { name:'Girls',  color:'--purple', moves:['Fran','Grace','Isabel','Helen','Diane'] },
    { name:'Heroes', color:'--red',    moves:['Murph','DT'] },
  ]},
};

/* Barra y discos */
const ALL_PLATES = [55, 45, 35, 25, 15, 10, 5, 2.5];
const BARS = [45, 35, 15];
const DEFAULT_PCT = 70;   // % con el que arranca cada movimiento
const QUICK_PCTS = [50, 60, 65, 70, 75, 80, 85, 90, 95, 100];   // opciones rápidas de %
const PCTS = [40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105];
const LADDER_MIN = 25;          // disco con el que empieza la escalera
const PREFERRED_TOP = 45;       // en empate, arma con discos de 45
const MAX_PLATES_SIDE = 8;
const PLATE_STYLE = {           // color y alto visual (%)
  55:['--red',100], 45:['--blue',100], 35:['--amber',92], 25:['--green',84],
  15:['--purple',74], 10:['--p10',64], 5:['--p5',48], 2.5:['--p25s',38]
};

/* Íconos */
const I = {
  bolt:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 8v8M8 12h8"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  hash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
  barbell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6v12M2.5 9v6M18 6v12M21.5 9v6M6 12h12"/></svg>',
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};

/* =========================================================
   CAPA DE DATOS — peso SIEMPRE en lb; rm = 1 | 3 | 5 (vacío en tiempos)
   ========================================================= */
const DEMO = !hasBackend;
const DEMO_RECORDS = [
  { move:'Back Squat', value:225, rm:1, date:'2025-11-10' },
  { move:'Back Squat', value:240, rm:1, date:'2026-02-14' },
  { move:'Back Squat', value:250, rm:1, date:'2026-05-20' },
  { move:'Back Squat', value:260, rm:1, date:'2026-08-30' },
  { move:'Back Squat', value:225, rm:3, date:'2026-04-02' },
  { move:'Back Squat', value:235, rm:3, date:'2026-07-15' },
  { move:'Back Squat', value:215, rm:5, date:'2026-06-10' },
  { move:'Front Squat', value:215, rm:1, date:'2026-07-04' },
  { move:'Squat Clean', value:165, rm:1, date:'2026-09-01' },
  { move:'Bench Press', value:140, rm:1, date:'2026-04-22' },
  { move:'Fran', value:312, date:'2026-03-15' },
  { move:'Fran', value:285, date:'2026-08-10' },
];

// La clave se guarda solo en este dispositivo. Sin clave, la app muestra datos de ejemplo.
function getKey(){ try { return (localStorage.getItem('prs_key') || '').trim(); } catch { return ''; } }
function setKey(k){ try { localStorage.setItem('prs_key', k.trim()); } catch {} }
function forgetKey(){ try { localStorage.removeItem('prs_key'); } catch {} }
const usingDemo = () => DEMO || !getKey();

// POST con text/plain para evitar el preflight CORS de Apps Script
async function call(action, payload = {}){
  const res = await fetch('/api/apps-script', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key:getKey(), action, ...payload }) });
  const data = await res.json();
  if (data.error){
    if (data.error === 'unauthorized') forgetKey();
    throw new Error(data.error === 'unauthorized' ? 'Clave incorrecta. Mostrando datos de ejemplo.' : data.error);
  }
  return data;
}

async function uploadVideo(file, onProgress){
  const { uploadUrl } = await call('uploadUrl', { name:file.name, mimeType:file.type || 'video/mp4', size:file.size, origin:location.origin });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(Math.round(e.loaded / e.total * 100));
    xhr.onload = () => xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error('Error al subir el video (' + xhr.status + ')'));
    xhr.onerror = () => reject(new Error('Error de red al subir el video'));
    xhr.send(file);
  });
}

const demoApi = {
  async getRecords(){ return DEMO_RECORDS.map(r => ({ ...r })); },
  async addRecord(rec, file){ if (file) rec.video = URL.createObjectURL(file); return rec; }   // solo en memoria
};
const liveApi = {
  async getRecords(){ return (await call('list')).records; },
  async addRecord(rec, file, onProgress){
    if (file) rec.videoId = (await uploadVideo(file, onProgress)).id;
    return (await call('add', { record: rec })).record;
  }
};
const api = {
  getRecords: (...a) => (usingDemo() ? demoApi : liveApi).getRecords(...a),
  addRecord:  (...a) => (usingDemo() ? demoApi : liveApi).addRecord(...a),
};

/* =========================================================
   ESTADO (se guarda en el dispositivo para retomar al desbloquear)
   ========================================================= */
const $ = s => document.querySelector(s);
const store = {
  get(k, d){ try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || '{}')); } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let RECORDS = [];
let LOADING = true, LOAD_ERR = '';
const S = store.get('prs_settings', { bar:45, plates:[...ALL_PLATES], lastPct:70, wake:true, simple:false, tab:'exec' });
const EX = store.get('prs_exec', { view:'pick', cat:null, move:null, free:false, rm:1, base:0, pct:80, adj:0, extra:[], minus:[], editBase:false, sel:0, panel:'load', done:[], key:'', ts:0 });
EX.adj = 0; EX.custom = null;   // (obsoletos) el ajuste vive en EX.extra / EX.minus
const UI = { prsTab:'Lift', prsGroup:null, move:null, rm:1 };
const saveS = () => store.set('prs_settings', S);
const saveEX = () => { EX.ts = Date.now(); store.set('prs_exec', EX); };
if (Date.now() - (EX.ts || 0) > 8 * 3600e3 && EX.view !== 'pick') { EX.view = 'pick'; EX.done = []; }   // sesión vieja

/* =========================================================
   UTILIDADES
   ========================================================= */
const info = move => {
  for (const t in CATALOG) for (const g of CATALOG[t].groups) if (g.moves.includes(move)) return { tab:t, type:CATALOG[t].type, group:g };
  return { tab:null, type:'weight', group:{ name:'Otros', color:'--muted' } };
};
const num2 = x => (Math.round(x * 100) / 100).toLocaleString('es-CR');
const num = x => (Math.round(x * 10) / 10).toLocaleString('es-CR');
const toKg = lb => num(lb * LB_TO_KG);
const round5 = x => Math.round(x / 5) * 5;          // 192.5 → 195 · 197.8 → 200
const sum = a => a.reduce((s, p) => s + p, 0);
const fmt = (v, type) => {
  if (v == null) return '';
  if (type === 'time'){ const m = Math.floor(v/60), s = String(Math.round(v%60)).padStart(2,'0'); return `${m}:${s}`; }
  return `${v} lb`;
};
const parseValue = (str, type) => {
  if (type === 'time'){ const [m,s] = str.split(':').map(Number); return s == null ? m : m*60 + s; }
  return parseFloat(str.replace(',', '.'));
};
const recordsOf = (move, rm) => {
  const { type } = info(move);
  return RECORDS.filter(r => r.move === move && (type !== 'weight' || (r.rm || 1) === rm));
};
const best = (move, rm = 1) => {
  const { type } = info(move);
  const rs = recordsOf(move, rm);
  if (!rs.length) return null;
  return rs.reduce((a,b) => (type === 'time' ? b.value < a.value : b.value > a.value) ? b : a);
};
const firstRm = m => RMS.find(n => best(m, n));
const hasPR = m => !!firstRm(m);
const fmtDate = d => new Date(d + 'T12:00').toLocaleDateString('es-CR', { day:'numeric', month:'short', year:'numeric' });
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };

/* =========================================================
   DISCOS — combinaciones y escalera
   ========================================================= */
function plateCombos(perSide){
  const ps = [...S.plates].sort((a,b) => b - a), out = [];
  (function dfs(rem, start, cur){
    if (out.length > 4000) return;
    if (Math.abs(rem) < 1e-6) { out.push([...cur]); return; }
    if (cur.length >= MAX_PLATES_SIDE) return;
    for (let i = start; i < ps.length; i++)
      if (ps[i] <= rem + 1e-6) { cur.push(ps[i]); dfs(rem - ps[i], i, cur); cur.pop(); }
  })(perSide, 0, []);
  return out;
}
function plateOptions(target){
  const perSide = (target - S.bar) / 2;
  if (perSide <= 0) return [{ label:'Solo la barra', plates:[] }];
  const byTop = new Map();
  for (const c of plateCombos(perSide)) { const b = byTop.get(c[0]); if (!b || c.length < b.length) byTop.set(c[0], c); }
  const all = [...byTop.values()];
  if (!all.length) return [];
  const pref = c => c[0] === PREFERRED_TOP ? 0 : 1;
  const rec = [...all].sort((a,b) => a.length - b.length || pref(a) - pref(b) || b[0] - a[0])[0];
  const rest = all.filter(c => c !== rec).sort((a,b) => b[0] - a[0]);
  return [rec, ...rest].slice(0, 4).map((p, i) => ({ label: i === 0 ? 'Recomendado' : `Con ${p[0]}s`, plates:p }));
}
function buildLadder(final){
  const steps = [], bar = S.bar;
  const add = (plates, note) => steps.push({ plates:[...plates], total: bar + 2 * sum(plates), note });
  add([], 'Barra sola');
  if (!final.length) return steps;
  const top = final[0];
  let prev = null;
  if (top >= LADDER_MIN)
    for (const p of [...S.plates].sort((a,b) => a - b))
      if (p >= LADDER_MIN && p < top) { add([p], prev == null ? `Pon ${p}s` : `Cambia ${prev} → ${p}`); prev = p; }
  const cur = [top];
  add(cur, prev == null ? `Pon ${top}s` : `Cambia ${prev} → ${top}`);
  for (let i = 1; i < final.length; i++) { cur.push(final[i]); add(cur, `Agrega ${final[i]}s`); }
  return steps;
}
const plateEl = (it, idx, small) => {
  const [c, h] = PLATE_STYLE[it.p] || ['--line', 50];
  return `<i class="pl ${small ? 's' : ''} ${it.x ? 'x' : ''}" style="--h:${h}%;--pc:var(${c})" ${S.simple ? '' : `data-a="rmp" data-v="${idx}"`}>${it.p}</i>`;
};
const miniPlates = plates => `<div class="mini">${plates.map(p => {
  const [c, h] = PLATE_STYLE[p] || ['--line', 50];
  return `<i style="height:${Math.round(h * .26)}px;--pc:var(${c})"></i>`; }).join('')}</div>`;

/* =========================================================
   EXECUTE
   La carga = opción recomendada − discos quitados + discos extra.
   Los extra se conservan al pasar entre opciones recomendadas.
   ========================================================= */
const msub = (a, b) => { const r = [...a]; for (const x of b) { const i = r.indexOf(x); if (i >= 0) r.splice(i, 1); } return r; };
const adjusted = () => !S.simple && (EX.extra.length > 0 || EX.minus.length > 0);
const resetAdj = () => { EX.extra = []; EX.minus = []; };
if (!Array.isArray(EX.extra)) EX.extra = [];
if (!Array.isArray(EX.minus)) EX.minus = [];

function calc(){
  const raw = EX.base * EX.pct / 100;
  const start = Math.max(S.bar, round5(raw));
  const opts = plateOptions(start);                  // las opciones salen del peso del %, no cambian al ajustar
  if (EX.sel >= opts.length || S.simple) EX.sel = 0;
  if (!opts.length) return { raw, start, target:start, opts, plates:null, items:[], ladder:[] };
  const kept = S.simple ? opts[0].plates : msub(opts[EX.sel].plates, EX.minus);
  const extra = S.simple ? [] : EX.extra;
  const items = [...kept.map(p => ({ p, x:false })), ...extra.map(p => ({ p, x:true }))]
    .sort((a,b) => b.p - a.p || a.x - b.x);           // por peso; a igual peso, el extra va afuera
  const plates = items.map(i => i.p);
  const target = S.bar + 2 * sum(plates);
  const ladder = buildLadder(plates);
  const key = `${target}|${plates.join(',')}|${S.bar}`;
  if (EX.key !== key) { EX.key = key; EX.done = []; }   // nueva carga = escalera nueva
  return { raw, start, target, opts, plates, items, ladder };
}

// Guarda una carga deseada como diferencia contra la opción recomendada actual
function setLoad(cur, opts){
  const base = opts.length ? opts[EX.sel].plates : [];
  EX.extra = msub(cur, base).sort((a,b) => b - a);
  EX.minus = msub(base, cur);
  updateRun();
}

// Ajuste rápido del total (±5 / ±10)
function nudge(d){
  const { opts, plates, items, target } = calc();
  if (!plates) return;
  const per = Math.abs(d) / 2, next = target + d;
  if (next < S.bar) return;
  if (d > 0) {
    if (S.plates.includes(per)) { EX.extra.push(per); EX.extra.sort((a,b) => b - a); updateRun(); }
    else setLoad(plateOptions(next)[0]?.plates || plates, opts);
    return;
  }
  const xi = EX.extra.lastIndexOf(per);
  if (xi >= 0) { EX.extra.splice(xi, 1); updateRun(); return; }            // primero quita un extra
  if (plates.includes(per)) { EX.minus.push(per); updateRun(); return; }   // luego uno de la opción
  setLoad(plateOptions(next)[0]?.plates || plates, opts);                  // si no hay ese disco, recalcula
}

function renderExec(){
  const v = $('#vExec');
  const run = EX.view === 'run';
  const dock = false;   // el % se define arriba, junto al peso, en ambos modos
  document.body.classList.toggle('focus', run && S.tab === 'exec' && !!S.simple);   // modo simple: sin barra de navegación
  document.body.classList.toggle('docked', dock);
  $('#dock').classList.toggle('hidden', !dock);
  wake(run && S.tab === 'exec');

  if (EX.view === 'pick') {
    const canResume = EX.base > 0 && (EX.move || EX.free);
    let resume = '';
    if (canResume) {
      const { target } = calc();
      resume = `<button class="resume" data-a="resume">
        <div><small>Continuar</small><b>${EX.free ? 'Cálculo libre' : EX.move} · ${num(EX.pct)}%</b></div>
        <div class="go num">${target} lb</div></button>`;
    }
    v.innerHTML = `
      <div class="hdr"><h1>Execute</h1><p>¿Qué vas a levantar?</p></div>
      ${banner()}
      ${resume}
      <div class="grid2">${CATALOG.Lift.groups.map(g => {
        const n = g.moves.filter(hasPR).length;
        return `<button class="cat" style="--c:var(${g.color})" data-a="cat" data-v="${g.name}">
          <b>${g.name}</b><small>${n ? `${n} con PR` : 'Sin PRs'}</small></button>`; }).join('')}
      </div>
      <button class="freecard" data-a="free">${I.pencil} Cálculo libre</button>`;
    return;
  }

  if (EX.view === 'moves') {
    const g = CATALOG.Lift.groups.find(x => x.name === EX.cat) || CATALOG.Lift.groups[0];
    const withPR = g.moves.filter(hasPR), without = g.moves.filter(m => !hasPR(m));
    const row = m => {
      const rm = firstRm(m);
      return `<button class="mrow" data-a="move" data-v="${m}" ${rm ? '' : 'disabled'}>
        <span><i class="dot" style="--c:var(${rm ? g.color : '--line'})"></i>${m}</span>
        <span class="v">${rm ? `${best(m, rm).value} lb${rm > 1 ? `<small>${rm}RM</small>` : ''}` : 'Sin PR'}</span></button>`;
    };
    v.innerHTML = `
      <div class="navbar"><button class="nbtn" data-a="pick">${I.back} Execute</button><div class="ttl">${g.name}</div><span></span></div>
      ${withPR.length ? `<div class="list" style="margin-top:8px">${withPR.map(row).join('')}</div>` : `<p class="empty">Aún no tienes PRs en ${g.name}</p>`}
      ${without.length ? `<div class="sec">Sin PR registrado</div><div class="list">${without.map(row).join('')}</div>` : ''}
      <button class="freecard" data-a="free" style="margin-top:18px">${I.pencil} Cálculo libre</button>`;
    return;
  }

  // ---- Pantalla de trabajo ----
  const ttl = EX.free ? 'Cálculo libre' : EX.move;
  const ctx = '';
  v.innerHTML = `
    <div class="navbar">
      <button class="nbtn" data-a="${EX.free ? 'pick' : 'backmoves'}">${I.back} ${EX.free ? 'Execute' : (info(EX.move).group.name)}</button>
      <div class="ttl">${ttl}</div>
      <div class="nbtn r">${EX.free
        ? `<button data-a="clear" style="font-size:16px;color:var(--muted)">Limpiar</button>`
        : `<button data-a="free" aria-label="Cálculo libre">${I.pencil}</button>`}<button data-a="settings" aria-label="Barra y discos">${I.gear}</button></div>
    </div>
    <div class="zone">
      <div class="zhead"><span>${I.hash} Peso total</span><span class="kgv num" id="kgv"></span></div>
      <div class="ctx" id="ctx">${ctx}</div>
      <div class="hero" id="hero"></div>
    </div>
    <div id="lower" class="${S.simple ? 'simple' : ''}">
      <div class="seg ${S.simple ? 'hidden' : ''}">
        <button class="${EX.panel==='load'?'on':''}" data-a="panel" data-v="load">Barra</button>
        <button class="${EX.panel==='warm'?'on':''}" data-a="panel" data-v="warm">Calentamiento</button>
      </div>
      <div id="panel"></div>
    </div>`;
  renderBase();
  updateRun();
}

// Línea de contexto (ambos modos): base y % compactos; el lápiz abre la edición.
//   Movimiento:    1RM · 260 lb · 80%  ✎   → editar RM y %
//   Cálculo libre: 260 lb · 80%  ✎         → editar peso y %
function renderBase(){
  const ctx = $('#ctx');
  const rmTag = EX.free ? '' : `<span>${EX.rm}RM</span> · `;
  if (EX.base > 0 && !EX.editBase) {
    ctx.innerHTML = `<button class="basebtn" data-a="editbase">${rmTag}<b class="num">${num(EX.base)} lb</b> · <b class="num">${num(EX.pct)}%</b>${I.pencil}</button>`;
    return;
  }
  const baseField = EX.free
    ? `<input class="baseIn num" id="baseIn" inputmode="decimal" placeholder="Peso" value="${EX.base || ''}"><span class="base">lb</span>`
    : `<div class="rms">${RMS.map(n => `<button class="${n===EX.rm?'on':''}" data-a="rm" data-v="${n}" ${best(EX.move,n)?'':'disabled'}>${n}RM</button>`).join('')}</div>`;
  ctx.innerHTML = `
    ${baseField}
    <button class="okbtn ok" data-a="basedone" aria-label="Listo">${I.check}</button>
    <div class="pstep">
      <button class="num m" data-a="pstep" data-v="-10">−10</button>
      <button class="num m" data-a="pstep" data-v="-5">−5</button>
      <div class="pv"><input class="num" id="pctIn" inputmode="decimal" value="${num(EX.pct)}"><span>%</span></div>
      <button class="num" data-a="pstep" data-v="5">+5</button>
      <button class="num" data-a="pstep" data-v="10">+10</button>
    </div>`;
  const inp = $('#baseIn'), pin = $('#pctIn');
  if (inp) inp.oninput = e => { EX.base = parseFloat(e.target.value.replace(',', '.')) || 0; resetAdj(); updateRun(); };
  pin.oninput = e => { const n = parseFloat(e.target.value.replace(',', '.')); if (n > 0) { EX.pct = n; S.lastPct = n; saveS(); resetAdj(); updateRun(); } };
  [inp, pin].forEach(el => el && (el.onkeydown = e => { if (e.key === 'Enter') closeBase(); }));
  if (EX.free && !EX.base) setTimeout(() => inp.focus(), 60);
}
function markQuick(){
  document.querySelectorAll('.qp button').forEach(b => b.classList.toggle('on', +b.dataset.v === EX.pct));
}
function closeBase(){
  if (!(EX.base > 0)) { $('#baseIn')?.focus(); return; }
  EX.editBase = false; document.activeElement?.blur(); renderBase(); saveEX();
}

function renderStrip(){
  const custom = !PCTS.includes(EX.pct);
  $('#pstrip').innerHTML = PCTS.map(p => `<button class="num ${p===EX.pct?'on':''}" data-a="pct" data-v="${p}">${p}%</button>`).join('')
    + `<button class="other ${custom?'on':''}" data-a="pctother">${custom ? num(EX.pct) + '%' : 'Otro'}</button>`;
  const on = $('#pstrip .on');
  if (on) on.scrollIntoView({ inline:'center', block:'nearest' });
}

function updateRun(){
  const hero = $('#hero'), panel = $('#panel');
  if (!hero) return;
  if (!EX.base) {
    hero.innerHTML = `<p class="empty">${EX.free ? 'Escribe un peso y el porcentaje para empezar' : 'Sin PR para este RM'}</p>`;
    $('#kgv').textContent = '';
    $('#lower').classList.add('hidden');
    panel.innerHTML = ''; saveEX(); return;
  }
  $('#lower').classList.remove('hidden');
  const { raw, start, target, opts, plates, items, ladder } = calc();
  const diff = target - start;
  $('#kgv').textContent = `${toKg(target)} kg`;
  hero.innerHTML = `
    <div class="w num">${target}<span>lb</span></div>
    <div class="s num">${num(adjusted() ? target / EX.base * 100 : EX.pct)}% de ${num(EX.base)} lb</div>
    <div class="exact num">${num(EX.pct)}% exacto = ${num2(raw)} lb · ${target} lb es el ${num2(target / EX.base * 100)}%</div>
    ${adjusted() ? `<div class="adjpill num">${diff ? `${diff > 0 ? '+' : '−'}${num(Math.abs(diff))} lb sobre ${num(EX.pct)}%` : 'Carga ajustada'}<button data-a="adjreset" aria-label="Volver al ${num(EX.pct)}%">${I.x}</button></div>` : ''}`;

  if (EX.panel === 'load' || S.simple) {
    if (!plates) { panel.innerHTML = `<p class="empty">No se puede armar ${target} lb con tus discos.<br>Revisa ⚙ Barra y discos.</p>`; saveEX(); return; }
    const o = opts[EX.sel];
    const small = plates.length > 5;
    panel.innerHTML = `
      <div class="loadcard">
        <div class="zhead"><span>${I.barbell} Por lado · <b class="num" style="color:var(--text)">${num(sum(plates))} lb</b></span><span class="kgv">Barra ${S.bar} lb</span></div>
        <div class="bigbar"><span class="collar num">${S.bar}</span>${plates.length ? items.map((it, i) => plateEl(it, i, small)).join('') : '<span class="empty">Solo la barra</span>'}</div>
        ${!S.simple && opts.length > 1 ? `
        <div class="optnav">
          <button data-a="opt" data-v="-1" ${EX.sel === 0 ? 'disabled' : ''} aria-label="Anterior">${I.back}</button>
          <div class="mid"><b>${o.label}${EX.extra.length ? ' + extra' : ''}</b><div class="dots">${opts.map((_, i) => `<i class="${i===EX.sel?'on':''}"></i>`).join('')}</div></div>
          <button data-a="opt" data-v="1" ${EX.sel === opts.length - 1 ? 'disabled' : ''} aria-label="Siguiente">${I.next}</button>
        </div>` : ''}
        ${S.simple ? '' : `<div class="adjrow">${[...S.plates].sort((a,b) => a - b).map(p => `<button class="num" style="--pc:var(${(PLATE_STYLE[p] || ['--gray'])[0]})" data-a="addp" data-v="${p}">+${p}</button>`).join('')}</div>
        <p class="hint">Toca un color para agregar · toca un disco para quitarlo</p>`}
      </div>`;
  } else {
    const nextIdx = ladder.findIndex((_, i) => !EX.done.includes(i));
    panel.innerHTML = `
      <div class="steps">${ladder.map((s, i) => {
        const goal = i === ladder.length - 1, done = EX.done.includes(i);
        return `<button class="step ${done?'done':''} ${i===nextIdx?'next':''} ${goal?'goal':''}" data-a="step" data-v="${i}">
          <span class="chk">${I.check}</span>
          <span><b class="num">${s.total}</b><small class="num">${Math.round(s.total / EX.base * 100)}%${goal ? ' · objetivo' : ''}</small></span>
          <span class="note">${miniPlates(s.plates)}${s.note}</span></button>`; }).join('')}
      </div>
      ${EX.done.length ? `<div class="warmfoot"><button data-a="warmreset">Reiniciar escalera</button></div>` : ''}`;
  }
  saveEX();
}

function selectMove(m){
  Object.assign(EX, { view:'run', move:m, free:false, cat:info(m).group.name, extra:[], minus:[], sel:0, panel:'load', done:[] });
  EX.rm = firstRm(m) || 1;
  EX.base = best(m, EX.rm)?.value || 0;
  EX.pct = DEFAULT_PCT;
  EX.editBase = true;
  renderExec();
  window.scrollTo(0, 0);
}
function goFree(){
  // Conserva base, % y ajuste: el peso actual pasa tal cual al cálculo libre
  Object.assign(EX, { view:'run', free:true, editBase:false });
  window.scrollTo(0, 0);
  renderExec();
}

/* Pantalla encendida */
let wakeLock = null, wantWake = false;
async function wake(on){
  wantWake = on && S.wake !== false;
  try {
    if (wantWake && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!wantWake && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantWake) wake(true); }, { signal });

/* =========================================================
   PRs
   ========================================================= */
function banner(){
  if (LOADING) return '<div class="banner" style="color:var(--muted);background:var(--surface)">Cargando tus PRs…</div>';
  if (DEMO) return '<div class="banner">Datos de ejemplo — configura APPS_SCRIPT_URL para guardar en Google Sheets</div>';
  if (LOAD_ERR) return `<div class="banner bflex"><span>${LOAD_ERR}</span>${!getKey() ? '<button data-a="setkey">Conectar</button>' : ''}</div>`;
  if (!getKey()) return '<div class="banner bflex"><span>Estás viendo datos de ejemplo</span><button data-a="setkey">Conectar</button></div>';
  return '';
}

function renderPRs(){
  const { type, groups } = CATALOG[UI.prsTab];
  const visible = UI.prsGroup ? groups.filter(g => g.name === UI.prsGroup) : groups;
  $('#vPRs').innerHTML = `
    <div class="hdr"><h1>PRs</h1></div>
    ${banner()}
    <div class="seg three" style="margin-top:0">${Object.keys(CATALOG).map(t =>
      `<button class="${t===UI.prsTab?'on':''}" data-a="prstab" data-v="${t}">${t}</button>`).join('')}</div>
    <div class="chips">${groups.map(g => {
      const n = g.moves.filter(m => RECORDS.some(r => r.move === m)).length;
      return `<button class="chip ${g.name===UI.prsGroup?'on':''}" style="--c:var(${g.color})" data-a="prsgroup" data-v="${g.name}">
        <span>${g.name}</span><small>${n}/${g.moves.length}</small></button>`; }).join('')}</div>
    ${visible.map(g => `
      <div class="grp">
        <h3><i class="dot" style="--c:var(${g.color})"></i>${g.name}</h3>
        <div class="list">${g.moves.map(m => {
          let label = '';
          if (type === 'weight') {
            const rm = firstRm(m);
            if (rm) label = `${best(m, rm).value} lb${rm > 1 ? `<small>${rm}RM</small>` : ''}`;
          } else { const b = best(m); if (b) label = fmt(b.value, type); }
          return `<button class="mrow" data-a="detail" data-v="${m}"><span>${m}</span><span class="v">${label || '<span style="color:var(--muted);font-weight:500">—</span>'}</span></button>`;
        }).join('')}</div>
      </div>`).join('')}`;
}

let chart = null;
function openDetail(move, rm){
  UI.move = move;
  const { type, group } = info(move);
  const isWeight = type === 'weight';
  UI.rm = rm || (isWeight ? (firstRm(move) || 1) : 1);
  $('#dSeg').classList.toggle('hidden', !isWeight);
  $('#dExec').classList.toggle('hidden', !isWeight || !hasPR(move));
  $('#dSeg').innerHTML = RMS.map(n => `<button class="${n===UI.rm?'on':''}" data-a="drm" data-v="${n}">${n}RM</button>`).join('');
  const rs = recordsOf(move, UI.rm).sort((a,b) => a.date.localeCompare(b.date));
  const b = best(move, UI.rm);
  $('#dCat').textContent = group.name;
  $('#dName').textContent = move;
  $('#dPR').textContent = b ? fmt(b.value, type) : '—';
  $('#dKg').textContent = b && isWeight ? `${toKg(b.value)} kg` : '';
  $('#dDate').textContent = b ? `PR del ${fmtDate(b.date)}` : 'Aún no hay registros';
  $('#dHist').innerHTML = rs.length ? rs.slice().reverse().map(r => `
    <div class="mrow"><span>${fmtDate(r.date)}<small>${isWeight ? toKg(r.value) + ' kg' : ''}${r.notes ? (isWeight ? ' · ' : '') + r.notes : ''}</small></span>
    <span class="v">${fmt(r.value, type)}${r.video ? `<a class="vid" href="${r.video}" target="_blank">▶ video</a>` : ''}</span></div>`).join('')
    : '<p class="empty" style="padding:20px">Sin registros</p>';
  if (chart) { chart.destroy(); chart = null; }
  $('.chartbox').classList.toggle('hidden', rs.length < 2);
  if (window.Chart && rs.length > 1) {
    const color = getComputedStyle(document.documentElement).getPropertyValue(group.color).trim();
    chart = new Chart($('#chart'), {
      type:'line',
      data:{ labels: rs.map(r => fmtDate(r.date)), datasets:[{ data: rs.map(r => r.value), borderColor:color, backgroundColor:color, tension:.3, pointRadius:4 }] },
      options:{ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: c => isWeight ? `${c.raw} lb · ${toKg(c.raw)} kg` : fmt(c.raw, type) } } },
        scales:{ x:{ ticks:{color:'#777'}, grid:{display:false} },
                 y:{ reverse: type==='time', ticks:{ color:'#777', callback: v => fmt(v, type) }, grid:{color:'#222'} } } }
    });
  }
  $('#detail').classList.add('open');
}

/* =========================================================
   REGISTRO
   ========================================================= */
function openForm(move){
  $('#fMove').innerHTML = Object.entries(CATALOG).map(([t,c]) =>
    c.groups.map(g => `<optgroup label="${t} · ${g.name}">${g.moves.map(m => `<option ${m===move?'selected':''}>${m}</option>`).join('')}</optgroup>`).join('')
  ).join('');
  $('#fDate').value = today();
  $('#fValue').value = ''; $('#fNotes').value = ''; $('#fVideo').value = '';
  $('#fRm').value = move && UI.move === move ? UI.rm : 1;
  updateFormFields();
  $('#formSheet').classList.add('open');
}
function updateFormFields(){
  const { type } = info($('#fMove').value);
  $('#fValueLabel').textContent = type === 'time' ? 'Tiempo (mm:ss)' : 'Peso (lb)';
  $('#fValue').placeholder = type === 'time' ? '4:45' : '';
  $('#fRmWrap').classList.toggle('hidden', type !== 'weight');
}
$('#fMove').onchange = updateFormFields;
$('#form').onsubmit = async e => {
  e.preventDefault();
  const move = $('#fMove').value, { type } = info(move);
  const rec = { move, value: parseValue($('#fValue').value, type), date: $('#fDate').value, notes: $('#fNotes').value.trim() };
  if (type === 'weight') rec.rm = +$('#fRm').value;
  if (isNaN(rec.value)) return alert('Valor inválido');
  const btn = $('#fSave');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const saved = await api.addRecord(rec, $('#fVideo').files[0], p => btn.textContent = `Subiendo video… ${p}%`);
    RECORDS.push(saved);
    $('#formSheet').classList.remove('open');
    renderAll();
    if ($('#detail').classList.contains('open')) openDetail(move, rec.rm);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
};

/* =========================================================
   AJUSTES
   ========================================================= */
function renderSettings(){
  $('#sBar').innerHTML = BARS.map(b => `<button class="${b===S.bar?'on':''}" data-a="bar" data-v="${b}">${b} lb</button>`).join('');
  $('#sPlates').innerHTML = ALL_PLATES.map(p => `<button class="${S.plates.includes(p)?'on':''}" data-a="plate" data-v="${p}">${p}</button>`).join('');
  $('#sWake').classList.toggle('on', S.wake !== false);
  $('#sSimple').classList.toggle('on', !!S.simple);
  const k = !!getKey();
  $('#sKeyTxt').textContent = DEMO ? 'Ejemplo · falta APPS_SCRIPT_URL' : k ? 'Conectado a tu Google Sheets' : 'Datos de ejemplo';
  $('#sKeyBtn').textContent = k ? 'Desconectar' : 'Conectar';
  $('#sKeyBtn').dataset.a = k ? 'logout' : 'setkey';
  $('#sKeyBtn').classList.toggle('hidden', DEMO);
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */
function renderTabs(){
  $('#tabExec').innerHTML = `${I.bolt}<span>Execute</span>`;
  $('#tabPrs').innerHTML = `${I.trophy}<span>PRs</span>`;
  $('#tabAdd').innerHTML = `${I.plus}<span>Registrar</span>`;
  $('#tabExec').classList.toggle('on', S.tab === 'exec');
  $('#tabPrs').classList.toggle('on', S.tab === 'prs');
  $('#vExec').classList.toggle('hidden', S.tab !== 'exec');
  $('#vPRs').classList.toggle('hidden', S.tab !== 'prs');
}
function renderAll(){
  renderTabs();
  if (S.tab === 'exec') renderExec(); else { renderPRs(); $('#dock').classList.add('hidden'); document.body.classList.remove('docked'); wake(false); }
}
// íconos fijos de las hojas
document.querySelector('#detail [data-a="close"]').innerHTML = `${I.back} PRs`;
document.querySelector('#detail [data-a="add"]').innerHTML = I.plus;
$('#dExec').innerHTML = `${I.bolt} Execute`;

document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (!t || t.disabled) return;
  const a = t.dataset.a, v = t.dataset.v;
  switch (a) {
    case 'tab':      S.tab = v; saveS(); renderAll(); window.scrollTo(0, 0); break;
    case 'add':      openForm(v === 'detail' ? UI.move : (S.tab === 'exec' && EX.move && !EX.free ? EX.move : undefined)); break;
    case 'close':    t.closest('.sheet').classList.remove('open'); if (t.closest('#setSheet')) renderExec(); break;

    case 'cat':      EX.cat = v; EX.view = 'moves'; saveEX(); renderExec(); window.scrollTo(0, 0); break;
    case 'pick':     EX.view = 'pick'; saveEX(); renderExec(); window.scrollTo(0, 0); break;
    case 'backmoves':EX.view = 'moves'; saveEX(); renderExec(); window.scrollTo(0, 0); break;
    case 'move':     selectMove(v); break;
    case 'free':     goFree(); break;
    case 'resume':   EX.view = 'run'; renderExec(); break;
    case 'rm':       EX.rm = +v; EX.base = best(EX.move, EX.rm)?.value || 0; resetAdj(); renderBase(); updateRun(); break;
    case 'pct':      EX.pct = +v; resetAdj(); S.lastPct = EX.pct; saveS(); renderStrip(); updateRun(); break;
    case 'pctother': {
      const r = prompt('Porcentaje', PCTS.includes(EX.pct) ? '' : EX.pct);
      const n = parseFloat((r || '').replace(',', '.'));
      if (n > 0) { EX.pct = n; resetAdj(); renderStrip(); updateRun(); }
      break;
    }
    case 'panel':    EX.panel = v; renderExec(); break;
    case 'opt':      EX.sel = Math.max(0, EX.sel + +v); EX.minus = []; updateRun(); break;   // los extra se conservan
    case 'addp':     if (calc().plates) { EX.extra.push(+v); EX.extra.sort((a,b) => b - a); updateRun(); } break;
    case 'rmp': {
      const c = calc(), it = c.items[+v];
      if (!it) break;
      if (it.x) EX.extra.splice(EX.extra.indexOf(it.p), 1); else EX.minus.push(it.p);
      updateRun(); break;
    }
    case 'nudge':    nudge(+v); break;
    case 'adjreset': resetAdj(); updateRun(); break;
    case 'editbase': EX.editBase = true; renderBase(); break;
    case 'basedone': closeBase(); break;
    case 'pstep': {
      EX.pct = Math.min(150, Math.max(5, Math.round((EX.pct + +v) * 10) / 10));
      S.lastPct = EX.pct; saveS(); resetAdj();
      if ($('#pctIn')) $('#pctIn').value = num(EX.pct);
      updateRun(); break;
    }
    case 'qpct':     EX.pct = +v; S.lastPct = EX.pct; saveS(); resetAdj(); if ($('#pctIn')) $('#pctIn').value = EX.pct; markQuick(); updateRun(); break;
    case 'clear':    Object.assign(EX, { base:0, extra:[], minus:[], sel:0, done:[], editBase:true, pct:DEFAULT_PCT }); renderExec(); break;
    case 'step': {
      const i = +v;
      EX.done = EX.done.includes(i) ? EX.done.filter(x => x !== i) : [...EX.done, i];
      updateRun(); break;
    }
    case 'warmreset':EX.done = []; updateRun(); break;
    case 'settings': renderSettings(); $('#setSheet').classList.add('open'); break;
    case 'bar':      S.bar = +v; saveS(); renderSettings(); break;
    case 'plate': {
      const p = +v;
      S.plates = S.plates.includes(p) ? S.plates.filter(x => x !== p) : [...S.plates, p];
      saveS(); renderSettings(); break;
    }
    case 'wake':     S.wake = S.wake === false; saveS(); renderSettings(); break;
    case 'simple':   S.simple = !S.simple; saveS(); renderSettings(); break;
    case 'setkey': {
      const k = prompt('Clave de acceso de tu API de PRs');
      if (k && k.trim()) { setKey(k); renderSettings(); loadData(); }
      break;
    }
    case 'logout':   forgetKey(); renderSettings(); loadData(); break;

    case 'prstab':   UI.prsTab = v; UI.prsGroup = null; renderPRs(); break;
    case 'prsgroup': UI.prsGroup = UI.prsGroup === v ? null : v; renderPRs(); break;
    case 'detail':   openDetail(v); break;
    case 'drm':      openDetail(UI.move, +v); break;
    case 'dexec':    $('#detail').classList.remove('open'); S.tab = 'exec'; saveS(); renderTabs(); selectMove(UI.move); break;
  }
}, { signal });

/* =========================================================
   INICIO
   ========================================================= */
async function loadData(){
  LOADING = true; LOAD_ERR = ''; renderAll();
  try {
    const records = await api.getRecords();
    if (signal.aborted) return;
    RECORDS = records;
  }
  catch (err) {
    if (signal.aborted) return;
    LOAD_ERR = err.message === 'Failed to fetch' ? 'No se pudo conectar con tu API. Mostrando datos de ejemplo.' : err.message;
    RECORDS = await demoApi.getRecords();     // nunca queda vacía: cae a datos de ejemplo
  }
  if (signal.aborted) return;
  LOADING = false;
  renderAll();
  if ($('#detail').classList.contains('open') && UI.move) openDetail(UI.move, UI.rm);
}
renderAll();
loadData();
return () => { controller.abort(); if (chart) chart.destroy(); wake(false); };
}
