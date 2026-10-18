import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PREP_MS, addRound, buildPlan, cuesBetween, finish, formatClock, normalizeConfig, pause, restoreRun, resume, snapshot, start, undoRound,
} from '../src/lib/timer-engine.js';

const s = (seconds) => seconds * 1000;
const kinds = (plan) => plan.segments.map((segment) => `${segment.kind}:${segment.duration / 1000}:${segment.round}`);
const cueList = (plan, from, to) => cuesBetween(plan, from, to).map(({ at, cue }) => `${at / 1000}:${cue}`);

test('templates expand into a 10 second preparation followed by their segments', () => {
  assert.deepEqual(kinds(buildPlan({ type: 'amrap', duration: s(720) })), ['prep:10:0', 'work:720:1']);
  assert.deepEqual(kinds(buildPlan({ type: 'emom', interval: s(60), rounds: 3 })), ['prep:10:0', 'work:60:1', 'work:60:2', 'work:60:3']);
  assert.deepEqual(kinds(buildPlan({ type: 'tabata', work: s(20), rest: s(10), rounds: 3 })),
    ['prep:10:0', 'work:20:1', 'rest:10:1', 'work:20:2', 'rest:10:2', 'work:20:3']);
  assert.deepEqual(kinds(buildPlan({ type: 'fortime', cap: s(600) })), ['prep:10:0', 'work:600:1']);
  const tabata = buildPlan({ type: 'tabata', work: s(20), rest: s(10), rounds: 8 });
  assert.equal(tabata.workTotal, s(230));
  assert.equal(tabata.total, PREP_MS + s(230));
  assert.equal(tabata.totalRounds, 8);
});

test('configurations are completed with defaults, rounded to seconds and clamped', () => {
  assert.deepEqual(normalizeConfig({ type: 'emom' }), { type: 'emom', interval: s(60), rounds: 10 });
  assert.deepEqual(normalizeConfig({ type: 'tabata', work: 1, rest: s(7200), rounds: 99 }), { type: 'tabata', work: s(5), rest: s(3600), rounds: 50 });
  assert.deepEqual(normalizeConfig({ type: 'amrap', duration: 61_400 }), { type: 'amrap', duration: s(61) });
  assert.deepEqual(normalizeConfig({ type: 'fortime', cap: 'x' }), { type: 'fortime', cap: s(720) });
  assert.throws(() => normalizeConfig({ type: 'unknown' }));
});

test('cues mark preparation ticks, start, half, segment changes, final ticks and end once', () => {
  const plan = buildPlan({ type: 'emom', interval: s(60), rounds: 4 });
  assert.deepEqual(cueList(plan, 0, plan.total), [
    '7:tick', '8:tick', '9:tick', '10:start', '70:round', '130:half', '190:round', '247:tick', '248:tick', '249:tick', '250:end',
  ]);
  // Ranges are half-open so consecutive ticks never repeat a cue.
  assert.deepEqual([...cueList(plan, 0, s(10)), ...cueList(plan, s(10), s(70))], ['7:tick', '8:tick', '9:tick', '10:start', '70:round']);
});

test('short workouts keep the highest priority cue when cues share an instant', () => {
  const plan = buildPlan({ type: 'amrap', duration: s(6) });
  // Half (13 s) coincides with the first final tick, which wins.
  assert.deepEqual(cueList(plan, 0, plan.total), ['7:tick', '8:tick', '9:tick', '10:start', '13:tick', '14:tick', '15:tick', '16:end']);
});

test('snapshots derive phase, round and remaining time from timestamps, including pauses', () => {
  const t0 = 1_000_000;
  let run = start({ type: 'tabata', work: s(20), rest: s(10), rounds: 2 }, t0);
  let view = snapshot(run, t0 + 400);
  assert.equal(view.segment.kind, 'prep');
  assert.equal(formatClock(view.segmentRemaining, { ceil: true }), '0:10');
  view = snapshot(run, t0 + s(31.5));
  assert.equal(view.segment.kind, 'rest');
  assert.equal(view.segment.round, 1);
  assert.equal(formatClock(view.segmentRemaining, { ceil: true }), '0:09');
  run = pause(run, t0 + s(31.5));
  assert.equal(snapshot(run, t0 + s(500)).elapsed, s(31.5));
  assert.equal(snapshot(run, t0 + s(500)).paused, true);
  run = resume(run, t0 + s(500));
  view = snapshot(run, t0 + s(510));
  assert.equal(view.elapsed, s(41.5));
  assert.equal(view.segment.round, 2);
  assert.equal(view.done, false);
  view = snapshot(run, t0 + s(9999));
  assert.equal(view.done, true);
  assert.equal(view.elapsed, view.plan.total);
});

test('actions are immutable and finishing freezes the result', () => {
  const t0 = 5_000;
  const run = start({ type: 'amrap', duration: s(60) }, t0);
  const counted = addRound(addRound(run));
  assert.equal(run.rounds, 0);
  assert.equal(undoRound(counted).rounds, 1);
  assert.equal(undoRound(run).rounds, 0);
  const paused = pause(counted, t0 + s(30));
  const done = finish(paused, t0 + s(90), 'stopped');
  assert.equal(done.finalElapsed, s(30));
  assert.equal(done.finishReason, 'stopped');
  assert.equal(done.pausedAt, null);
  assert.equal(snapshot(done, t0 + s(400)).elapsed, s(30));
  assert.equal(snapshot(done, t0 + s(400)).done, true);
  assert.equal(finish(done, t0 + s(500), 'complete'), done);
  assert.equal(addRound(done), done);
  assert.equal(pause(done, t0), done);
  const late = finish(start({ type: 'fortime', cap: s(60) }, t0), t0 + s(500), 'done');
  assert.equal(late.finalElapsed, PREP_MS + s(60));
});

test('stored runs are restored only when well formed', () => {
  const run = start({ type: 'emom', interval: s(30), rounds: 5 }, 42);
  assert.deepEqual(restoreRun(JSON.parse(JSON.stringify(run))), run);
  for (const value of [null, 'x', {}, { ...run, startedAt: 'x' }, { ...run, config: { type: 'nope' } }, { ...run, rounds: -1 }]) {
    assert.equal(restoreRun(value), null);
  }
});

test('clock formatting supports countdown ceiling and long durations', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(400, { ceil: true }), '0:01');
  assert.equal(formatClock(59_999), '0:59');
  assert.equal(formatClock(s(754)), '12:34');
  assert.equal(formatClock(s(3600)), '60:00');
});
