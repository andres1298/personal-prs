// Pure workout timer engine. All times are milliseconds; state is derived from
// timestamps so a suspended or reloaded page resumes with the exact time.

export const PREP_MS = 10_000;
const MIN_SEGMENT = 5_000;
const MAX_SEGMENT = 3_600_000;
const MAX_ROUNDS = 50;

const DEFAULTS = {
  amrap: { duration: 720_000 },
  emom: { interval: 60_000, rounds: 10 },
  tabata: { work: 20_000, rest: 10_000, rounds: 8 },
  fortime: { cap: 720_000 },
};
export const TIMER_TYPES = Object.keys(DEFAULTS);

// Recommended configurations offered as one-tap shortcuts per template.
export const PRESETS = {
  amrap: [{ duration: 300_000 }, { duration: 600_000 }, { duration: 720_000 }, { duration: 900_000 }, { duration: 1_200_000 }],
  emom: [
    { interval: 60_000, rounds: 10 }, { interval: 60_000, rounds: 20 },
    { interval: 90_000, rounds: 10 }, { interval: 120_000, rounds: 8 },
  ],
  tabata: [
    { work: 20_000, rest: 10_000, rounds: 8 }, { work: 30_000, rest: 15_000, rounds: 8 },
    { work: 40_000, rest: 20_000, rounds: 8 }, { work: 45_000, rest: 15_000, rounds: 6 },
  ],
  fortime: [{ cap: 600_000 }, { cap: 900_000 }, { cap: 1_200_000 }, { cap: 1_800_000 }],
};

// Higher wins when several cues share an instant.
const CUE_PRIORITY = { end: 5, tick: 4, half: 3, start: 2, round: 1 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const segmentValue = (value, fallback) =>
  Number.isFinite(value) ? clamp(Math.round(value / 1000) * 1000, MIN_SEGMENT, MAX_SEGMENT) : fallback;
const roundsValue = (value, fallback) => (Number.isFinite(value) ? clamp(Math.round(value), 1, MAX_ROUNDS) : fallback);

export function normalizeConfig(config) {
  const defaults = DEFAULTS[config?.type];
  if (!defaults) throw new Error('Unknown timer type.');
  const normalized = { type: config.type };
  for (const [key, fallback] of Object.entries(defaults)) {
    normalized[key] = key === 'rounds' ? roundsValue(config[key], fallback) : segmentValue(config[key], fallback);
  }
  return normalized;
}

export function buildPlan(config) {
  const normalized = normalizeConfig(config);
  const segments = [];
  let cursor = 0;
  const add = (kind, duration, round) => { segments.push({ kind, start: cursor, duration, round }); cursor += duration; };
  add('prep', PREP_MS, 0);
  let totalRounds = 1;
  if (normalized.type === 'amrap') add('work', normalized.duration, 1);
  if (normalized.type === 'fortime') add('work', normalized.cap, 1);
  if (normalized.type === 'emom') {
    totalRounds = normalized.rounds;
    for (let round = 1; round <= totalRounds; round++) add('work', normalized.interval, round);
  }
  if (normalized.type === 'tabata') {
    totalRounds = normalized.rounds;
    for (let round = 1; round <= totalRounds; round++) {
      add('work', normalized.work, round);
      if (round < totalRounds) add('rest', normalized.rest, round);
    }
  }
  const plan = { config: normalized, segments, workStart: PREP_MS, total: cursor, workTotal: cursor - PREP_MS, totalRounds };
  plan.cues = planCues(plan);
  return plan;
}

function planCues({ segments, workStart, total, workTotal }) {
  const events = [];
  events.push({ at: workStart, cue: 'start' });
  events.push({ at: workStart + Math.round(workTotal / 2000) * 1000, cue: 'half' });
  for (const segment of segments) if (segment.start > workStart) events.push({ at: segment.start, cue: 'round' });
  events.push({ at: total, cue: 'end' });
  // 3-2-1 before the workout starts, before every segment change and before the end.
  const boundaries = [...segments.filter((segment) => segment.start > 0).map((segment) => segment.start), total];
  for (const boundary of boundaries) {
    for (const offset of [3000, 2000, 1000]) events.push({ at: boundary - offset, cue: 'tick' });
  }
  const byInstant = new Map();
  for (const event of events) {
    const current = byInstant.get(event.at);
    if (!current || CUE_PRIORITY[event.cue] > CUE_PRIORITY[current.cue]) byInstant.set(event.at, event);
  }
  return [...byInstant.values()].sort((a, b) => a.at - b.at);
}

// Cues crossed in the half-open elapsed range (from, to].
export function cuesBetween(plan, from, to) {
  return plan.cues.filter(({ at }) => at > from && at <= to);
}

export function start(config, now) {
  return { config: normalizeConfig(config), startedAt: now, pausedAt: null, pausedTotal: 0, rounds: 0, finalElapsed: null, finishReason: null };
}

const isFinished = (run) => run.finalElapsed !== null;

function elapsedAt(run, now) {
  if (isFinished(run)) return run.finalElapsed;
  const reference = run.pausedAt ?? now;
  return Math.max(0, reference - run.startedAt - run.pausedTotal);
}

export function snapshot(run, now) {
  const plan = buildPlan(run.config);
  const elapsed = Math.min(elapsedAt(run, now), plan.total);
  const done = isFinished(run) || elapsed >= plan.total;
  let segmentIndex = plan.segments.findIndex((segment) => elapsed < segment.start + segment.duration);
  if (segmentIndex === -1) segmentIndex = plan.segments.length - 1;
  const segment = plan.segments[segmentIndex];
  return {
    plan, elapsed, done,
    paused: run.pausedAt !== null && !done,
    segment, segmentIndex,
    segmentElapsed: elapsed - segment.start,
    segmentRemaining: segment.start + segment.duration - elapsed,
    workElapsed: Math.max(0, elapsed - plan.workStart),
    workRemaining: plan.total - Math.max(elapsed, plan.workStart),
    rounds: run.rounds,
    finishReason: run.finishReason,
  };
}

export function pause(run, now) {
  if (isFinished(run) || run.pausedAt !== null) return run;
  return { ...run, pausedAt: now };
}

export function resume(run, now) {
  if (isFinished(run) || run.pausedAt === null) return run;
  return { ...run, pausedAt: null, pausedTotal: run.pausedTotal + Math.max(0, now - run.pausedAt) };
}

export function addRound(run) {
  return isFinished(run) ? run : { ...run, rounds: run.rounds + 1 };
}

export function undoRound(run) {
  return isFinished(run) || run.rounds === 0 ? run : { ...run, rounds: run.rounds - 1 };
}

export function finish(run, now, reason) {
  if (isFinished(run)) return run;
  const finalElapsed = Math.min(elapsedAt(run, now), buildPlan(run.config).total);
  return { ...run, pausedAt: null, finalElapsed, finishReason: reason };
}

export function restoreRun(value) {
  if (!value || typeof value !== 'object') return null;
  const { startedAt, pausedAt, pausedTotal, rounds, finalElapsed, finishReason } = value;
  const isTime = (n) => Number.isFinite(n) && n >= 0;
  if (!isTime(startedAt) || !isTime(pausedTotal) || !(pausedAt === null || isTime(pausedAt)) ||
      !Number.isInteger(rounds) || rounds < 0 || !(finalElapsed === null || isTime(finalElapsed)) ||
      !(finishReason === null || typeof finishReason === 'string')) return null;
  try {
    return { config: normalizeConfig(value.config), startedAt, pausedAt, pausedTotal, rounds, finalElapsed, finishReason };
  } catch {
    return null;
  }
}

// Typed durations read like a microwave keypad: the last two digits are seconds
// and the rest are minutes, so "130" is 1:30 and "2000" is 20:00.
export function parseDigits(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const seconds = Number(digits.slice(-2));
  const minutes = Number(digits.slice(0, -2) || 0);
  return (minutes * 60 + seconds) * 1000;
}

export function toDigits(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}${String(seconds % 60).padStart(2, '0')}` : `${seconds}`;
}

export function matchesPreset(config, preset) {
  return Object.entries(preset).every(([key, value]) => config[key] === value);
}

export function formatClock(ms, { ceil = false } = {}) {
  const seconds = Math.max(0, ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
