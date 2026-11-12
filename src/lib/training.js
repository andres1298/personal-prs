// Training sessions shared by the coach's editor, the athlete's plan and the server
// validation. Pure: no DOM and no database. Weights are in lb.
//
// content: { blocks: [{ id, title, notes, score, timer?, items: [item] }] }
//   timer     optional workout clock the athlete starts from the block: a timer-engine config
//             ({ type: 'amrap' | 'emom' | 'tabata' | 'fortime', ...its times and rounds })
// item:    { id, movement, label, sets, reps, load: { type, value, base }, log, notes }
//   movement  catalog name (links the athlete's records) or null for free text in `label`
//   parts     optional, for a complex: [{ reps, movement }] in order; `label` holds its text ("1 Clean + 2 Split Jerk")
//   load.type 'none' | 'weight' (lb) | 'percent' | 'max' (work up to the heaviest of the day)
//   load.base for 'percent': { kind: 'pr', movement, rm } (movement null = the line's own)
//             or { kind: 'item', itemId } (the weight logged on an earlier line of the session)
//   log       whether the athlete records what they did; 'max' lines always do
// results: { items: { [itemId]: { weight?, reps? } }, blocks: { [blockId]: { value } } }

import { normalizeConfig, TIMER_TYPES } from './timer-engine.js';

export const LOAD_TYPES = ['none', 'weight', 'percent', 'max'];
export const SCORE_TYPES = ['none', 'time', 'reps', 'weight'];
export const BASE_RMS = [1, 3, 5];
export const LIMITS = { blocks: 12, items: 20, title: 80, notes: 2000, label: 80, reps: 16, comment: 2000, parts: 6 };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round5 = (x) => Math.round(x / 5) * 5;

export class TrainingInputError extends Error {}

const fail = (message) => { throw new TrainingInputError(message); };
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const newId = () => globalThis.crypto.randomUUID();

function text(value, max, field) {
  if (value == null) return '';
  if (typeof value !== 'string') fail(`${field} must be text.`);
  const clean = value.replace(/\r\n?/g, '\n').trim();
  if (clean.length > max) fail(`${field} is too long.`);
  return clean;
}

function numberIn(value, min, max, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${field} is out of range.`);
  return Math.round(value * 1000) / 1000;
}

function id(value, field) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail(`${field} must be an id.`);
  return value.toLowerCase();
}

function normalizeLoad(input, earlierItems) {
  if (!isObject(input) || !LOAD_TYPES.includes(input.type)) fail('Unknown load type.');
  const { type } = input;
  if (type === 'none' || type === 'max') return { type, value: null, base: null };
  if (type === 'weight') return { type, value: numberIn(input.value, 1, 2000, 'Weight'), base: null };
  const value = numberIn(input.value, 1, 200, 'Percentage');
  const base = input.base;
  if (isObject(base) && base.kind === 'item') {
    const itemId = id(base.itemId, 'Base line');
    // Only an earlier line can be the base, so the athlete always reaches it first.
    if (!earlierItems.has(itemId)) fail('The base line must come earlier in the session.');
    return { type, value, base: { kind: 'item', itemId } };
  }
  if (!isObject(base) || base.kind !== 'pr' || !BASE_RMS.includes(base.rm)) fail('Unknown percentage base.');
  return { type, value, base: { kind: 'pr', movement: text(base.movement, LIMITS.label, 'Base movement') || null, rm: base.rm } };
}

// A complex lists at least two movements; fewer is not a complex and the field is dropped.
function normalizeParts(input) {
  if (input == null) return null;
  if (!Array.isArray(input) || input.length > LIMITS.parts) fail('A complex lists up to six movements.');
  const parts = input.map((part) => {
    if (!isObject(part)) fail('A complex part must be an object.');
    const movement = text(part.movement, LIMITS.label, 'Complex movement');
    if (!movement) fail('A complex part needs a movement.');
    return { reps: numberIn(Math.trunc(part.reps), 1, 99, 'Complex reps'), movement };
  });
  return parts.length >= 2 ? parts : null;
}

/** "1 Clean + 2 Split Jerk" from a complex's parts. */
export const complexLabel = (parts) => parts.map((part) => `${part.reps} ${part.movement}`).join(' + ');

function normalizeItem(input, seen, earlierItems) {
  if (!isObject(input)) fail('A line must be an object.');
  const itemId = id(input.id, 'Line id');
  if (seen.has(itemId)) fail('Ids must be unique.');
  seen.add(itemId);
  const movement = text(input.movement, LIMITS.label, 'Movement') || null;
  const label = text(input.label, LIMITS.label, 'Label');
  if (!movement && !label) fail('A line needs a movement or a label.');
  const load = normalizeLoad(input.load, earlierItems);
  if (load.type === 'percent' && load.base.kind === 'pr' && !load.base.movement && !movement) fail('A percentage needs a movement.');
  const parts = movement ? null : normalizeParts(input.parts);
  return {
    id: itemId, movement, label, ...(parts ? { parts } : {}),
    sets: input.sets == null ? null : numberIn(Math.trunc(input.sets), 1, 99, 'Sets'),
    reps: text(input.reps, LIMITS.reps, 'Reps'),
    load,
    log: load.type === 'max' || input.log === true,
    notes: text(input.notes, LIMITS.notes, 'Notes'),
  };
}

/** Returns a clean copy of a session's content or throws TrainingInputError. */
export function normalizeContent(input) {
  if (!isObject(input) || !Array.isArray(input.blocks) || input.blocks.length > LIMITS.blocks) fail('Content must list its blocks.');
  const seen = new Set();
  const earlierItems = new Set();
  const blocks = input.blocks.map((block) => {
    if (!isObject(block) || !Array.isArray(block.items) || block.items.length > LIMITS.items) fail('A block must list its lines.');
    const blockId = id(block.id, 'Block id');
    if (seen.has(blockId)) fail('Ids must be unique.');
    seen.add(blockId);
    if (!SCORE_TYPES.includes(block.score)) fail('Unknown score type.');
    const items = block.items.map((item) => {
      const clean = normalizeItem(item, seen, earlierItems);
      earlierItems.add(clean.id);
      return clean;
    });
    // The timer engine clamps times and rounds to what it can run.
    if (block.timer != null && (!isObject(block.timer) || !TIMER_TYPES.includes(block.timer.type))) fail('Unknown timer type.');
    return {
      id: blockId, title: text(block.title, LIMITS.title, 'Block title'), notes: text(block.notes, LIMITS.notes, 'Block notes'), score: block.score,
      ...(block.timer ? { timer: normalizeConfig(block.timer) } : {}), items,
    };
  });
  return { blocks };
}

/** Returns clean results or throws. Ids are not checked against the session: results outlive later edits. */
export function normalizeResults(input) {
  if (!isObject(input)) fail('Results must be an object.');
  const items = {};
  const blocks = {};
  const itemEntries = Object.entries(isObject(input.items) ? input.items : {});
  const blockEntries = Object.entries(isObject(input.blocks) ? input.blocks : {});
  if (itemEntries.length > LIMITS.blocks * LIMITS.items || blockEntries.length > LIMITS.blocks) fail('Too many results.');
  for (const [key, value] of itemEntries) {
    if (!isObject(value)) fail('A result must be an object.');
    const result = {};
    if (value.weight != null) result.weight = numberIn(value.weight, 0.5, 2000, 'Weight');
    if (value.reps != null) result.reps = numberIn(Math.trunc(value.reps), 1, 9999, 'Reps');
    if (Object.keys(result).length) items[id(key, 'Line id')] = result;
  }
  for (const [key, value] of blockEntries) {
    if (!isObject(value)) fail('A score must be an object.');
    if (value.value != null) blocks[id(key, 'Block id')] = { value: numberIn(value.value, 0.5, 360000, 'Score') };
  }
  return { items, blocks };
}

export const emptyContent = () => ({ blocks: [] });
export const emptyResults = () => ({ items: {}, blocks: {} });

export function newItem(patch = {}) {
  return { id: newId(), movement: null, label: '', sets: null, reps: '', load: { type: 'none', value: null, base: null }, log: false, notes: '', ...patch };
}

export function newBlock(patch = {}) {
  return { id: newId(), title: '', notes: '', score: 'none', items: [], ...patch };
}

/** A copy with fresh ids (and percentage bases re-pointed), for pasting a session on another day. */
export function cloneContent(content) {
  const ids = new Map();
  const fresh = (old) => { ids.set(old, newId()); return ids.get(old); };
  return {
    blocks: content.blocks.map((block) => ({
      ...block, id: fresh(block.id),
      items: block.items.map((item) => {
        const base = item.load.base?.kind === 'item' ? { kind: 'item', itemId: ids.get(item.load.base.itemId) } : item.load.base;
        return { ...item, id: fresh(item.id), load: { ...item.load, base } };
      }),
    })),
  };
}

export const allItems = (content) => content.blocks.flatMap((block) => block.items);
export const itemName = (item) => item.movement || item.label;
export const hasLogging = (content) => content.blocks.some((block) => block.score !== 'none' || block.items.some((item) => item.log));

/** "5 × 3", "3 series", "8 reps" or '' from a line's sets and reps. */
export function volumeText(item) {
  if (item.sets && item.reps) return `${item.sets} × ${item.reps}`;
  if (item.sets) return `${item.sets} ${item.sets === 1 ? 'serie' : 'series'}`;
  return item.reps ? `${item.reps} ${/^\d+$/.test(item.reps) ? (item.reps === '1' ? 'rep' : 'reps') : ''}`.trim() : '';
}

/** How the coach wrote the load, without anyone's numbers: "75 % de 1RM", "185 lb", "Máximo del día". */
export function loadText(item, content) {
  const { type, value, base } = item.load;
  if (type === 'weight') return `${value} lb`;
  if (type === 'max') return 'Máximo del día';
  if (type !== 'percent') return '';
  if (base.kind === 'item') {
    const source = allItems(content).find((other) => other.id === base.itemId);
    return `${value} % de ${source ? `«${itemName(source)}» de hoy` : 'una línea anterior'}`;
  }
  const other = base.movement && base.movement !== item.movement ? ` de ${base.movement}` : '';
  return `${value} % de ${base.rm}RM${other}`;
}

/**
 * The weight a line asks of one athlete. `bestOf(movement, rm)` returns their best record or null.
 * Returns { weight, base, missing }: weight and base are null when there is nothing to compute,
 * and missing is 'pr' or 'item' when a percentage has no base yet.
 */
export function resolveLoad(item, results, bestOf) {
  const { type, value, base } = item.load;
  if (type === 'weight') return { weight: value, base: null, missing: null };
  if (type !== 'percent') return { weight: null, base: null, missing: null };
  const baseWeight = base.kind === 'item'
    ? results?.items?.[base.itemId]?.weight ?? null
    : bestOf(base.movement || item.movement, base.rm);
  if (!(baseWeight > 0)) return { weight: null, base: null, missing: base.kind };
  return { weight: round5(baseWeight * value / 100), base: baseWeight, missing: null };
}

/**
 * The record a logged result would set, or null. Needs a catalog movement and 1, 3 or 5
 * repetitions (logged, or the ones prescribed), and must beat `bestOf(movement, rm)`.
 */
export function recordCandidate(item, result, bestOf) {
  if (!item.movement || !(result?.weight > 0)) return null;
  const reps = result.reps ?? (/^\d+$/.test(item.reps) ? Number(item.reps) : item.load.type === 'max' ? 1 : null);
  if (!BASE_RMS.includes(reps)) return null;
  const best = bestOf(item.movement, reps);
  return best == null || result.weight > best ? { movement: item.movement, rm: reps, value: result.weight, previous: best } : null;
}

/* ---------- Dates (YYYY-MM-DD, calendar days without time zones) ---------- */
export const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !value.startsWith('0000') && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Monday of the week that holds `date`. */
export function weekStart(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export const weekDays = (start) => Array.from({ length: 7 }, (_, index) => addDays(start, index));

/** The Mondays of the weeks a month touches, e.g. monthWeeks('2026-11'). */
export function monthWeeks(month) {
  const weeks = [];
  for (let start = weekStart(`${month}-01`); start.slice(0, 7) <= month; start = addDays(start, 7)) {
    if (addDays(start, 6).slice(0, 7) >= month) weeks.push(start);
  }
  return weeks;
}

export function addMonths(month, count) {
  const [year, index] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, index - 1 + count, 1));
  return next.toISOString().slice(0, 7);
}
