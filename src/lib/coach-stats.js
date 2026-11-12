// What a coach reads from their athletes' work: who did what was programmed, which loads
// they used and how their records move. Pure: everything derives from the data of
// /api/coach/stats — { athletes, sessions, logs, records } — and plain YYYY-MM-DD dates.
//   athlete: { id, name, groupIds, since }       session: { id, date, title, groupId, athleteId, content }
//   log:     { sessionId, athleteId, completedAt, results }
//   record:  { athleteId, move, value, rm, date } (rm is null for time and repetition records)
import { addDays, allItems, itemName, weekStart } from './training.js';

const logKey = (sessionId, athleteId) => `${sessionId}:${athleteId}`;
const rate = (completed, assigned) => (assigned ? completed / assigned : null);

/** Lookups shared by every panel. Build once per data load. */
export function indexStats(data) {
  const logs = new Map(data.logs.map((log) => [logKey(log.sessionId, log.athleteId), log]));
  const sessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date));
  return {
    sessions,
    logOf: (sessionId, athleteId) => logs.get(logKey(sessionId, athleteId)) ?? null,
    // A session counts for an athlete when it targets them or one of their groups, from the day
    // they joined the coach. Group membership is the current one: its history is not kept.
    sessionsOf: (athlete) => sessions.filter((session) => session.date >= athlete.since
      && (session.athleteId === athlete.id || (session.groupId && athlete.groupIds.includes(session.groupId)))),
  };
}

/**
 * Compliance between `from` and `to`, counting only days up to `today`: overall, per week and
 * per athlete. `streak` is how many of the athlete's latest due sessions were completed in a
 * row, and `missed` how many were not, counting back from the most recent.
 */
export function summarize(index, athletes, { from, to, today }) {
  const end = to < today ? to : today;
  const weeks = new Map();
  for (let week = weekStart(from); week <= end; week = addDays(week, 7)) weeks.set(week, { week, assigned: 0, completed: 0 });
  let assigned = 0;
  let completed = 0;
  const thisWeek = weekStart(today);
  const active = new Set();
  const byAthlete = athletes.map((athlete) => {
    const due = index.sessionsOf(athlete).filter((session) => session.date >= from && session.date <= end);
    const done = due.map((session) => Boolean(index.logOf(session.id, athlete.id)?.completedAt));
    let streak = 0;
    let missed = 0;
    for (let at = done.length - 1; at >= 0 && done[at]; at -= 1) streak += 1;
    for (let at = done.length - 1; at >= 0 && !done[at]; at -= 1) missed += 1;
    due.forEach((session, at) => {
      const week = weeks.get(weekStart(session.date));
      week.assigned += 1;
      if (done[at]) { week.completed += 1; if (weekStart(session.date) === thisWeek) active.add(athlete.id); }
    });
    const count = done.filter(Boolean).length;
    assigned += due.length;
    completed += count;
    const last = due.filter((_, at) => done[at]).at(-1)?.date ?? null;
    return { athlete, assigned: due.length, completed: count, rate: rate(count, due.length), streak, missed, lastCompleted: last };
  });
  return {
    assigned, completed, rate: rate(completed, assigned), activeThisWeek: active.size,
    byWeek: [...weeks.values()].map((week) => ({ ...week, rate: rate(week.completed, week.assigned) })),
    byAthlete: byAthlete.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.completed - a.completed || a.athlete.name.localeCompare(b.athlete.name)),
  };
}

/**
 * One row per athlete and one cell per day: 'done', 'partial' (logged something, not finished),
 * 'missed' (past and untouched), 'pending' (today or later) or 'none' (nothing programmed).
 */
export function attendance(index, athletes, days, today) {
  return athletes.map((athlete) => {
    const byDate = new Map(index.sessionsOf(athlete).map((session) => [session.date, session]));
    return {
      athlete,
      cells: days.map((date) => {
        const session = byDate.get(date);
        if (!session) return { date, state: 'none' };
        const log = index.logOf(session.id, athlete.id);
        const state = log?.completedAt ? 'done' : date >= today ? 'pending' : log ? 'partial' : 'missed';
        return { date, state, title: session.title };
      }),
    };
  });
}

const weightRecords = (records, athleteId, move, rm) => records
  .filter((record) => record.athleteId === athleteId && record.move === move && record.rm === rm)
  .sort((a, b) => a.date.localeCompare(b.date));

/** An athlete's best for a movement over time: one point each time the record went up. */
export function bestSeries(records, athleteId, move, rm = 1) {
  const points = [];
  for (const record of weightRecords(records, athleteId, move, rm)) {
    if (!points.length || record.value > points.at(-1).value) points.push({ date: record.date, value: record.value });
  }
  return points;
}

/**
 * How each of an athlete's 1RMs moved between two dates: the best before `from` (or the first one
 * inside the period) against the best up to `to`. Movements without a record by `to` are left out.
 */
export function growthOf(records, athleteId, from, to, rm = 1) {
  const moves = [...new Set(records.filter((record) => record.athleteId === athleteId && record.rm === rm).map((record) => record.move))];
  return moves.map((move) => {
    const series = bestSeries(records, athleteId, move, rm).filter((point) => point.date <= to);
    if (!series.length) return null;
    const start = (series.filter((point) => point.date < from).at(-1) ?? series[0]).value;
    const end = series.at(-1).value;
    return { move, start, end, change: end - start, pct: start ? (end - start) / start : 0 };
  }).filter(Boolean).sort((a, b) => b.pct - a.pct || a.move.localeCompare(b.move));
}

/** Average 1RM growth of an athlete across the movements they have a record for, or null. */
export function averageGrowth(records, athleteId, from, to) {
  const growth = growthOf(records, athleteId, from, to);
  return growth.length ? growth.reduce((sum, entry) => sum + entry.pct, 0) / growth.length : null;
}

/** Records set inside the period that beat the athlete's earlier best, newest first. */
export function newRecords(records, athleteIds, from, to) {
  const wanted = new Set(athleteIds);
  const best = new Map();
  const found = [];
  for (const record of [...records].filter((entry) => entry.rm != null && wanted.has(entry.athleteId)).sort((a, b) => a.date.localeCompare(b.date))) {
    const key = `${record.athleteId}:${record.move}:${record.rm}`;
    const previous = best.get(key) ?? null;
    if (previous == null || record.value > previous) {
      best.set(key, record.value);
      if (record.date >= from && record.date <= to) found.push({ ...record, previous });
    }
  }
  return found.reverse();
}

/** Every weight athletes logged on lines of a catalog movement, oldest first. */
export function loggedLoads(index, athletes, { from, to }) {
  const loads = [];
  for (const athlete of athletes) {
    for (const session of index.sessionsOf(athlete)) {
      if (session.date < from || session.date > to) continue;
      const results = index.logOf(session.id, athlete.id)?.results.items ?? {};
      for (const item of allItems(session.content)) {
        const result = results[item.id];
        if (item.movement && result?.weight > 0) loads.push({ athleteId: athlete.id, move: item.movement, date: session.date, weight: result.weight, reps: result.reps ?? null });
      }
    }
  }
  return loads.sort((a, b) => a.date.localeCompare(b.date));
}

/** Movements with logged weights, the most logged first. */
export function loggedMovements(loads) {
  const counts = new Map();
  for (const load of loads) counts.set(load.move, (counts.get(load.move) ?? 0) + 1);
  return [...counts].map(([move, count]) => ({ move, count })).sort((a, b) => b.count - a.count || a.move.localeCompare(b.move));
}

/**
 * Who did a session and what they wrote down: per athlete it targets, whether they finished and
 * each logged line and block score in the session's order.
 */
export function sessionBoard(index, session, athletes) {
  const items = allItems(session.content);
  return athletes.filter((athlete) => index.sessionsOf(athlete).some((due) => due.id === session.id)).map((athlete) => {
    const log = index.logOf(session.id, athlete.id);
    return {
      athlete,
      completedAt: log?.completedAt ?? null,
      started: Boolean(log),
      lines: items.filter((item) => log?.results.items[item.id]).map((item) => ({ name: itemName(item), ...log.results.items[item.id] })),
      scores: session.content.blocks.filter((block) => log?.results.blocks[block.id])
        .map((block) => ({ name: block.title || 'Resultado', type: block.score, value: log.results.blocks[block.id].value })),
    };
  });
}
