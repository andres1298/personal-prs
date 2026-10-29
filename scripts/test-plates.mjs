import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_PLATES, buildLadder, computeLoad, plateOptions, round5, subtractPlates } from '../src/lib/plates.js';
import {
  bestRecord, buildCatalog, firstRm, formatValue, getCatalog, isValidQuickWeight, latestRecord, moveInfo, parseValue, recordsOf, setCatalog,
  today, weightGroups,
} from '../src/lib/catalog.js';

const gym = { bar: 45, plates: [...ALL_PLATES] };

test('plate options recommend the fewest plates and prefer 45s on a tie', () => {
  const options = plateOptions(225, gym);
  assert.deepEqual(options[0], { label: 'Recomendado', plates: [45, 45] });
  assert.ok(options.length <= 4);
  assert.ok(options.slice(1).every((option) => option.label === `Con ${option.plates[0]}s`));
  assert.deepEqual(plateOptions(45, gym), [{ label: 'Solo la barra', plates: [] }]);
  assert.deepEqual(plateOptions(50, { bar: 45, plates: [45] }), []);
});

test('the warm-up ladder climbs from the bar to the final load', () => {
  const ladder = buildLadder([45, 25], gym);
  assert.deepEqual(ladder.map((step) => step.total), [45, 95, 115, 135, 185]);
  assert.deepEqual(ladder.map((step) => step.note), ['Barra sola', 'Pon 25s', 'Cambia 25 → 35', 'Cambia 35 → 45', 'Agrega 25s']);
  assert.equal(buildLadder([], gym).length, 1);
});

test('the load rounds to 5 lb, applies extra and removed plates and keeps options stable', () => {
  assert.equal(round5(192.5), 195);
  const plain = computeLoad({ base: 260, pct: 70 }, gym);
  assert.equal(plain.raw, 182);
  assert.equal(plain.start, 180);
  assert.equal(plain.target, 180);
  const adjusted = computeLoad({ base: 260, pct: 70, extra: [5] }, gym);
  assert.equal(adjusted.target, 190);
  assert.deepEqual(adjusted.options, plain.options);
  assert.ok(adjusted.items.some((item) => item.extra && item.p === 5));
  const removed = computeLoad({ base: 260, pct: 70, minus: [plain.plates.at(-1)] }, gym);
  assert.ok(removed.target < plain.target);
  assert.notEqual(removed.key, plain.key);
  const simple = computeLoad({ base: 260, pct: 70, extra: [5], sel: 3 }, gym, true);
  assert.equal(simple.target, plain.target);
  assert.equal(simple.selected, 0);
  assert.deepEqual(subtractPlates([45, 25, 25], [25]), [45, 25]);
});

test('records resolve best values by measurement type and repetition maximum', () => {
  const records = [
    { move: 'Back Squat', value: 250, rm: 1, date: '2026-01-01' },
    { move: 'Back Squat', value: 260, rm: 1, date: '2025-01-01' },
    { move: 'Back Squat', value: 215, rm: 5, date: '2026-02-01' },
    { move: 'Fran', value: 312, date: '2026-01-01' },
    { move: 'Fran', value: 285, date: '2026-02-01' },
  ];
  assert.equal(moveInfo('Fran').type, 'time');
  assert.equal(moveInfo('Unknown').group.name, 'Otros');
  assert.equal(bestRecord(records, 'Back Squat', 1).value, 260);
  assert.equal(bestRecord(records, 'Fran').value, 285);
  assert.equal(recordsOf(records, 'Back Squat', 5).length, 1);
  assert.equal(firstRm(records, 'Back Squat'), 1);
  assert.equal(firstRm(records, 'Front Squat'), undefined);
  assert.equal(latestRecord(records, 'Back Squat', 1).value, 250);
});

test('values parse and format in lb and m:ss', () => {
  assert.equal(parseValue('4:45', 'time'), 285);
  assert.ok(Number.isNaN(parseValue('abc', 'time')));
  assert.equal(parseValue('102,5', 'weight'), 102.5);
  assert.equal(formatValue(285, 'time'), '4:45');
  assert.equal(formatValue(225, 'weight'), '225 lb');
  assert.ok(isValidQuickWeight('135'));
  assert.ok(isValidQuickWeight('102,5'));
  assert.ok(!isValidQuickWeight('0'));
  assert.ok(!isValidQuickWeight('12345'));
  assert.match(today(new Date('2026-10-18T12:00:00')), /^2026-10-1[78]$/);
});

test('a member catalog adds own movements, hides turned-off ones and keeps their history readable', () => {
  const row = (name, category, groupName, measurementType, extra = {}) => ({ name, category, groupName, measurementType, custom: false, hidden: false, ...extra });
  const rows = [
    row('Fran', 'BENCHMARK', 'Girls', 'TIME', { hidden: true }),
    row('Sled Push', 'BENCHMARK', 'Custom', 'TIME', { custom: true }),
    row('Front Squat', 'LIFT', 'Squats', 'WEIGHT'),
    row('Back Squat', 'LIFT', 'Squats', 'WEIGHT'),
    row('Thruster', 'LIFT', 'Custom', 'WEIGHT', { custom: true }),
    row('Grace', 'BENCHMARK', 'Girls', 'TIME'),
    row('Box Squat', 'LIFT', 'Squats', 'WEIGHT', { custom: true }),
    row('Ring Dip', 'LIFT', 'Gimnasia', 'WEIGHT', { custom: true }),
    row('Muscle Up', 'LIFT', 'Gimnasia', 'WEIGHT', { custom: true }),
    row('Sprint', 'CARDIO', 'Mis movimientos', 'TIME', { custom: true }),
  ];
  try {
    setCatalog(buildCatalog(rows));
    const catalog = getCatalog();
    // Shared movements keep the base order; own ones join their group, older ones share "Mis movimientos".
    assert.deepEqual(catalog.Lift.groups.map((group) => [group.name, group.moves]), [
      ['Squats', ['Back Squat', 'Front Squat', 'Box Squat']], ['Gimnasia', ['Muscle Up', 'Ring Dip']], ['Mis movimientos', ['Thruster']],
    ]);
    assert.deepEqual(catalog.Cardio.groups.map((group) => [group.name, group.moves]), [['Mis movimientos', ['Sprint']]]);
    const colors = Object.fromEntries(catalog.Lift.groups.map((group) => [group.name, group.color]));
    assert.equal(colors['Mis movimientos'], '--indigo');
    assert.match(colors.Gimnasia, /^--[a-z]+$/);
    assert.notEqual(colors.Gimnasia, '--muted');
    assert.deepEqual(catalog.Benchmarks.groups.map((group) => [group.name, group.moves]), [
      ['Girls', ['Grace']], ['Mis movimientos', ['Sled Push']],
    ]);
    assert.deepEqual(weightGroups().flatMap((group) => group.moves), ['Back Squat', 'Front Squat', 'Box Squat', 'Muscle Up', 'Ring Dip', 'Thruster']);
    assert.equal(moveInfo('Thruster').type, 'weight');
    assert.equal(moveInfo('Sled Push').type, 'time');
    // A turned-off movement leaves the lists but its records keep their unit.
    assert.equal(moveInfo('Fran').type, 'time');
    assert.equal(moveInfo('Fran').group.name, 'Girls');
    assert.equal(catalog.Benchmarks.groups.some((group) => group.moves.includes('Fran')), false);
    // Turning off every movement of a tab leaves it empty instead of failing.
    setCatalog(buildCatalog(rows.map((item) => ({ ...item, hidden: true }))));
    assert.deepEqual(getCatalog().Lift.groups, []);
  } finally { setCatalog(null); }
  assert.equal(getCatalog().Lift.groups[0].moves[0], 'Back Squat');
});
