'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatValue, today as todayDate } from '../../lib/catalog';
import { attendance, indexStats, loggedLoads, loggedMovements, sessionStats, summarize } from '../../lib/coach-stats';
import { addDays, weekStart } from '../../lib/training';
import Icon from '../ui/icon';
import Chart from './chart';
import { Choice } from './line-editor';

const PERIODS = [{ value: 4, label: '4 semanas' }, { value: 12, label: '12 semanas' }, { value: 26, label: '6 meses' }];
const STATE_LABELS = { done: 'Completó', partial: 'Empezó y no completó', missed: 'No la hizo', pending: 'Pendiente', none: 'Sin sesión' };
const percent = (value) => (value == null ? '–' : `${Math.round(value * 100)} %`);
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

function Card({ title, hint, children, wide, index = 0, action, tone }) {
  return <section className={`stat-card${wide ? ' wide' : ''}`} data-tone={tone} style={{ '--i': index }}>
    <header><div><h2>{title}</h2>{hint && <p>{hint}</p>}</div>{action}</header>
    {children}
  </section>;
}

const Empty = ({ children }) => <p className="stat-empty">{children}</p>;

/**
 * The coach's analysis page, apart from the calendar: how much of the programming gets done,
 * who did each day, each session in numbers and the loads athletes logged. The chips narrow
 * every panel to a group or to one athlete.
 */
export default function ProgressView({ api, onPeople }) {
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
  const loads = useMemo(() => (index ? loggedLoads(index, athletes, period) : []), [index, athletes, period]);

  const title = <header className="coach-head">
    <h1 className="display">Progreso</h1>
    <div className="coach-head-tools"><Choice label="Periodo" size="small" options={PERIODS} value={weeks} onChange={setWeeks} /></div>
  </header>;
  if (error) return <>{title}<div className="banner warn" role="alert"><span>{error}</span><button type="button" className="pill-btn" onClick={load}>Reintentar</button></div></>;
  if (!data || !summary) return <>{title}<div className="stat-skeleton" aria-label="Cargando">{Array.from({ length: 6 }, (_, at) => <i key={at} style={{ '--i': at }} />)}</div></>;
  if (!data.athletes.length) return <ProgressPreview onPeople={onPeople} />;

  const attention = summary.byAthlete.filter((row) => row.assigned > 0 && (row.missed >= 2 || row.rate < 0.5));
  const logged = loads.length;
  const scopes = [
    { value: 'all', label: 'Todos' },
    ...data.groups.map((group) => ({ value: `group:${group.id}`, label: group.name, color: group.color })),
    ...data.athletes.map((athlete) => ({ value: `athlete:${athlete.id}`, label: athlete.name })),
  ];

  return <div className="progress">
    {title}
    <nav className="scope-chips" aria-label="Filtrar por grupo o atleta">
      {scopes.map((option) => <button type="button" key={option.value} aria-pressed={option.value === scope} style={option.color ? { '--c': `var(${option.color})` } : undefined}
        data-group={Boolean(option.color)} onClick={() => setScope(option.value)}>{option.label}</button>)}
    </nav>

    {/* Remounting on a new filter replays the entrance, so the change is felt. */}
    <div className="progress-body" key={`${scope}:${weeks}`}>
      <div className="kpis">
        <Kpi index={0} color={rateColor(summary.rate)} icon="check" label="Cumplimiento" value={summary.rate == null ? null : summary.rate * 100} format={(value) => `${Math.round(value)}%`}
          detail={`${summary.completed} de ${summary.assigned} sesiones completadas`} />
        <Kpi index={1} color="--b-blue" icon={focused ? 'flame' : 'people'} label={focused ? 'Racha actual' : 'Activos esta semana'}
          value={focused ? summary.byAthlete[0]?.streak ?? 0 : summary.activeThisWeek}
          detail={focused ? 'sesiones seguidas completadas' : `de ${athletes.length} ${athletes.length === 1 ? 'atleta' : 'atletas'} completaron algo`} />
        <Kpi index={2} color="--b-lilac" icon="calendar" label="Sesiones sin hacer" value={summary.assigned - summary.completed} detail={`del ${shortDate(from)} a hoy`} />
        <Kpi index={3} color="--b-cyan" icon="barbell" label="Pesos anotados" value={logged} detail="registros en líneas con «El atleta anota»" />
      </div>

      {!focused && attention.length > 0 && <section className="attention" aria-label="Necesitan atención">
        <b><Icon name="flag" />Necesitan atención</b>
        {attention.map((row) => <button type="button" key={row.athlete.id} onClick={() => setScope(`athlete:${row.athlete.id}`)}>
          {row.athlete.name}<small>{row.missed >= 2 ? `${row.missed} seguidas sin hacer` : percent(row.rate)}</small>
        </button>)}
      </section>}

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

        {focused ? <Loads index={1} athletes={athletes} loads={loads} focused={focused} deps={[data, scope, weeks]} />
          : <Card index={1} title="Cumplimiento por atleta" hint="Toca un nombre para ver solo a esa persona.">
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

        <Card index={2} wide title="Quién completó cada día" hint="Las últimas tres semanas, día por día.">
          <Attendance index={index} athletes={athletes} today={today} onPick={focused ? null : (athleteId) => setScope(`athlete:${athleteId}`)} />
        </Card>

        <SessionPanel index={3} stats={index} athletes={athletes} today={today} from={from} deps={[data, scope, weeks]} />

        {!focused && <Loads index={4} wide athletes={athletes} loads={loads} deps={[data, scope, weeks]} />}
      </div>
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

const metricValue = (metric, value) => (metric.kind === 'weight' ? `${Math.round(value)} lb` : formatValue(metric.kind === 'time' ? Math.round(value) : Math.round(value * 10) / 10, metric.kind));
const KIND_COLORS = { weight: '--b-blue', time: '--b-yellow', reps: '--b-green' };

/**
 * One past session in numbers: how many finished it, then for the line or score picked, the
 * average, the best and every athlete's value as bars, and below what each person logged.
 */
function SessionPanel({ index, stats: lookup, athletes, today, from, deps }) {
  const sessions = useMemo(() => lookup.sessions.filter((session) => session.date <= today && session.date >= from
    && athletes.some((athlete) => lookup.sessionsOf(athlete).some((due) => due.id === session.id))).reverse(), [lookup, athletes, today, from]);
  const [sessionId, setSessionId] = useState(null);
  const [metricKey, setMetricKey] = useState(null);
  const at = Math.max(0, sessions.findIndex((candidate) => candidate.id === sessionId));
  const session = sessions[at];
  const stats = useMemo(() => (session ? sessionStats(lookup, session, athletes) : null), [lookup, session, athletes]);
  const title = 'Estadísticas por sesión';
  const hint = 'Cumplimiento, tiempos y pesos de una sesión, persona por persona.';
  if (!session) return <Card index={index} wide title={title} hint={hint}><Empty>Todavía no hay sesiones pasadas en este periodo.</Empty></Card>;
  const metric = stats.metrics.find((candidate) => candidate.key === metricKey) ?? stats.metrics[0];

  return <Card index={index} wide title={title} hint={hint}>
    <div className="board-head">
      <button type="button" className="icon-button" aria-label="Sesión anterior" disabled={at >= sessions.length - 1} onClick={() => setSessionId(sessions[at + 1].id)}><Icon name="chevronLeft" weight={2.6} /></button>
      <select aria-label="Sesión" value={session.id} onChange={(event) => setSessionId(event.target.value)}>
        {sessions.map((candidate) => <option key={candidate.id} value={candidate.id}>{shortDate(candidate.date)} · {candidate.title || 'Sesión'}</option>)}
      </select>
      <button type="button" className="icon-button" aria-label="Sesión siguiente" disabled={at === 0} onClick={() => setSessionId(sessions[at - 1].id)}><Icon name="chevronRight" weight={2.6} /></button>
    </div>

    <div className="session-facts" key={session.id}>
      <p style={{ '--c': `var(${rateColor(stats.rate)})` }}><small>Cumplimiento</small><b className="display num">{percent(stats.rate)}</b><span>{stats.completed} de {stats.total} la completaron</span></p>
      {metric && <>
        <p style={{ '--c': `var(${KIND_COLORS[metric.kind]})` }}><small>{metric.kind === 'time' ? 'Mejor tiempo' : metric.kind === 'weight' ? 'Peso más alto' : 'Más repeticiones'}</small>
          <b className="display num">{metricValue(metric, metric.best.value)}</b><span>{metric.best.athlete.name}</span></p>
        <p style={{ '--c': 'var(--surface2)' }}><small>Promedio</small><b className="display num">{metricValue(metric, metric.average)}</b>
          <span>{metric.entries.length} {metric.entries.length === 1 ? 'registro' : 'registros'} en {metric.name}</span></p>
      </>}
    </div>

    {metric ? <>
      {stats.metrics.length > 1 && <Choice label="Qué comparar" size="small" value={metric.key} onChange={setMetricKey}
        options={stats.metrics.map((candidate) => ({ value: candidate.key, label: `${candidate.name} · ${candidate.kind === 'time' ? 'tiempo' : candidate.kind === 'weight' ? 'peso' : 'reps'}` }))} />}
      <Chart deps={[...deps, session.id, metric.key]} height={Math.max(150, 56 + metric.entries.length * 40)}
        summary={`${metric.name}: ${metric.entries.map((entry) => `${entry.athlete.name} ${metricValue(metric, entry.value)}`).join(', ')}`}
        build={({ token }) => ({
          type: 'bar',
          data: { labels: metric.entries.map((entry) => entry.athlete.name), datasets: [{
            data: metric.entries.map((entry) => entry.value), backgroundColor: token(KIND_COLORS[metric.kind]), borderRadius: 8, borderSkipped: false, maxBarThickness: 28,
          }] },
          options: { indexAxis: 'y',
            scales: { x: { beginAtZero: true, ticks: { callback: (value) => metricValue(metric, value) } }, y: { grid: { display: false }, ticks: { font: { weight: 800, size: 13 } } } },
            plugins: { tooltip: { callbacks: { label: (context) => { const entry = metric.entries[context.dataIndex]; return `${metricValue(metric, entry.value)}${entry.reps ? ` × ${entry.reps} reps` : ''}`; } } } } },
        })} />
    </> : <Empty>Nadie anotó tiempos ni pesos en esta sesión.</Empty>}

    <div className="board">
      {stats.rows.map((row, rowAt) => <article key={row.athlete.id} className="board-row" data-state={row.completedAt ? 'done' : row.started ? 'partial' : 'missed'} style={{ '--i': rowAt }}>
        <header><b>{row.athlete.name}</b><span>{row.completedAt ? 'Completó' : row.started ? 'Empezó' : 'No la hizo'}</span></header>
        {row.lines.map((line, lineAt) => <p key={lineAt}><span>{line.name}</span>
          <b className="num">{[line.weight != null && `${line.weight} lb`, line.reps != null && `${line.reps} reps`].filter(Boolean).join(' × ')}</b></p>)}
        {row.scores.map((score, scoreAt) => <p key={`s${scoreAt}`}><span>{score.name}</span><b className="num">{formatValue(score.value, score.type)}</b></p>)}
      </article>)}
    </div>
  </Card>;
}

// Loads logged on one movement over the period: each athlete's heaviest for a group, every logged weight over time for one athlete.
function Loads({ index, wide, athletes, loads, focused, deps }) {
  const moves = useMemo(() => loggedMovements(loads), [loads]);
  const [picked, setPicked] = useState(null);
  const move = moves.some((entry) => entry.move === picked) ? picked : moves[0]?.move;
  const title = focused ? 'Pesos que anotó' : 'Pesos usados por movimiento';
  const hint = focused ? 'Cada peso que registró en las sesiones del periodo.' : 'El peso más alto que anotó cada atleta en el periodo.';
  if (!move) return <Card index={index} wide={wide} title={title} hint={hint}><Empty>Nadie ha anotado pesos en este periodo. Activa «El atleta anota» en las líneas que quieras seguir.</Empty></Card>;
  const ofMove = loads.filter((load) => load.move === move);
  const heaviest = athletes.map((athlete) => ({ athlete, value: Math.max(0, ...ofMove.filter((load) => load.athleteId === athlete.id).map((load) => load.weight)) }))
    .filter((row) => row.value > 0).sort((a, b) => b.value - a.value);

  return <Card index={index} wide={wide} title={title} hint={hint}>
    <Choice label="Movimiento" size="small" options={moves.slice(0, 8).map((entry) => ({ value: entry.move, label: entry.move }))} value={move} onChange={setPicked} />
    {focused ? <Chart deps={[...deps, move]} height={240} summary={`Pesos anotados en ${move}: ${ofMove.map((load) => `${shortDate(load.date)} ${load.weight} lb`).join(', ')}`}
      build={({ token }) => ({
        type: 'line',
        data: { labels: ofMove.map((load) => shortDate(load.date)), datasets: [
          { label: 'Peso anotado', data: ofMove.map((load) => load.weight), borderColor: token('--b-blue'), backgroundColor: token('--b-blue'), tension: 0.3, borderWidth: 3, pointRadius: 5, pointHoverRadius: 7 },
        ] },
        options: { scales: { y: { ticks: { callback: (value) => `${value} lb` } }, x: { grid: { display: false } } },
          plugins: { tooltip: { callbacks: { label: (context) => `${context.parsed.y} lb${ofMove[context.dataIndex].reps ? ` × ${ofMove[context.dataIndex].reps}` : ''}` } } } },
      })} />
      : <Chart deps={[...deps, move]} height={240} summary={`${move}: ${heaviest.map((row) => `${row.athlete.name} ${row.value} lb`).join(', ')}`}
        build={({ token }) => ({
          type: 'bar',
          data: { labels: heaviest.map((row) => row.athlete.name), datasets: [{ data: heaviest.map((row) => row.value), backgroundColor: token('--b-blue'), borderRadius: 8, borderSkipped: false, maxBarThickness: 46 }] },
          options: { scales: { y: { beginAtZero: true, ticks: { callback: (value) => `${value} lb` } }, x: { grid: { display: false } } },
            plugins: { tooltip: { callbacks: { label: (context) => `${context.parsed.y} lb` } } } },
        })} />}
  </Card>;
}

const PREVIEW_KPIS = [
  { label: 'Cumplimiento', icon: 'check', color: '--b-green', detail: 'Sesiones hechas de las asignadas' },
  { label: 'Sesiones', icon: 'calendar', color: '--b-blue', detail: 'Completadas en el periodo' },
  { label: 'Pesos anotados', icon: 'barbell', color: '--b-yellow', detail: 'Cargas que registraron' },
  { label: 'Nuevos PRs', icon: 'trophy', color: '--b-pink', detail: 'Récords que superaron' },
];
const PREVIEW_CARDS = [
  { title: 'Cumplimiento por atleta', hint: 'Quién entrena y quién se está quedando atrás.', bars: [86, 72, 64, 41] },
  { title: 'Pesos usados', hint: 'La carga de cada atleta en tus porcentajes.', bars: [58, 77, 69, 90] },
];

/** Before the first athlete: the dashboard as it will look, faded, and the way to invite them. */
function ProgressPreview({ onPeople }) {
  return <section className="progress-preview">
    <header className="coach-head"><h1 className="display">Progreso</h1></header>
    <div className="progress-preview-call">
      <div>
        <b>Todavía no tienes atletas</b>
        <p>Cuando se unan y registren sus sesiones, aquí verás su cumplimiento, los pesos que usan y sus nuevos PRs.</p>
      </div>
      <button type="button" className="pill-btn" onClick={onPeople}><Icon name="people" />Invitar atletas</button>
    </div>
    <div className="progress-preview-ghost" aria-hidden="true">
      <div className="kpis">
        {PREVIEW_KPIS.map((kpi) => <article className="kpi ghost" key={kpi.label} style={{ '--c': `var(${kpi.color})` }}>
          <span className="kpi-icon"><Icon name={kpi.icon} weight={2.4} /></span>
          <p className="kpi-label">{kpi.label}</p>
          <p className="kpi-value display num">–</p>
          <p className="kpi-detail">{kpi.detail}</p>
        </article>)}
      </div>
      <div className="stat-grid">
        {PREVIEW_CARDS.map((card) => <section className="stat-card" key={card.title}>
          <header><div><h2>{card.title}</h2><p>{card.hint}</p></div></header>
          <div className="ghost-bars">{card.bars.map((width, index) => <i key={index} style={{ '--w': `${width}%` }} />)}</div>
        </section>)}
      </div>
    </div>
  </section>;
}
