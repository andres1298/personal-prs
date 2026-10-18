// Barbell loading: plate combinations, recommended options, warm-up ladder and
// the adjusted load. Pure: settings are { bar, plates }, weights in lb.

export const ALL_PLATES = [55, 45, 35, 25, 15, 10, 5, 2.5];
export const BARS = [45, 35, 15];
export const DEFAULT_PCT = 70;
const LADDER_MIN = 25;        // first plate of the warm-up ladder
const PREFERRED_TOP = 45;     // on a tie, build with 45s
const MAX_PLATES_SIDE = 8;

// Visual color token and height (%) per plate.
export const PLATE_STYLE = {
  55: ['--red', 100], 45: ['--blue', 100], 35: ['--amber', 92], 25: ['--green', 84],
  15: ['--purple', 74], 10: ['--p10', 64], 5: ['--p5', 48], 2.5: ['--p25s', 38],
};

export const sum = (list) => list.reduce((total, plate) => total + plate, 0);
export const round5 = (x) => Math.round(x / 5) * 5;   // 192.5 → 195 · 197.8 → 200

// Multiset difference: a minus each element of b once.
export function subtractPlates(a, b) {
  const rest = [...a];
  for (const plate of b) {
    const index = rest.indexOf(plate);
    if (index >= 0) rest.splice(index, 1);
  }
  return rest;
}

function plateCombos(perSide, available) {
  const plates = [...available].sort((a, b) => b - a);
  const out = [];
  (function dfs(remaining, start, current) {
    if (out.length > 4000) return;
    if (Math.abs(remaining) < 1e-6) { out.push([...current]); return; }
    if (current.length >= MAX_PLATES_SIDE) return;
    for (let i = start; i < plates.length; i++) {
      if (plates[i] <= remaining + 1e-6) { current.push(plates[i]); dfs(remaining - plates[i], i, current); current.pop(); }
    }
  })(perSide, 0, []);
  return out;
}

// Up to four ways to load `target`, the recommended one first.
export function plateOptions(target, { bar, plates }) {
  const perSide = (target - bar) / 2;
  if (perSide <= 0) return [{ label: 'Solo la barra', plates: [] }];
  const byTop = new Map();
  for (const combo of plateCombos(perSide, plates)) {
    const current = byTop.get(combo[0]);
    if (!current || combo.length < current.length) byTop.set(combo[0], combo);
  }
  const all = [...byTop.values()];
  if (!all.length) return [];
  const preference = (combo) => (combo[0] === PREFERRED_TOP ? 0 : 1);
  const recommended = [...all].sort((a, b) => a.length - b.length || preference(a) - preference(b) || b[0] - a[0])[0];
  const rest = all.filter((combo) => combo !== recommended).sort((a, b) => b[0] - a[0]);
  return [recommended, ...rest].slice(0, 4).map((combo, i) => ({ label: i === 0 ? 'Recomendado' : `Con ${combo[0]}s`, plates: combo }));
}

export function buildLadder(final, { bar, plates }) {
  const steps = [];
  const add = (loaded, note) => steps.push({ plates: [...loaded], total: bar + 2 * sum(loaded), note });
  add([], 'Barra sola');
  if (!final.length) return steps;
  const top = final[0];
  let previous = null;
  if (top >= LADDER_MIN) {
    for (const plate of [...plates].sort((a, b) => a - b)) {
      if (plate >= LADDER_MIN && plate < top) {
        add([plate], previous == null ? `Pon ${plate}s` : `Cambia ${previous} → ${plate}`);
        previous = plate;
      }
    }
  }
  const current = [top];
  add(current, previous == null ? `Pon ${top}s` : `Cambia ${previous} → ${top}`);
  for (let i = 1; i < final.length; i++) { current.push(final[i]); add(current, `Agrega ${final[i]}s`); }
  return steps;
}

// The load is the selected option minus removed plates plus extra plates.
// Options come from the percentage weight, so they do not move while adjusting.
export function computeLoad({ base, pct, sel = 0, extra = [], minus = [] }, settings, simple = false) {
  const raw = base * pct / 100;
  const start = Math.max(settings.bar, round5(raw));
  const options = plateOptions(start, settings);
  const selected = simple || sel >= options.length ? 0 : sel;
  if (!options.length) return { raw, start, target: start, options, selected, plates: null, items: [], ladder: [], key: '' };
  const kept = simple ? options[0].plates : subtractPlates(options[selected].plates, minus);
  const added = simple ? [] : extra;
  // By weight; at equal weight the extra plate goes outside.
  const items = [...kept.map((p) => ({ p, extra: false })), ...added.map((p) => ({ p, extra: true }))]
    .sort((a, b) => b.p - a.p || a.extra - b.extra);
  const loaded = items.map((item) => item.p);
  const target = settings.bar + 2 * sum(loaded);
  return {
    raw, start, target, options, selected, items,
    plates: loaded,
    ladder: buildLadder(loaded, settings),
    key: `${target}|${loaded.join(',')}|${settings.bar}`,
  };
}
