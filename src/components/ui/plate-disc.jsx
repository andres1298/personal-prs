import { PLATE_STYLE } from '../../lib/plates';

// A bumper plate seen from the front: outlined rim and inner lip in the plate's color,
// sized by weight. Inactive plates fade to a neutral outline.
export default function PlateDisc({ plate, active = true }) {
  const [color, height] = PLATE_STYLE[plate] || ['--label3', 50];
  const size = Math.round(34 + (height / 100) * 20);
  return <span className="plate-disc" data-active={active} style={{ '--pc': `var(${color})`, '--size': `${size}px` }}>
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle className="plate-disc-rim" cx="20" cy="20" r="18" />
      <circle className="plate-disc-lip" cx="20" cy="20" r="13" />
    </svg>
    <span className="plate-disc-label num">{plate}</span>
  </span>;
}
