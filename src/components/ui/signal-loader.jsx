import { PLATE_STYLE } from '../../lib/plates';

// Plates seen edge-on, smallest to largest like a phone's signal bars.
// Each one lights up in turn while the app connects.
const SIGNAL_PLATES = [2.5, 5, 10, 25, 45];
const VIEW_HEIGHT = 40;
const GAP = 3;

const bars = SIGNAL_PLATES.reduce((list, plate) => {
  const [color, height] = PLATE_STYLE[plate];
  const previous = list.at(-1);
  const x = previous ? previous.x + previous.width + GAP : 0;
  // Heavier plates are thicker.
  const width = 5 + Math.round(height / 25);
  const h = Math.round((height / 100) * VIEW_HEIGHT);
  return [...list, { plate, color, x, width, h }];
}, []);
const viewWidth = bars.at(-1).x + bars.at(-1).width;

export default function SignalLoader({ label = 'Cargando tus PRs…' }) {
  return <div className="signal-loader" role="status" aria-live="polite">
    <svg viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`} aria-hidden="true" focusable="false">
      {bars.map(({ plate, color, x, width, h }, i) => <g key={plate} className="signal-plate" style={{ '--pc': `var(${color})`, '--i': i }}>
        <rect x={x} y={VIEW_HEIGHT - h} width={width} height={h} rx={width / 2.4} />
        <rect className="signal-plate-hub" x={x + 1} y={VIEW_HEIGHT - h / 2 - 2.5} width={width - 2} height={5} rx={1} />
      </g>)}
    </svg>
    <span className="signal-loader-label">{label}</span>
  </div>;
}
