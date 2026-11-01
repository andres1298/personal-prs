'use client';

import { useEffect, useRef, useState } from 'react';
import { DEMO_RECORDS, formatValue } from '../../lib/catalog';
import { useInView, useReducedMotion, useTweenedNumber } from './use-in-view';

const SERIES = [
  { move: 'Back Squat', rm: 1, type: 'weight', label: 'Back Squat · 1RM', color: '--b-pink' },
  { move: 'Fran', type: 'time', label: 'Fran', color: '--b-lilac' },
  { move: 'Pull-ups', type: 'reps', label: 'Pull-ups unbroken', color: '--b-lime' },
];

const PAD = { top: 44, right: 40, bottom: 40, left: 40 };

// The chart is drawn at its rendered width, so labels keep their size on a phone and on a desktop.
function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const monthLabel = (date) => new Date(`${date}T12:00`).toLocaleDateString('es-CR', { month: 'short', year: '2-digit' });

function deltaText(delta, type) {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const size = Math.abs(Math.round(delta));
  if (type === 'time') return `${sign}${size} s`;
  return `${sign}${size} ${type === 'reps' ? 'reps' : 'lb'}`;
}

// The PR history chart from the app's sample data. Times are better when lower, so their axis is flipped.
export default function ProgressDemo() {
  const [series, setSeries] = useState(SERIES[0]);
  const [ref, inView] = useInView({ once: true, threshold: 0.35 });
  const reduced = useReducedMotion();
  const [chartRef, W] = useWidth(640);
  const H = W < 480 ? 220 : 260;
  const points = DEMO_RECORDS
    .filter((record) => record.move === series.move && (series.rm == null || record.rm === series.rm))
    .sort((a, b) => a.date.localeCompare(b.date));

  const times = points.map((point) => new Date(point.date).getTime());
  const values = points.map((point) => point.value);
  const [minT, maxT] = [Math.min(...times), Math.max(...times)];
  const [minV, maxV] = [Math.min(...values), Math.max(...values)];
  const spread = Math.max(1, maxV - minV);
  const lowerIsBetter = series.type === 'time';
  const x = (t) => PAD.left + ((t - minT) / Math.max(1, maxT - minT)) * (W - PAD.left - PAD.right);
  const y = (v) => {
    const ratio = (v - (minV - spread * 0.25)) / (spread * 1.5);
    return PAD.top + (lowerIsBetter ? ratio : 1 - ratio) * (H - PAD.top - PAD.bottom);
  };
  const coords = points.map((point, i) => [x(times[i]), y(point.value)]);
  const line = coords.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)} ${H - PAD.bottom} L${coords[0][0].toFixed(1)} ${H - PAD.bottom} Z`;

  const first = values[0];
  const best = lowerIsBetter ? minV : maxV;
  const delta = best - first;
  const shown = useTweenedNumber(inView ? delta : 0, { enabled: !reduced, duration: 900 });
  const drawn = inView || reduced;

  return <div className="lp-progress" style={{ '--c': `var(${series.color})` }} ref={ref}>
    <div className="lp-progress-head">
      <div className="lp-chips" role="group" aria-label="Movimiento">
        {SERIES.map((item) => <button key={item.move} type="button" aria-pressed={item === series}
          style={{ '--c': `var(${item.color})` }} onClick={() => setSeries(item)}>{item.label}</button>)}
      </div>
      <div className="lp-progress-stat">
        <b className="display num">{deltaText(shown, series.type)}</b>
        <span>{lowerIsBetter ? 'menos tiempo' : 'de mejora'} desde {monthLabel(points[0].date)}</span>
      </div>
    </div>
    <div ref={chartRef}><svg key={series.move} className="lp-chart" data-drawn={drawn} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${series.label}: ${points.map((point) => `${formatValue(point.value, series.type)} en ${monthLabel(point.date)}`).join(', ')}`}>
      <defs>
        <linearGradient id="lp-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--c)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--c)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => <line key={i} className="lp-chart-grid" x1={PAD.left} x2={W - PAD.right}
        y1={PAD.top + i * ((H - PAD.top - PAD.bottom) / 3)} y2={PAD.top + i * ((H - PAD.top - PAD.bottom) / 3)} />)}
      <path className="lp-chart-area" d={area} fill="url(#lp-chart-fill)" />
      <path className="lp-chart-line" d={line} pathLength="1" />
      {coords.map(([px, py], i) => <g key={points[i].date} className="lp-chart-point" style={{ '--i': i }}>
        <circle cx={px} cy={py} r="7" />
        <text x={px} y={py - 16} textAnchor="middle" className="num">{formatValue(points[i].value, series.type)}</text>
        <text x={px} y={H - 14} textAnchor="middle" className="lp-chart-x">{monthLabel(points[i].date)}</text>
      </g>)}
    </svg></div>
  </div>;
}
