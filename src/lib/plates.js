// Barbell loading: plate combinations, recommended options, warm-up ladder and
// the adjusted load. Pure: settings are { bar, plates }, weights in lb.

export const ALL_PLATES = [55, 45, 35, 25, 15, 10, 5, 2.5];
export const BARS = [45, 35, 15];
export const DEFAULT_PCT = 70;
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

// Warm-up sets as [percentage of the working weight, reps].
const WARMUP_SCHEME = [[40, 5], [55, 5], [70, 3], [80, 2], [90, 1]];
const BAR_REPS = 10;
const WARMUP_STEP = 5;        // per side: warm-up loads land on bar + multiples of 10 lb
const MAX_CANDIDATES = 300;   // plate combos considered per set

function stepNote(previous, plates) {
  const removed = subtractPlates(previous, plates);
  const added = subtractPlates(plates, previous);
  const list = (items) => items.join(' + ');
  if (!plates.length) return 'Barra sola';
  if (!previous.length) return `Pon ${list(added)}`;
  if (!removed.length) return `Agrega ${list(added)}`;
  if (!added.length) return `Quita ${list(removed)}`;
  return `Quita ${list(removed)} · pon ${list(added)}`;
}

// Cost of going from one set to the next: stripping plates is worse than adding them.
const changeCost = (from, to) => 2 * subtractPlates(from, to).length + subtractPlates(to, from).length;

// Percentage-based ladder from the empty bar to the final load. Warm-up loads are clean weights without
// 2.5s and may move one step (10 lb) from their percentage when that saves plate changes; sets too close
// to each other or to the goal are skipped. Plates are chosen for the whole ladder at once.
export function buildLadder(final, { bar, plates }) {
  const goal = bar + 2 * sum(final);
  if (!final.length) return [{ total: bar, reps: BAR_REPS, plates: [], note: 'Barra sola' }];
  const minGap = Math.max(10, goal * 0.06);
  const sets = [];
  let previous = bar;
  for (const [pct, reps] of WARMUP_SCHEME) {
    const perSide = Math.round((goal * pct / 100 - bar) / 2 / WARMUP_STEP) * WARMUP_STEP;
    const total = bar + 2 * perSide;
    if (perSide > 0 && total - previous >= minGap && goal - total >= minGap) { sets.push({ perSide, reps }); previous = total; }
  }

  const clean = plates.filter((plate) => plate >= WARMUP_STEP);
  const levels = [[{ plates: [], total: bar, cost: 0 }]];
  for (const { perSide } of sets) {
    const options = [];
    for (const shift of [0, -WARMUP_STEP, WARMUP_STEP]) {
      const side = perSide + shift;
      if (side <= 0) continue;
      const combos = plateCombos(side, clean);
      for (const combo of combos.length ? combos : plateCombos(side, plates)) {
        options.push({ plates: combo, total: bar + 2 * side, cost: (shift ? 2.5 : 0) + combo.length * 0.1 });
      }
    }
    options.sort((a, b) => a.cost - b.cost);
    if (options.length) levels.push(options.slice(0, MAX_CANDIDATES));
  }
  levels.push([{ plates: [...final], total: goal, cost: 0 }]);

  // Cheapest path through the levels, keeping loads strictly increasing.
  let paths = levels[0].map((node) => ({ cost: node.cost, nodes: [node] }));
  for (const level of levels.slice(1)) {
    paths = level.map((node) => {
      let best = null;
      for (const path of paths) {
        const last = path.nodes.at(-1);
        if (node.total - last.total < Math.max(10, minGap * 0.75)) continue;
        const cost = path.cost + node.cost + changeCost(last.plates, node.plates);
        if (!best || cost < best.cost) best = { cost, nodes: [...path.nodes, node] };
      }
      return best;
    }).filter(Boolean);
  }
  const nodes = paths[0].nodes;
  const reps = [BAR_REPS, ...sets.map((set) => set.reps)];
  return nodes.map((node, i) => ({
    total: node.total, plates: node.plates, reps: i === nodes.length - 1 ? null : reps[i],
    note: stepNote(i ? nodes[i - 1].plates : [], node.plates),
  }));
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
