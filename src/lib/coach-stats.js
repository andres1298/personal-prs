// What a coach reads from their athletes' work: who did what was programmed, which loads
// they used and what they scored. Pure: everything derives from the data of
// /api/coach/stats — { athletes, sessions, logs } — and plain YYYY-MM-DD dates.
//   athlete: { id, name, groupIds, since }       session: { id, date, title, groupId, athleteId, content }
//   log:     { sessionId, athleteId, completedAt, results }
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

/**
 * One session in numbers: how many of its athletes finished it, and for every line and block
 * score they logged, each athlete's value with the average and the best (the lowest for a time,
 * the highest otherwise). `metrics` follow the session's order; ones nobody logged are left out.
 */
export function sessionStats(index, session, athletes) {
  const rows = sessionBoard(index, session, athletes);
  const completed = rows.filter((row) => row.completedAt).length;
  const logs = rows.map((row) => ({ athlete: row.athlete, results: index.logOf(session.id, row.athlete.id)?.results }));
  const metric = (key, name, kind, entries) => {
    if (!entries.length) return null;
    const values = entries.map((entry) => entry.value);
    const bestValue = kind === 'time' ? Math.min(...values) : Math.max(...values);
    const sorted = [...entries].sort((a, b) => (kind === 'time' ? a.value - b.value : b.value - a.value));
    return { key, name, kind, entries: sorted, average: values.reduce((sum, value) => sum + value, 0) / values.length, best: sorted.find((entry) => entry.value === bestValue) };
  };
  const metrics = session.content.blocks.flatMap((block) => [
    ...block.items.map((item) => metric(item.id, itemName(item), 'weight', logs
      .filter((log) => log.results?.items[item.id]?.weight > 0)
      .map((log) => ({ athlete: log.athlete, value: log.results.items[item.id].weight, reps: log.results.items[item.id].reps ?? null })))),
    block.score === 'none' ? null : metric(block.id, block.title || 'Resultado', block.score, logs
      .filter((log) => log.results?.blocks[block.id]).map((log) => ({ athlete: log.athlete, value: log.results.blocks[block.id].value }))),
  ]).filter(Boolean);
  return { rows, total: rows.length, completed, rate: rows.length ? completed / rows.length : null, metrics };
}
