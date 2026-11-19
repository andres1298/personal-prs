/**
 * A placeholder of the size of something still loading, with a light sweeping across it.
 * Hidden from assistive technology: the region around it says what is loading (see Loading).
 */
export default function Skeleton({ width, height, radius, className = '', style }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A region of skeletons, announced once as loading. */
export function Loading({ label, as: Tag = 'div', className = '', children, ...rest }) {
  return <Tag className={className} role="status" aria-busy="true" {...rest}>
    <span className="visually-hidden">{label}</span>
    {children}
  </Tag>;
}

// Title widths that vary like real names, so a placeholder list does not read as a grid.
const ROW_WIDTHS = ['52%', '38%', '61%', '44%', '56%', '34%'];

/**
 * Grouped rows still loading, the size of a List of movements with their values. With a `label` it
 * announces itself; without one it is part of a larger Loading region.
 */
export function SkeletonList({ label, rows, header = false }) {
  const content = <>
    {header && <Skeleton className="list-header" width={96} height={12} />}
    <div className="list">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="row skeleton-row">
        <span className="row-body">
          <span className="row-text"><Skeleton width={ROW_WIDTHS[index % ROW_WIDTHS.length]} height={16} /></span>
          <Skeleton width={54} height={20} />
        </span>
      </div>)}
    </div>
  </>;
  return label ? <Loading className="list-section" label={label}>{content}</Loading> : <section className="list-section" aria-hidden="true">{content}</section>;
}
