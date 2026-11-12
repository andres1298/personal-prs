import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attendance, averageGrowth, bestSeries, growthOf, indexStats, loggedLoads, loggedMovements, newRecords, sessionBoard, summarize,
} from '../src/lib/coach-stats.js';

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const squat = { id: id(1), movement: 'Back Squat', label: '', sets: 5, reps: '3', load: { type: 'none' }, log: true };
const wod = { id: id(2), title: 'Fran', notes: '', score: 'time', items: [] };
const content = { blocks: [{ id: id(3), title: 'A', notes: '', score: 'none', items: [squat] }, wod] };
const session = (key, date, target) => ({ id: key, date, title: `Day ${date}`, groupId: null, athleteId: null, content, ...target });
const ana = { id: 'ana', name: 'Ana', groupIds: ['g'], since: '2026-10-01' };
const ben = { id: 'ben', name: 'Ben', groupIds: [], since: '2026-11-04' };
const data = {
  sessions: [
    session('s1', '2026-10-26', { groupId: 'g' }), session('s2', '2026-11-02', { groupId: 'g' }), session('s3', '2026-11-04', { groupId: 'g' }),
    session('s4', '2026-11-09', { groupId: 'g' }), session('s5', '2026-11-11', { groupId: 'g' }), session('s6', '2026-11-13', { groupId: 'g' }),
    session('b1', '2026-11-03', { athleteId: 'ben' }), session('b2', '2026-11-10', { athleteId: 'ben' }),
  ],
  logs: [
    { sessionId: 's1', athleteId: 'ana', completedAt: '2026-10-26T18:00:00Z', results: { items: { [squat.id]: { weight: 185, reps: 3 } }, blocks: {} } },
    { sessionId: 's2', athleteId: 'ana', completedAt: '2026-11-02T18:00:00Z', results: { items: { [squat.id]: { weight: 195, reps: 3 } }, blocks: { [wod.id]: { value: 312 } } } },
    { sessionId: 's4', athleteId: 'ana', completedAt: null, results: { items: { [squat.id]: { weight: 200 } }, blocks: {} } },
    { sessionId: 's5', athleteId: 'ana', completedAt: '2026-11-11T18:00:00Z', results: { items: {}, blocks: {} } },
    { sessionId: 'b2', athleteId: 'ben', completedAt: '2026-11-10T18:00:00Z', results: { items: {}, blocks: {} } },
  ],
};
const index = indexStats(data);
const period = { from: '2026-10-26', to: '2026-11-15', today: '2026-11-12' };

test('a session counts for the athletes it targets, from the day they joined', () => {
  assert.deepEqual(index.sessionsOf(ana).map((entry) => entry.id), ['s1', 's2', 's3', 's4', 's5', 's6']);
  // Ben's 1:1 day before he joined does not count against him.
  assert.deepEqual(index.sessionsOf(ben).map((entry) => entry.id), ['b2']);
});

test('compliance counts days up to today, per week and per athlete', () => {
  const summary = summarize(index, [ana, ben], period);
  assert.deepEqual([summary.assigned, summary.completed, summary.activeThisWeek], [6, 4, 2]);
  assert.equal(summary.rate, 4 / 6);
  assert.deepEqual(summary.byWeek.map((week) => [week.week, week.assigned, week.completed]), [['2026-10-26', 1, 1], ['2026-11-02', 2, 1], ['2026-11-09', 3, 2]]);
  const [first, second] = summary.byAthlete;
  assert.deepEqual([first.athlete.id, first.assigned, first.completed, first.streak, first.missed, first.lastCompleted], ['ben', 1, 1, 1, 0, '2026-11-10']);
  assert.deepEqual([second.athlete.id, second.assigned, second.completed, second.streak, second.missed, second.lastCompleted], ['ana', 5, 3, 1, 0, '2026-11-11']);
  // Nothing due yet is not zero percent.
  assert.equal(summarize(index, [ben], { ...period, today: '2026-11-05' }).rate, null);
});

test('attendance tells done, started, missed, pending and rest days apart', () => {
  const [row] = attendance(index, [ana], ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-13'], '2026-11-12');
  assert.deepEqual(row.cells.map((cell) => cell.state), ['done', 'none', 'missed', 'partial', 'done', 'pending']);
});

const records = [
  { athleteId: 'ana', move: 'Back Squat', value: 240, rm: 1, date: '2026-08-01' },
  { athleteId: 'ana', move: 'Back Squat', value: 235, rm: 1, date: '2026-09-01' },
  { athleteId: 'ana', move: 'Back Squat', value: 250, rm: 1, date: '2026-10-30' },
  { athleteId: 'ana', move: 'Back Squat', value: 260, rm: 1, date: '2026-11-10' },
  { athleteId: 'ana', move: 'Back Squat', value: 225, rm: 3, date: '2026-11-01' },
  { athleteId: 'ana', move: 'Snatch', value: 125, rm: 1, date: '2026-11-05' },
  { athleteId: 'ana', move: 'Fran', value: 285, rm: null, date: '2026-11-06' },
  { athleteId: 'ben', move: 'Back Squat', value: 315, rm: 1, date: '2026-07-01' },
];

test('records become a running best and growth over a period', () => {
  assert.deepEqual(bestSeries(records, 'ana', 'Back Squat').map((point) => point.value), [240, 250, 260]);
  const growth = growthOf(records, 'ana', period.from, period.to);
  assert.deepEqual(growth.map((entry) => [entry.move, entry.start, entry.end, entry.change]), [['Back Squat', 240, 260, 20], ['Snatch', 125, 125, 0]]);
  assert.ok(Math.abs(averageGrowth(records, 'ana', period.from, period.to) - (20 / 240) / 2) < 1e-9);
  assert.equal(averageGrowth(records, 'ben', period.from, period.to), 0);
  assert.equal(averageGrowth(records, 'nobody', period.from, period.to), null);
});

test('new records are the ones that beat the earlier best inside the period', () => {
  const found = newRecords(records, ['ana', 'ben'], period.from, period.to);
  assert.deepEqual(found.map((record) => [record.move, record.rm, record.value, record.previous]),
    [['Back Squat', 1, 260, 250], ['Snatch', 1, 125, null], ['Back Squat', 3, 225, null], ['Back Squat', 1, 250, 240]]);
  assert.deepEqual(newRecords(records, ['ben'], period.from, period.to), []);
});

test('logged loads and the session board read what athletes wrote', () => {
  const loads = loggedLoads(index, [ana, ben], period);
  assert.deepEqual(loads.map((load) => [load.date, load.weight, load.reps]), [['2026-10-26', 185, 3], ['2026-11-02', 195, 3], ['2026-11-09', 200, null]]);
  assert.deepEqual(loggedMovements(loads), [{ move: 'Back Squat', count: 3 }]);
  const board = sessionBoard(index, data.sessions[1], [ana, ben]);
  assert.deepEqual(board.map((row) => row.athlete.id), ['ana']);
  assert.deepEqual([board[0].lines, board[0].scores], [[{ name: 'Back Squat', weight: 195, reps: 3 }], [{ name: 'Fran', type: 'time', value: 312 }]]);
  const untouched = sessionBoard(index, data.sessions[2], [ana])[0];
  assert.deepEqual([untouched.started, untouched.completedAt, untouched.lines], [false, null, []]);
});
