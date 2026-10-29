// Movement catalog, units and formatting shared by the client views. Pure: no DOM.
// type: 'weight' (lb, higher is better, with 1RM/3RM/5RM) | 'time' (seconds, lower is better)

export const LB_TO_KG = 0.45359237;
export const RMS = [1, 3, 5];

const BASE_CATALOG = {
  Lift: { type: 'weight', groups: [
    { name: 'Squats', color: '--red', moves: ['Back Squat', 'Front Squat', 'Overhead Squat'] },
    { name: 'Cleans', color: '--blue', moves: ['Clean', 'Hang Power Clean', 'Hang Squat Clean', 'Muscle Clean', 'Power Clean', 'Squat Clean'] },
    { name: 'Presses', color: '--amber', moves: ['Strict Press', 'Push Press', 'Bench Press'] },
    { name: 'Jerks', color: '--green', moves: ['Push Jerk', 'Split Jerk', 'Clean & Jerk'] },
    { name: 'Snatches', color: '--purple', moves: ['Snatch', 'Power Snatch', 'Hang Power Snatch', 'Squat Snatch'] },
    { name: 'Deadlifts', color: '--teal', moves: ['Deadlift', 'Sumo Deadlift'] },
  ] },
  Cardio: { type: 'time', groups: [
    { name: 'Run', color: '--red', moves: ['400 m', '1 mile', '5 km'] },
    { name: 'Row', color: '--teal', moves: ['500 m Row', '2 km Row'] },
    { name: 'Bike', color: '--amber', moves: ['50 cal Bike'] },
  ] },
  Benchmarks: { type: 'time', groups: [
    { name: 'Girls', color: '--purple', moves: ['Fran', 'Grace', 'Isabel', 'Helen', 'Diane'] },
    { name: 'Heroes', color: '--red', moves: ['Murph', 'DT'] },
  ] },
};

export const DEMO_RECORDS = [
  { move: 'Back Squat', value: 225, rm: 1, date: '2025-11-10' },
  { move: 'Back Squat', value: 240, rm: 1, date: '2026-02-14' },
  { move: 'Back Squat', value: 250, rm: 1, date: '2026-05-20' },
  { move: 'Back Squat', value: 260, rm: 1, date: '2026-08-30' },
  { move: 'Back Squat', value: 225, rm: 3, date: '2026-04-02' },
  { move: 'Back Squat', value: 235, rm: 3, date: '2026-07-15' },
  { move: 'Back Squat', value: 215, rm: 5, date: '2026-06-10' },
  { move: 'Front Squat', value: 215, rm: 1, date: '2026-07-04' },
  { move: 'Squat Clean', value: 165, rm: 1, date: '2026-09-01' },
  { move: 'Bench Press', value: 140, rm: 1, date: '2026-04-22' },
  { move: 'Fran', value: 312, date: '2026-03-15' },
  { move: 'Fran', value: 285, date: '2026-08-10' },
];

const OTHER = { tab: null, type: 'weight', group: { name: 'Otros', color: '--muted', moves: [] } };

/* ---------- Active catalog ---------- */
// The catalog depends on the member (own movements, shared ones turned off), but the
// query helpers below are called from many views. The app sets the member's catalog
// once per render with setCatalog; until then the shared base catalog applies.
// `info` also knows turned-off movements, so their history keeps its unit and group.
const TABS = { LIFT: 'Lift', CARDIO: 'Cardio', BENCHMARK: 'Benchmarks' };
export const TAB_CATEGORIES = Object.fromEntries(Object.entries(TABS).map(([category, tab]) => [tab, category]));
export const CUSTOM_GROUP = { name: 'Mis movimientos', color: '--indigo' };
// Own movements created before categories existed are stored under this group.
const LEGACY_CUSTOM_GROUP = 'Custom';
const CUSTOM_COLORS = ['--teal', '--pink', '--green', '--amber', '--blue', '--purple', '--mint', '--cyan'];

// A member's own group keeps the same color wherever it shows and whatever groups are added later.
function customColor(name) {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.codePointAt(0)) | 0;
  return CUSTOM_COLORS[Math.abs(hash) % CUSTOM_COLORS.length];
}
const BASE_GROUPS = new Map(Object.values(BASE_CATALOG).flatMap(({ groups }) => groups.map((group) => [group.name, group])));
const BASE_ORDER = new Map(Object.values(BASE_CATALOG).flatMap(({ groups }) => groups.flatMap((group) => group.moves)).map((move, index) => [move, index]));

function indexCatalog(catalog) {
  const info = new Map();
  for (const tab in catalog) for (const group of catalog[tab].groups) for (const move of group.moves) info.set(move, { tab, type: catalog[tab].type, group });
  return { catalog, info };
}

let active = indexCatalog(BASE_CATALOG);

/**
 * Builds a member's catalog from /api/movements rows
 * ({ name, category, groupName, measurementType, custom, hidden }).
 * Shared movements keep the base order; new ones follow. Hidden ones leave the catalog
 * but stay known to moveInfo. Own movements join the group they were created in, which
 * may be a shared group or one of the member's own; older ones share "Mis movimientos".
 */
export function buildCatalog(movements) {
  const full = { Lift: { type: 'weight', groups: [] }, Cardio: { type: 'time', groups: [] }, Benchmarks: { type: 'time', groups: [] } };
  const ordered = [...movements].sort((a, b) =>
    (BASE_ORDER.get(a.name) ?? Infinity) - (BASE_ORDER.get(b.name) ?? Infinity) || a.name.localeCompare(b.name));
  // Own movements go last so the shared groups keep their place.
  ordered.sort((a, b) => Number(a.custom) - Number(b.custom));
  for (const movement of ordered) {
    const tab = full[TABS[movement.category]] ?? full.Benchmarks;
    const label = movement.custom && movement.groupName === LEGACY_CUSTOM_GROUP ? CUSTOM_GROUP.name : movement.groupName;
    let group = tab.groups.find((g) => g.name === label);
    if (!group) {
      const color = label === CUSTOM_GROUP.name ? CUSTOM_GROUP.color
        : BASE_GROUPS.get(label)?.color ?? (movement.custom ? customColor(label) : '--muted');
      group = { name: label, color, moves: [], hidden: new Set() };
      tab.groups.push(group);
    }
    group.moves.push(movement.name);
    if (movement.hidden) group.hidden.add(movement.name);
  }
  const info = indexCatalog(full).info;
  const visible = {};
  for (const tab in full) {
    visible[tab] = { type: full[tab].type, groups: full[tab].groups
      .map(({ hidden, moves, ...group }) => ({ ...group, moves: moves.filter((move) => !hidden.has(move)) }))
      .filter((group) => group.moves.length) };
  }
  return { catalog: visible, info };
}

export function setCatalog(next) {
  active = next ?? indexCatalog(BASE_CATALOG);
}

export const getCatalog = () => active.catalog;
export const CATALOG_TABS = Object.keys(BASE_CATALOG);

export function moveInfo(move) {
  return active.info.get(move) ?? OTHER;
}

export const weightGroups = () => Object.values(active.catalog).filter((c) => c.type === 'weight').flatMap((c) => c.groups);

/* ---------- Formatting ---------- */
export const num = (x) => (Math.round(x * 10) / 10).toLocaleString('es-CR');
export const num2 = (x) => (Math.round(x * 100) / 100).toLocaleString('es-CR');
export const toKg = (lb) => num(lb * LB_TO_KG);

export function formatValue(value, type) {
  if (value == null) return '';
  if (type === 'time') {
    const minutes = Math.floor(value / 60);
    const seconds = String(Math.round(value % 60)).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
  return `${value} lb`;
}

// 'm:ss' for times, decimal with comma or dot for weights. NaN when unreadable.
export function parseValue(text, type) {
  const value = String(text).trim();
  if (type === 'time') {
    if (!/^\d+(:\d{1,2})?$/.test(value)) return NaN;
    const [minutes, seconds] = value.split(':').map(Number);
    return seconds == null ? minutes : minutes * 60 + seconds;
  }
  return parseFloat(value.replace(',', '.'));
}

export const formatDate = (date) =>
  new Date(`${date}T12:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });

export function today(now = new Date()) {
  const date = new Date(now);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

/* ---------- Record queries ---------- */
export function recordsOf(records, move, rm) {
  const { type } = moveInfo(move);
  return records.filter((r) => r.move === move && (type !== 'weight' || (r.rm || 1) === rm));
}

export function bestRecord(records, move, rm = 1) {
  const { type } = moveInfo(move);
  const matches = recordsOf(records, move, rm);
  if (!matches.length) return null;
  return matches.reduce((a, b) => ((type === 'time' ? b.value < a.value : b.value > a.value) ? b : a));
}

export const firstRm = (records, move) => RMS.find((rm) => bestRecord(records, move, rm));

export const latestRecord = (records, move, rm) =>
  recordsOf(records, move, rm).reduce((a, b) => (!a || b.date > a.date ? b : a), null);

// Quick upload accepts up to 4 digits with 2 decimals, strictly positive.
export const isValidQuickWeight = (text) =>
  /^\d{1,4}([.,]\d{1,2})?$/.test(String(text).trim()) && parseValue(text, 'weight') > 0;
