'use client';

import { useEffect, useRef } from 'react';
import { RMS, bestRecord, firstRm, formatDate, formatValue, moveInfo, recordsOf, toKg } from '../../lib/catalog';
import Icon from '../ui/icon';
import Sheet from '../ui/sheet';
import { List, Row } from '../ui/list';
import { SegmentedControl } from '../ui/controls';
import RecordValue from '../ui/record-value';

const alpha = (hex, a) => {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

function ProgressChart({ records, color, type }) {
  const canvas = useRef(null);
  useEffect(() => {
    let chart;
    let active = true;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (!active || !canvas.current) return;
      const css = getComputedStyle(document.documentElement);
      const tone = css.getPropertyValue(color).trim();
      const label = css.getPropertyValue('--ink2').trim();
      const grid = css.getPropertyValue('--line').trim();
      const font = { family: css.getPropertyValue('--font-archivo').trim() || undefined, weight: 600 };
      const context = canvas.current.getContext('2d');
      const fill = context.createLinearGradient(0, 0, 0, 200);
      fill.addColorStop(0, alpha(tone, 0.35));
      fill.addColorStop(1, alpha(tone, 0));
      const isWeight = type === 'weight';
      chart = new Chart(canvas.current, {
        type: 'line',
        data: {
          labels: records.map((r) => formatDate(r.date)),
          datasets: [{
            data: records.map((r) => r.value), borderColor: tone, backgroundColor: fill, fill: true, tension: 0.35,
            borderWidth: 3, pointRadius: 4, pointBackgroundColor: tone, pointBorderColor: css.getPropertyValue('--surface').trim(), pointBorderWidth: 2,
          }],
        },
        options: {
          animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: false },
            tooltip: { displayColors: false, callbacks: { label: (c) => (isWeight ? `${c.raw} lb · ${toKg(c.raw)} kg` : formatValue(c.raw, type)) } },
          },
          scales: {
            x: { ticks: { color: label, font, maxRotation: 0, autoSkipPadding: 16 }, grid: { display: false }, border: { display: false } },
            y: { reverse: type === 'time', ticks: { color: label, font, precision: type === 'reps' ? 0 : undefined, callback: (v) => formatValue(v, type) }, grid: { color: grid }, border: { display: false } },
          },
        },
      });
    });
    return () => { active = false; chart?.destroy(); };
  }, [records, color, type]);
  return <div className="card chart-card"><canvas ref={canvas} height="200" aria-label="Progreso" role="img" /></div>;
}

export default function MoveDetailSheet({ detail: current, records, onClose, onChangeRm, onAdd, onExecute }) {
  // Keep showing the last movement while the sheet slides away.
  const last = useRef(current);
  if (current) last.current = current;
  const detail = last.current;
  const move = detail?.move;
  const { type, group } = moveInfo(move);
  const isWeight = type === 'weight';
  const rm = detail?.rm || (isWeight ? firstRm(records, move) || 1 : 1);
  const history = move ? recordsOf(records, move, rm).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const best = move ? bestRecord(records, move, rm) : null;

  return <Sheet open={!!current} onClose={onClose} title={move}
    trailing={<>
      <button type="button" className="nav-icon" onClick={() => onAdd(move, rm)} aria-label="Registrar"><Icon name="plus" weight={2.6} /></button>
      <button type="button" className="nav-text strong" onClick={onClose}>Cerrar</button>
    </>}>
    {move && <div style={{ '--c': `var(${group.color})` }}>
      <p className="eyebrow"><i className="dot" />{group.name}</p>
      {isWeight && <SegmentedControl label="Repeticiones máximas" value={rm} onChange={(next) => onChangeRm(next)}
        options={RMS.map((n) => ({ value: n, label: `${n}RM` }))} />}
      <div className="pr-hero">
        <div className="pr-value display num" key={`${move}-${rm}`}>
          {best ? <RecordValue value={best.value} type={type} /> : '—'}
        </div>
        {best && isWeight && <div className="pr-kg num">{toKg(best.value)} kg</div>}
        <p className="pr-date">{best ? `PR del ${formatDate(best.date)}` : 'Aún no hay registros'}</p>
      </div>
      {history.length > 1 && <ProgressChart records={history} color={group.color} type={type} />}
      {isWeight && firstRm(records, move) && <button type="button" className="filled-button block" onClick={() => onExecute(move)}>
        <Icon name="bolt" fill /> Execute
      </button>}
      <List header="Historial">
        {history.length
          ? history.slice().reverse().map((r, i) => <Row key={`${r.date}-${r.value}-${i}`} title={formatDate(r.date)}
            subtitle={[isWeight && `${toKg(r.value)} kg`, r.notes].filter(Boolean).join(' · ') || undefined}
            value detail={<RecordValue value={r.value} type={type} />} />)
          : <p className="empty compact">Sin registros</p>}
      </List>
    </div>}
  </Sheet>;
}
