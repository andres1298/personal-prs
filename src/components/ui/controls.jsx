'use client';

// iOS segmented control: a sliding thumb under equal-width segments.
export function SegmentedControl({ options, value, onChange, label, className = '' }) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  return <div
    className={`segmented ${className}`} role="radiogroup" aria-label={label}
    style={{ '--count': options.length, '--index': index }}
  >
    <span className="segmented-thumb" aria-hidden="true" />
    {options.map((option) => <button
      key={option.value} type="button" role="radio" aria-checked={option.value === value}
      disabled={option.disabled} onClick={() => option.value !== value && onChange(option.value)}
    >{option.label}</button>)}
  </div>;
}

export function Switch({ checked, onChange, label, disabled }) {
  return <button
    type="button" role="switch" className="switch" aria-checked={checked} aria-label={label}
    disabled={disabled} onClick={() => onChange(!checked)}
  />;
}

// Rounded-square symbol tile used by Settings-style rows and cards.
export function SymbolTile({ color = '--gray', children, size = 'md' }) {
  return <span className={`tile tile-${size}`} style={{ '--c': `var(${color})` }}>{children}</span>;
}
