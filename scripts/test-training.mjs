import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays, addMonths, cloneContent, hasLogging, isDate, loadText, monthWeeks, newBlock, newItem, normalizeContent,
  normalizeResults, recordCandidate, resolveLoad, TrainingInputError, volumeText, weekStart,
} from '../src/lib/training.js';

const pr = (movement = null, rm = 1) => ({ kind: 'pr', movement, rm });
const percent = (value, base) => ({ type: 'percent', value, base });
const invalid = (content) => assert.throws(() => normalizeContent(content), TrainingInputError);

function sample() {
  const max = newItem({ movement: 'Clean & Jerk', reps: '1', load: { type: 'max', value: null, base: null } });
  const backOff = newItem({ movement: 'Clean & Jerk', sets: 3, reps: '1', load: percent(85, { kind: 'item', itemId: max.id }) });
  const squat = newItem({ movement: 'Back Squat', sets: 5, reps: '3', load: percent(75, pr()), log: true, notes: ' Tempo 3-1-1 ' });
  const pull = newItem({ label: 'Clean Pull', sets: 3, reps: '3', load: percent(110, pr('Clean & Jerk')) });
  const wod = newBlock({ title: 'WOD', notes: '21-15-9', score: 'time' });
  return { max, backOff, squat, pull, wod, content: { blocks: [newBlock({ title: 'A', items: [max, backOff] }), newBlock({ items: [squat, pull] }), wod] } };
}

test('content is cleaned: text trimmed, a daily maximum is always logged, unknown fields dropped', () => {
  const { content, max, squat } = sample();
  content.blocks[0].extra = 'ignored';
  const clean = normalizeContent(content);
  assert.equal('extra' in clean.blocks[0], false);
  assert.equal(clean.blocks[0].items[0].log, true);
  assert.equal(clean.blocks[0].items[0].id, max.id);
  assert.equal(clean.blocks[1].items[0].notes, 'Tempo 3-1-1');
  assert.deepEqual(clean.blocks[1].items[0].load, squat.load);
  assert.deepEqual(normalizeContent(clean), clean);
});

test('invalid content is rejected', () => {
  const { content, max } = sample();
  invalid(null);
  invalid({ blocks: 'x' });
  invalid({ blocks: Array.from({ length: 13 }, () => newBlock()) });
  invalid({ blocks: [newBlock({ items: Array.from({ length: 21 }, () => newItem({ label: 'x' })) })] });
  invalid({ blocks: [newBlock({ id: 'not-an-id' })] });
  invalid({ blocks: [newBlock({ score: 'points' })] });
  invalid({ blocks: [newBlock({ items: [newItem()] })] });                                   // neither movement nor label
  invalid({ blocks: [newBlock({ items: [newItem({ label: 'x', load: { type: 'weight', value: 0 } })] })] });
  invalid({ blocks: [newBlock({ items: [newItem({ label: 'x', load: percent(250, pr('Snatch')) })] })] });
  invalid({ blocks: [newBlock({ items: [newItem({ label: 'x', load: percent(80, pr(null, 2)) })] })] });
  invalid({ blocks: [newBlock({ items: [newItem({ label: 'x', load: percent(80, pr()) })] })] }); // a percentage needs a movement
  invalid({ blocks: [newBlock({ items: [newItem({ label: 'x', sets: 0 })] })] });
  invalid({ blocks: [newBlock({ items: [newItem({ label: 'x'.repeat(81) })] })] });
  // Ids are unique across the session, and a line can only build on an earlier one.
  invalid({ blocks: [newBlock({ items: [max, { ...max }] })] });
  invalid({ blocks: [content.blocks[0], { ...content.blocks[0] }] });
  invalid({ blocks: [newBlock({ items: [...content.blocks[0].items].reverse() })] });
});

test('results keep only valid numbers and outlive the session they were logged on', () => {
  const { max, wod } = sample();
  const orphan = newItem().id;
  assert.deepEqual(
    normalizeResults({ items: { [max.id]: { weight: 170.25, reps: 1.9, junk: true }, [orphan]: { reps: 3 }, [newItem().id]: {} }, blocks: { [wod.id]: { value: 312 } } }),
    { items: { [max.id]: { weight: 170.25, reps: 1 }, [orphan]: { reps: 3 } }, blocks: { [wod.id]: { value: 312 } } },
  );
  assert.deepEqual(normalizeResults({}), { items: {}, blocks: {} });
  for (const bad of [null, { items: { nope: { weight: 100 } } }, { items: { [max.id]: { weight: -5 } } }, { items: { [max.id]: { weight: '100' } } },
    { items: { [max.id]: 100 } }, { blocks: { [wod.id]: { value: 1e9 } } }]) {
    assert.throws(() => normalizeResults(bad), TrainingInputError);
  }
});

test('a percentage resolves from the athlete records or from an earlier line, rounded to 5 lb', () => {
  const { max, backOff, squat, pull } = sample();
  const bests = { 'Back Squat:1': 260, 'Clean & Jerk:1': 165 };
  const bestOf = (movement, rm) => bests[`${movement}:${rm}`] ?? null;
  assert.deepEqual(resolveLoad(squat, null, bestOf), { weight: 195, base: 260, missing: null });
  // Percentage of another lift, above 100.
  assert.deepEqual(resolveLoad(pull, null, bestOf), { weight: 180, base: 165, missing: null });
  assert.deepEqual(resolveLoad(squat, null, () => null), { weight: null, base: null, missing: 'pr' });
  // The base is the weight logged today on the earlier line.
  assert.deepEqual(resolveLoad(backOff, { items: {}, blocks: {} }, bestOf), { weight: null, base: null, missing: 'item' });
  assert.deepEqual(resolveLoad(backOff, { items: { [max.id]: { weight: 172 } }, blocks: {} }, bestOf), { weight: 145, base: 172, missing: null });
  assert.deepEqual(resolveLoad(max, null, bestOf), { weight: null, base: null, missing: null });
  assert.deepEqual(resolveLoad(newItem({ label: 'x', load: { type: 'weight', value: 95, base: null } }), null, bestOf), { weight: 95, base: null, missing: null });
});

test('prescriptions read as the coach wrote them', () => {
  const { content, max, backOff, squat, pull } = sample();
  assert.deepEqual([max, backOff, squat, pull].map((item) => [volumeText(item), loadText(item, content)]), [
    ['1 rep', 'Máximo del día'], ['3 × 1', '85 % de «Clean & Jerk» de hoy'], ['5 × 3', '75 % de 1RM'], ['3 × 3', '110 % de 1RM de Clean & Jerk'],
  ]);
  assert.equal(volumeText(newItem({ sets: 4 })), '4 series');
  assert.equal(volumeText(newItem({ reps: 'máx' })), 'máx');
  assert.equal(hasLogging(content), true);
  assert.equal(hasLogging({ blocks: [newBlock({ items: [newItem({ label: 'x' })] })] }), false);
});

test('a logged weight is a record candidate only for 1, 3 or 5 reps of a catalog movement that beat the best', () => {
  const { max, squat, pull } = sample();
  const bestOf = (movement, rm) => ({ 'Clean & Jerk:1': 165, 'Back Squat:3': 235 })[`${movement}:${rm}`] ?? null;
  assert.deepEqual(recordCandidate(max, { weight: 170 }, bestOf), { movement: 'Clean & Jerk', rm: 1, value: 170, previous: 165 });
  assert.equal(recordCandidate(max, { weight: 165 }, bestOf), null);
  assert.equal(recordCandidate(squat, { weight: 195 }, bestOf), null);
  // The logged reps win over the prescribed ones; a first record of that kind counts.
  assert.deepEqual(recordCandidate(squat, { weight: 200, reps: 5 }, bestOf), { movement: 'Back Squat', rm: 5, value: 200, previous: null });
  assert.equal(recordCandidate(squat, { weight: 300, reps: 2 }, bestOf), null);
  assert.equal(recordCandidate(pull, { weight: 400, reps: 1 }, bestOf), null);
  assert.equal(recordCandidate(max, { reps: 1 }, bestOf), null);
});

test('a pasted copy has fresh ids and keeps its internal percentage base', () => {
  const { content, max } = sample();
  const copy = cloneContent(normalizeContent(content));
  const [copiedMax, copiedBackOff] = copy.blocks[0].items;
  assert.notEqual(copiedMax.id, max.id);
  assert.equal(copiedBackOff.load.base.itemId, copiedMax.id);
  assert.notEqual(copy.blocks[0].id, content.blocks[0].id);
  assert.deepEqual(normalizeContent(copy), copy);
});

test('calendar dates are plain days', () => {
  assert.deepEqual([isDate('2026-11-11'), isDate('2026-02-30'), isDate('0000-01-01'), isDate('11/11/2026'), isDate(null)], [true, false, false, false, false]);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.deepEqual([weekStart('2026-11-11'), weekStart('2026-11-09'), weekStart('2026-11-15')], ['2026-11-09', '2026-11-09', '2026-11-09']);
  assert.deepEqual(monthWeeks('2026-11'), ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.deepEqual(monthWeeks('2027-02'), ['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
  assert.deepEqual([addMonths('2026-12', 1), addMonths('2026-01', -1)], ['2027-01', '2025-12']);
});
