import { PLATE_STYLE } from '../../lib/plates';

const plateVars = (plate) => {
  const [color, height] = PLATE_STYLE[plate] || ['--ink3', 50];
  return { '--h': height, '--pc': `var(${color})` };
};

// One side of the barbell, drawn like the app's load card. Changing `loadKey` replays the plate animation.
export default function Barbell({ bar, plates, loadKey, label }) {
  return <div className={`barbell${plates.length > 5 ? ' small' : ''}`} role="img" aria-label={label}>
    <span className="collar num">{bar}</span>
    {plates.length
      ? plates.map((plate, index) => <span key={`${loadKey}-${index}-${plate}`} className="plate num"
        style={{ ...plateVars(plate), animationDelay: `${index * 60}ms` }}>{plate}</span>)
      : <span className="barbell-empty">Solo la barra</span>}
  </div>;
}

export function MiniPlates({ plates }) {
  return <span className="mini-plates" aria-hidden="true">{plates.map((plate, i) => {
    const [color, height] = PLATE_STYLE[plate] || ['--ink3', 50];
    return <i key={i} style={{ height: Math.round(height * 0.26), '--pc': `var(${color})` }} />;
  })}</span>;
}
