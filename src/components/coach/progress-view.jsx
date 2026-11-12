'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatValue, today as todayDate } from '../../lib/catalog';
import {
  attendance, averageGrowth, bestSeries, growthOf, indexStats, loggedLoads, loggedMovements, newRecords, sessionBoard, summarize,
} from '../../lib/coach-stats';
import { addDays, weekStart } from '../../lib/training';
import Icon from '../ui/icon';
import Chart, { SERIES_COLORS } from './chart';
import { Choice } from './line-editor';

const PERIODS = [{ value: 4, label: '4 semanas' }, { value: 12, label: '12 semanas' }, { value: 26, label: '6 meses' }];
const STATE_LABELS = { done: 'Completó', partial: 'Empezó y no completó', missed: 'No la hizo', pending: 'Pendiente', none: 'Sin sesión' };
const percent = (value) => (value == null ? '–' : `${Math.round(value * 100)} %`);
const signed = (value) => `${value > 0 ? '+' : ''}${Math.round(value * 1000) / 10} %`;
const shortDate = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
const weekLabel = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
// Green from 80 %, yellow from 50 %, coral below: the same reading everywhere on the page.
const rateColor = (value) => (value == null ? '--surface2' : value >= 0.8 ? '--b-green' : value >= 0.5 ? '--b-yellow' : '--b-coral');

/** Counts up to `value` when it changes, so a figure arrives instead of just appearing. */
function useCountUp(value, duration = 900) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(value)) return undefined;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return undefined; }
    let frame;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

function Kpi({ color, icon, label, value, format = Math.round, detail, index }) {
  const shown = useCountUp(value ?? NaN);
  return <article className="kpi" style={{ '--c': `var(${color})`, '--i': index }}>
    <span className="kpi-icon"><Icon name={icon} weight={2.4} /></span>
    <p className="kpi-label">{label}</p>
    <p className="kpi-value display num">{value == null ? '–' : format(shown)}</p>
    <p className="kpi-detail">{detail}</p>
  </article>;
}

function Card({ title, hint, children, wide, index = 0, action }) {
  return <section className={`stat-card${wide ? ' wide' : ''}`} style={{ '--i': index }}>
    <header><div><h2>{title}</h2>{hint && <p>{hint}</p>}</div>{action}</header>
    {children}
  </section>;
}

const Empty = ({ children }) => <p className="stat-empty">{children}</p>;

/**
 * The coach's analysis page, apart from the calendar: how much of the programming gets done,
 * who did each day and with which loads, and how each athlete's records grow. One athlete or
 * group can be picked to narrow every panel; an athlete also opens their own detail.
 */
export default function ProgressView({ api }) {
  const [weeks, setWeeks] = useState(12);
  const [scope, setScope] = useState('all');   // 'all' | 'group:<id>' | 'athlete:<id>'
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const today = todayDate();
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const to = addDays(weekStart(today), 6);

  const load = useCallback(async () => {
    try { setData(await api.send(`/api/coach/stats?from=${from}&to=${to}`, 'GET')); setError(''); }
    catch (err) { setError(err.message); }
  }, [api, from, to]);
  useEffect(() => { load(); }, [load]);

  const index = useMemo(() => (data ? indexStats(data) : null), [data]);
  const [kind, scopeId] = scope.split(':');
  const athletes = useMemo(() => {
    if (!data) return [];
    if (kind === 'group') return data.athletes.filter((athlete) => athlete.groupIds.includes(scopeId));
    if (kind === 'athlete') return data.athletes.filter((athlete) => athlete.id === scopeId);
    return data.athletes;
  }, [data, kind, scopeId]);
  const focused = kind === 'athlete' ? athletes[0] : null;
  const period = useMemo(() => ({ from, to, today }), [from, to, today]);
  const summary = useMemo(() => (index ? summarize(index, athletes, period) : null), [index, athletes, period]);
  const ids = useMemo(() => athletes.map((athlete) => athlete.id), [athletes]);
  const fresh = useMemo(() => (data ? newRecords(data.records, ids, from, today) : []), [data, ids, from, today]);
  const loads = useMemo(() => (index ? loggedLoads(index, athletes, period) : []), [index, athletes, period]);

  const filters = <div className="coach-head-tools">
    <label className="target-select">
      <span>Ver</span>
      <select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="all">Todos mis atletas</option>
        {data?.groups.length > 0 && <optgroup label="Grupos">{data.groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name}</option>)}</optgroup>}
        {data?.athletes.length > 0 && <optgroup label="Atletas">{data.athletes.map((athlete) => <option key={athlete.id} value={`athlete:${athlete.id}`}>{athlete.name}</option>)}</optgroup>}
      </select>
    </label>
    <Choice label="Periodo" size="small" options={PERIODS} value={weeks} onChange={setWeeks} />
  </div>;

  if (error) return <><header className="coach-head"><h1 className="display">Progreso</h1></header>
    <div className="banner warn" role="alert"><span>{error}</span><button type="button" className="pill-btn" onClick={load}>Reintentar</button></div></>;
  if (!data || !summary) return <><header className="coach-head"><h1 className="display">Progreso</h1></header>
    <div className="stat-skeleton" aria-label="Cargando">{Array.from({ length: 6 }, (_, at) => <i key={at} style={{ '--i': at }} />)}</div></>;
  if (!data.athletes.length) return <section className="coach-empty">
    <h1 className="display">Progreso</h1>
    <p>Aquí verás el cumplimiento, los pesos y el crecimiento de tus atletas. Todavía no tienes atletas: invítalos desde la sección Atletas.</p>
  </section>;

  const growthAverage = (() => {
    const values = athletes.map((athlete) => averageGrowth(data.records, athlete.id, from, today)).filter((value) => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  })();
  const attention = summary.byAthlete.filter((row) => row.assigned > 0 && (row.missed >= 2 || row.rate < 0.5));

  return <div className="progress" key={`${scope}:${weeks}`}>
    <header className="coach-head">
      <div><h1 className="display">Progreso</h1><p className="coach-lead">{focused ? focused.name : kind === 'group' ? `Grupo ${data.groups.find((group) => group.id === scopeId)?.name}` : 'Todos tus atletas'} · del {shortDate(from)} a hoy</p></div>
      {filters}
    </header>

    <div className="kpis">
      <Kpi index={0} color={rateColor(summary.rate)} icon="check" label="Cumplimiento" value={summary.rate == null ? null : summary.rate * 100} format={(value) => `${Math.round(value)}%`}
        detail={`${summary.completed} de ${summary.assigned} sesiones completadas`} />
      <Kpi index={1} color="--b-blue" icon="people" label={focused ? 'Racha actual' : 'Activos esta semana'}
        value={focused ? summary.byAthlete[0]?.streak ?? 0 : summary.activeThisWeek}
        detail={focused ? 'sesiones seguidas completadas' : `de ${athletes.length} ${athletes.length === 1 ? 'atleta' : 'atletas'} completaron algo`} />
      <Kpi index={2} color="--b-pink" icon="trophy" label="PRs nuevos" value={fresh.length} detail="récords superados en el periodo" />
      <Kpi index={3} color="--b-lilac" icon="chart" label="Crecimiento de 1RM" value={growthAverage == null ? null : growthAverage * 100}
        format={(value) => `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}%`} detail="promedio de sus levantamientos" />
    </div>

    <div className="stat-grid">
      <Card index={0} title="Cumplimiento por semana" hint="Sesiones completadas de las programadas. Verde desde 80 %, amarillo desde 50 %.">
        {summary.assigned ? <Chart deps={[data, scope, weeks]} summary={`Cumplimiento semanal: ${summary.byWeek.map((week) => `${weekLabel(week.week)} ${percent(week.rate)}`).join(', ')}`}
          build={({ token }) => ({
            type: 'bar',
            data: { labels: summary.byWeek.map((week) => weekLabel(week.week)), datasets: [{
              data: summary.byWeek.map((week) => (week.rate == null ? null : Math.round(week.rate * 100))),
              backgroundColor: summary.byWeek.map((week) => token(rateColor(week.rate))), borderRadius: 8, borderSkipped: false, maxBarThickness: 46,
            }] },
            options: {
              scales: { y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } }, x: { grid: { display: false } } },
              plugins: { tooltip: { callbacks: { label: (context) => { const week = summary.byWeek[context.dataIndex]; return `${week.completed} de ${week.assigned} · ${context.parsed.y}%`; } } } },
            },
          })} /> : <Empty>No hubo sesiones programadas en este periodo.</Empty>}
      </Card>

      {!focused && <Card index={1} title="Cumplimiento por atleta" hint="Toca un nombre para abrir su detalle.">
        <div className="rank">
          {summary.byAthlete.map((row, at) => <button type="button" key={row.athlete.id} className="rank-row" style={{ '--i': at, '--c': `var(${rateColor(row.rate)})`, '--w': `${Math.round((row.rate ?? 0) * 100)}%` }}
            onClick={() => setScope(`athlete:${row.athlete.id}`)}>
            <span className="rank-name">{row.athlete.name}</span>
            <span className="rank-bar"><i /></span>
            <b className="num">{percent(row.rate)}</b>
            <small>{row.assigned ? `${row.completed}/${row.assigned}${row.streak > 1 ? ` · racha ${row.streak}` : ''}` : 'sin sesiones'}</small>
          </button>)}
        </div>
      </Card>}

      {focused && <AthleteRecords index={1} data={data} athlete={focused} from={from} today={today} />}

      <Card index={2} wide title="Quién completó cada día" hint="Las últimas tres semanas, día por día.">
        <Attendance index={index} athletes={athletes} today={today} onPick={focused ? null : (athleteId) => setScope(`athlete:${athleteId}`)} />
      </Card>

      <Card index={3} wide title="Sesión por sesión" hint="Quién la completó y qué anotó cada persona.">
        <Board index={index} athletes={athletes} today={today} from={from} />
      </Card>

      <Loads index={4} data={data} athletes={athletes} loads={loads} from={from} today={today} focused={focused} />

      {!focused && <Card index={5} title="Crecimiento de 1RM por atleta" hint="Cambio promedio de sus récords de 1RM en el periodo.">
        <GrowthChart data={data} athletes={athletes} from={from} today={today} deps={[data, scope, weeks]} />
      </Card>}

      {focused && <Card index={5} title="Cambio por levantamiento" hint="1RM al empezar el periodo y ahora.">
        <GrowthTable growth={growthOf(data.records, focused.id, from, today)} />
      </Card>}

      <Card index={6} title="PRs nuevos" hint="Récords que superaron el anterior en este periodo.">
        {fresh.length ? <ul className="pr-feed">
          {fresh.slice(0, 12).map((record, at) => <li key={`${record.athleteId}${record.move}${record.rm}${record.date}`} style={{ '--i': at }}>
            <span className="tile" style={{ '--c': 'var(--b-pink)' }}><Icon name="trophy" /></span>
            <span><b>{!focused && `${data.athletes.find((athlete) => athlete.id === record.athleteId)?.name} · `}{record.move} {record.rm}RM</b>
              <small>{shortDate(record.date)}{record.previous ? ` · antes ${record.previous} lb` : ' · primer registro'}</small></span>
            <b className="pr-feed-value display num">{record.value}<small>lb</small></b>
          </li>)}
        </ul> : <Empty>Nadie superó un récord en este periodo.</Empty>}
      </Card>

      {!focused && <Card index={7} title="Necesitan atención" hint="Dos o más sesiones seguidas sin hacer, o menos de la mitad completadas.">
        {attention.length ? <ul className="pr-feed">
          {attention.map((row, at) => <li key={row.athlete.id} style={{ '--i': at }}>
            <span className="tile" style={{ '--c': 'var(--b-coral)' }}><Icon name="flag" /></span>
            <span><b>{row.athlete.name}</b>
              <small>{row.missed >= 2 ? `${row.missed} sesiones seguidas sin hacer` : `${percent(row.rate)} de cumplimiento`}{row.lastCompleted ? ` · última el ${shortDate(row.lastCompleted)}` : ' · ninguna completada'}</small></span>
            <button type="button" className="tinted-button small" onClick={() => setScope(`athlete:${row.athlete.id}`)}>Ver</button>
          </li>)}
        </ul> : <Empty>Todos van al día. 👏</Empty>}
      </Card>}
    </div>
  </div>;
}

// Three weeks as a grid: one row per athlete, one colored cell per day.
function Attendance({ index, athletes, today, onPick }) {
  const start = addDays(weekStart(today), -14);
  const days = Array.from({ length: 21 }, (_, at) => addDays(start, at));
  const rows = attendance(index, athletes, days, today);
  return <div className="heat" role="table" aria-label="Asistencia de las últimas tres semanas">
    <div className="heat-row head" role="row">
      <span role="columnheader">Atleta</span>
      {days.map((date) => <span key={date} role="columnheader" data-today={date === today} data-monday={weekStart(date) === date}>
        <small>{'LMXJVSD'[(new Date(`${date}T12:00`).getDay() + 6) % 7]}</small>{Number(date.slice(8))}
      </span>)}
    </div>
    {rows.map((row, rowAt) => <div className="heat-row" role="row" key={row.athlete.id}>
      {onPick ? <button type="button" role="rowheader" onClick={() => onPick(row.athlete.id)}>{row.athlete.name}</button> : <span role="rowheader">{row.athlete.name}</span>}
      {row.cells.map((cell, at) => <i key={cell.date} role="cell" data-state={cell.state} data-monday={weekStart(cell.date) === cell.date} style={{ '--i': rowAt * 3 + at }}
        title={`${shortDate(cell.date)} · ${STATE_LABELS[cell.state]}${cell.title ? ` · ${cell.title}` : ''}`} aria-label={`${shortDate(cell.date)}: ${STATE_LABELS[cell.state]}`} />)}
    </div>)}
    <p className="heat-legend">{['done', 'partial', 'missed', 'pending', 'none'].map((state) => <span key={state}><i data-state={state} />{STATE_LABELS[state]}</span>)}</p>
  </div>;
}

// One past session at a time: who finished it and every weight and score they logged.
function Board({ index, athletes, today, from }) {
  const sessions = useMemo(() => index.sessions.filter((session) => session.date <= today && session.date >= from
    && athletes.some((athlete) => index.sessionsOf(athlete).some((due) => due.id === session.id))).reverse(), [index, athletes, today, from]);
  const [sessionId, setSessionId] = useState(null);
  const session = sessions.find((candidate) => candidate.id === sessionId) ?? sessions[0];
  if (!session) return <Empty>Todavía no hay sesiones pasadas en este periodo.</Empty>;
  const rows = sessionBoard(index, session, athletes);
  const done = rows.filter((row) => row.completedAt).length;
  return <>
    <div className="board-head">
      <select aria-label="Sesión" value={session.id} onChange={(event) => setSessionId(event.target.value)}>
        {sessions.map((candidate) => <option key={candidate.id} value={candidate.id}>{shortDate(candidate.date)} · {candidate.title || 'Sesión'}</option>)}
      </select>
      <p><b className="num">{done} de {rows.length}</b> la completaron</p>
    </div>
    <div className="board">
      {rows.map((row, at) => <article key={row.athlete.id} className="board-row" data-state={row.completedAt ? 'done' : row.started ? 'partial' : 'missed'} style={{ '--i': at }}>
        <header><b>{row.athlete.name}</b><span>{row.completedAt ? 'Completó' : row.started ? 'Empezó' : 'No la hizo'}</span></header>
        {row.lines.map((line, lineAt) => <p key={lineAt}><span>{line.name}</span>
          <b className="num">{[line.weight != null && `${line.weight} lb`, line.reps != null && `${line.reps} reps`].filter(Boolean).join(' × ')}</b></p>)}
        {row.scores.map((score, scoreAt) => <p key={`s${scoreAt}`}><span>{score.name}</span><b className="num">{formatValue(score.value, score.type)}</b></p>)}
        {!row.lines.length && !row.scores.length && <p className="muted">{row.started ? 'Sin pesos ni resultados anotados.' : '—'}</p>}
      </article>)}
    </div>
  </>;
}

// Loads logged on one movement: for a group, each athlete's best next to their 1RM; for one athlete, every logged weight over time.
function Loads({ index, data, athletes, loads, from, today, focused }) {
  const moves = useMemo(() => loggedMovements(loads), [loads]);
  const [picked, setPicked] = useState(null);
  const move = moves.some((entry) => entry.move === picked) ? picked : moves[0]?.move;
  const title = focused ? 'Pesos que anotó' : 'Pesos usados por movimiento';
  const hint = focused ? 'Cada peso que registró en las sesiones, junto a su 1RM.' : 'El mejor peso que anotó cada atleta en el periodo, junto a su 1RM.';
  if (!move) return <Card index={index} wide title={title} hint={hint}><Empty>Nadie ha anotado pesos en este periodo. Activa «El atleta anota» en las líneas que quieras seguir.</Empty></Card>;
  const ofMove = loads.filter((load) => load.move === move);
  const oneRm = (athleteId) => bestSeries(data.records, athleteId, move).filter((point) => point.date <= today).at(-1)?.value ?? null;
  const picker = <Choice label="Movimiento" size="small" options={moves.slice(0, 8).map((entry) => ({ value: entry.move, label: entry.move }))} value={move} onChange={setPicked} />;

  return <Card index={index} wide title={title} hint={hint}>
    {picker}
    {focused ? <Chart deps={[data, move, focused.id, from]} height={280} summary={`Pesos anotados en ${move}: ${ofMove.map((load) => `${shortDate(load.date)} ${load.weight} lb`).join(', ')}`}
      build={({ token }) => ({
        type: 'line',
        data: { labels: ofMove.map((load) => shortDate(load.date)), datasets: [
          { label: 'Peso anotado', data: ofMove.map((load) => load.weight), borderColor: token('--b-blue'), backgroundColor: token('--b-blue'), tension: 0.3, borderWidth: 3, pointRadius: 5, pointHoverRadius: 7 },
          { label: '1RM', data: ofMove.map((load) => bestSeries(data.records, focused.id, move).filter((point) => point.date <= load.date).at(-1)?.value ?? null), borderColor: token('--b-pink'), backgroundColor: token('--b-pink'), borderDash: [6, 6], stepped: true, borderWidth: 2, pointRadius: 0 },
        ] },
        options: { scales: { y: { ticks: { callback: (value) => `${value} lb` } }, x: { grid: { display: false } } },
          plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y} lb${context.datasetIndex === 0 && ofMove[context.dataIndex].reps ? ` × ${ofMove[context.dataIndex].reps}` : ''}` } } } },
      })} />
      : <Chart deps={[data, move, athletes, from]} height={Math.max(220, 120 + athletes.length * 26)} summary={`${move}: ${athletes.map((athlete) => `${athlete.name} ${Math.max(0, ...ofMove.filter((load) => load.athleteId === athlete.id).map((load) => load.weight))} lb`).join(', ')}`}
        build={({ token }) => ({
          type: 'bar',
          data: { labels: athletes.map((athlete) => athlete.name), datasets: [
            { label: 'Mejor peso anotado', data: athletes.map((athlete) => Math.max(0, ...ofMove.filter((load) => load.athleteId === athlete.id).map((load) => load.weight)) || null), backgroundColor: token('--b-blue'), borderRadius: 8, borderSkipped: false, maxBarThickness: 38 },
            { label: '1RM', data: athletes.map((athlete) => oneRm(athlete.id)), backgroundColor: token('--b-pink'), borderRadius: 8, borderSkipped: false, maxBarThickness: 38 },
          ] },
          options: { scales: { y: { beginAtZero: true, ticks: { callback: (value) => `${value} lb` } }, x: { grid: { display: false } } },
            plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y} lb` } } } },
        })} />}
  </Card>;
}

function GrowthChart({ data, athletes, from, today, deps }) {
  const rows = athletes.map((athlete) => ({ athlete, value: averageGrowth(data.records, athlete.id, from, today) })).filter((row) => row.value != null)
    .sort((a, b) => b.value - a.value);
  if (!rows.length) return <Empty>Tus atletas todavía no tienen récords de 1RM.</Empty>;
  return <Chart deps={deps} height={Math.max(200, 70 + rows.length * 44)} summary={`Crecimiento de 1RM: ${rows.map((row) => `${row.athlete.name} ${signed(row.value)}`).join(', ')}`}
    build={({ token }) => ({
      type: 'bar',
      data: { labels: rows.map((row) => row.athlete.name), datasets: [{
        data: rows.map((row) => Math.round(row.value * 1000) / 10),
        backgroundColor: rows.map((row, at) => token(row.value < 0 ? '--b-coral' : SERIES_COLORS[at % (SERIES_COLORS.length - 1)])), borderRadius: 8, borderSkipped: false, maxBarThickness: 30,
      }] },
      options: { indexAxis: 'y', scales: { x: { ticks: { callback: (value) => `${value}%` } }, y: { grid: { display: false }, ticks: { font: { weight: 800, size: 13 } } } },
        plugins: { tooltip: { callbacks: { label: (context) => signed(rows[context.dataIndex].value) } } } },
    })} />;
}

function GrowthTable({ growth }) {
  if (!growth.length) return <Empty>Todavía no tiene récords de 1RM.</Empty>;
  return <ul className="growth">
    {growth.map((entry, at) => <li key={entry.move} style={{ '--i': at }}>
      <span><b>{entry.move}</b><small className="num">{entry.start} → {entry.end} lb</small></span>
      <b className="growth-change num" data-up={entry.change > 0}>{entry.change > 0 ? `+${entry.change} lb · ${signed(entry.pct)}` : 'Sin cambio'}</b>
    </li>)}
  </ul>;
}

// One athlete's 1RM history, a line per lift, for the lifts with most history.
function AthleteRecords({ index, data, athlete }) {
  const series = useMemo(() => {
    const moves = [...new Set(data.records.filter((record) => record.athleteId === athlete.id && record.rm === 1).map((record) => record.move))];
    return moves.map((move) => ({ move, points: bestSeries(data.records, athlete.id, move) })).sort((a, b) => b.points.length - a.points.length).slice(0, 6);
  }, [data, athlete]);
  const dates = [...new Set(series.flatMap((entry) => entry.points.map((point) => point.date)))].sort();
  return <Card index={index} title="Progreso de sus 1RM" hint="Cada punto es un récord nuevo. Se muestran sus levantamientos con más historial.">
    {dates.length ? <Chart deps={[data, athlete.id]} height={300} summary={series.map((entry) => `${entry.move}: ${entry.points.map((point) => `${point.value} lb`).join(', ')}`).join('. ')}
      build={({ token }) => ({
        type: 'line',
        data: { labels: dates.map(shortDate), datasets: series.map((entry, at) => ({
          label: entry.move, data: dates.map((date) => entry.points.find((point) => point.date === date)?.value ?? null), spanGaps: true,
          borderColor: token(SERIES_COLORS[at % SERIES_COLORS.length]), backgroundColor: token(SERIES_COLORS[at % SERIES_COLORS.length]), tension: 0.25, borderWidth: 3, pointRadius: 5, pointHoverRadius: 7,
        })) },
        options: { scales: { y: { ticks: { callback: (value) => `${value} lb` } }, x: { grid: { display: false } } },
          plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y} lb` } } } },
      })} /> : <Empty>Todavía no tiene récords de 1RM.</Empty>}
  </Card>;
}
