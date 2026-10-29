// Phase 1 capture: screenshots of every Execute state + DOM measurements (controls, zones, contrast, type).
// Usage: node capture.mjs <outDir> [baseUrl] [path]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';
import { movements, records } from './fixtures.mjs';

const OUT = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:3100';
const PAGE_PATH = process.argv[4] || '/ux-harness';
const SCOPE = '00000000-0000-4000-8000-000000000001';
fs.mkdirSync(OUT, { recursive: true });

// mmPerPx: physical size of one CSS px (iPhone 14/15 6.1" ≈ 0.1666 mm; 6.2" Android 360×800 ≈ 0.1796 mm).
export const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, safeTop: 47, safeBottom: 34, mmPerPx: 0.1666 },
  { name: '360x800', width: 360, height: 800, safeTop: 0, safeBottom: 0, mmPerPx: 0.1796 },
];
const MODES = ['light', 'dark'];
const SETTINGS = { bar: 45, plates: [55, 45, 35, 25, 15, 10, 5, 2.5], lastPct: 70, wake: true, simple: false, tab: 'exec' };
const EX = { view: 'pick', cat: null, move: null, free: false, rm: 1, base: 0, pct: 80, extra: [], minus: [], editBase: false, sel: 0, panel: 'load', done: [], key: '' };
const run = (patch) => ({ ...EX, view: 'run', cat: 'Squats', move: 'Back Squat', rm: 1, base: 260, pct: 75, ...patch });

export const SCENARIOS = [
  { id: '01-picker', label: 'Inicio sin cálculo previo', ex: EX },
  { id: '02-picker-resume', label: 'Inicio con «Continuar» (Deadlift 80 %)', ex: { ...EX, move: 'Deadlift', cat: 'Deadlifts', base: 330, pct: 80 } },
  { id: '03-moves-squats', label: 'Lista de movimientos de Squats', ex: { ...EX, view: 'moves', cat: 'Squats' } },
  { id: '04-run-just-selected', label: 'Recién elegido Back Squat (70 %, editor abierto)', ex: run({ pct: 70, editBase: true }) },
  { id: '05-run-75', label: 'Back Squat al 75 % (editor cerrado)', ex: run({}) },
  { id: '06-run-warmup', label: 'Escalera de calentamiento', ex: run({ panel: 'warm' }) },
  { id: '07-run-adjusted', label: 'Carga ajustada a mano (+2,5 por lado)', ex: run({ extra: [2.5] }) },
  { id: '08-run-3rm-only', label: 'Movimiento sin 1RM (Push Jerk, 3RM)', ex: run({ cat: 'Jerks', move: 'Push Jerk', rm: 3, base: 165, pct: 70, editBase: true }) },
  { id: '09-free-empty', label: 'Cálculo libre vacío', ex: { ...EX, view: 'run', free: true, base: 0, pct: 70, editBase: true } },
  { id: '10-free-185-80', label: 'Cálculo libre 185 lb al 80 %', ex: { ...EX, view: 'run', free: true, base: 185, pct: 80 } },
  { id: '11-run-bar35', label: 'Barra de 35 lb, Back Squat 75 %', ex: run({}), settings: { bar: 35 } },
  { id: '12-run-unbuildable', label: 'Peso que no se arma (solo discos de 45)', ex: run({}), settings: { plates: [45] } },
  { id: '13-run-simple', label: 'Modo simple', ex: run({}), settings: { simple: true } },
  { id: '15-run-dumbbell', label: 'Movimiento con mancuerna (DB Snatch 70 %)', ex: run({ cat: 'Mancuernas', move: 'DB Snatch', base: 60, pct: 70 }) },
  { id: '16-run-85', label: 'Back Squat al 85 % (editor abierto)', ex: run({ pct: 85, editBase: true }) },
  { id: '14-settings', label: 'Ajustes (barra y discos)', ex: EX, open: '[aria-label="Ajustes"]' },
];

// DOM measurements: interactive controls, text contrast and the largest type.
function measure() {
  const parse = (value) => {
    let m = value.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = value.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
    return [0, 0, 0, 0];
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (!a) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  const rootBg = parse(getComputedStyle(document.body).backgroundColor);
  const bgOf = (el) => {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = rootBg;
    for (const layer of layers.reverse()) bg = over(layer, bg);
    return bg;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const visible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const hiddenByAncestor = (el) => !!el.closest('[hidden],[aria-hidden="true"],[inert]') || getComputedStyle(el).visibility === 'hidden';
  const labelOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 48);

  const controls = [...document.querySelectorAll('button, a[href], input, select, [role="switch"], [role="radio"]')]
    .filter((el) => !hiddenByAncestor(el))
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => visible(r))
    .filter(({ el }) => !el.closest('.tab-lens'))
    .map(({ el, r }) => ({
      label: labelOf(el), disabled: !!el.disabled, x: r.left, y: r.top, w: r.width, h: r.height,
      font: parseFloat(getComputedStyle(el).fontSize), tag: el.tagName.toLowerCase(),
    }));

  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el) || hiddenByAncestor(el)) continue;
    seen.add(el);
    const range = document.createRange(); range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!visible(r)) continue;
    const cs = getComputedStyle(el);
    const fg0 = parse(cs.color);
    const bg = bgOf(el);
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacityOf(el)], bg);
    const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const cr = ratio(fg, bg);
    const disabled = !!el.closest('button:disabled, [aria-disabled="true"]');
    texts.push({
      text: node.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), size, weight, fg: hex(fg), bg: hex(bg),
      ratio: Math.round(cr * 100) / 100, large, required: large ? 3 : 4.5, pass: cr >= (large ? 3 : 4.5), disabled,
      align: cs.textAlign, x: r.left, y: r.top, w: r.width, h: r.height,
    });
  }
  return { controls, texts, scrollHeight: document.documentElement.scrollHeight };
}

const browser = await chromium.launch();
const manifest = [];
for (const vp of VIEWPORTS) {
  for (const mode of MODES) {
    for (const sc of SCENARIOS.filter((s) => !process.env.ONLY || process.env.ONLY.split(',').includes(s.id))) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        colorScheme: mode, reducedMotion: 'reduce', locale: 'es-CR',
      });
      await context.route('**/api/records', (route) => route.fulfill({ json: { records } }));
      await context.route('**/api/movements', (route) => route.fulfill({ json: { movements } }));
      await context.route('**/api/tour', (route) => route.fulfill({ json: {} }));
      const settings = { ...SETTINGS, ...(sc.settings || {}) };
      const ex = { ...sc.ex, ts: Date.now() };
      await context.addInitScript(({ scope, settings, ex }) => {
        localStorage.setItem(`prs_settings_${scope}`, JSON.stringify(settings));
        localStorage.setItem(`prs_exec_${scope}`, JSON.stringify(ex));
        localStorage.setItem(`prs_tour_${scope}`, JSON.stringify({ seen: true }));
        localStorage.setItem(`prs_quick_prompt_${scope}`, JSON.stringify({ seen: true }));
      }, { scope: SCOPE, settings, ex });
      const page = await context.newPage();
      await page.goto(BASE + PAGE_PATH, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: `:root{--safe-top:${vp.safeTop}px !important;--safe-bottom:${vp.safeBottom}px !important}
        nextjs-portal{display:none!important}` });
      await page.waitForSelector('.tab-bar');
      if (sc.open) { await page.click(sc.open); await page.waitForTimeout(700); }
      await page.waitForTimeout(600);
      const base = `${sc.id}_${vp.name}_${mode}`;
      await page.screenshot({ path: path.join(OUT, `${base}.png`) });
      await page.screenshot({ path: path.join(OUT, `${base}_full.png`), fullPage: true });
      const data = await page.evaluate(measure);
      fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify({ scenario: sc, viewport: vp, mode, ...data }, null, 1));
      manifest.push({ id: sc.id, label: sc.label, viewport: vp.name, mode, file: `${base}.png` });
      await context.close();
      process.stdout.write('.');
    }
  }
}
if (!process.env.ONLY) fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
await browser.close();
console.log('\ndone', manifest.length);
