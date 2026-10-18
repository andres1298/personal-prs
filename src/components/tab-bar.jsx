'use client';

import Icon from './ui/icon';

const TABS = [
  { value: 'exec', label: 'Execute', icon: 'bolt' },
  { value: 'prs', label: 'PRs', icon: 'trophy' },
  { value: 'timer', label: 'Timer', icon: 'timer' },
];

// Floating glass tab bar with a separate action button, as in iOS 26.
export default function TabBar({ tab, onTab, onAdd, hidden }) {
  const index = Math.max(0, TABS.findIndex((t) => t.value === tab));
  return <nav className="tab-bar" aria-label="Navegación principal" data-hidden={hidden}>
    <div className="tab-group glass" data-tour="tabs" style={{ '--index': index, '--count': TABS.length }}>
      <span className="tab-lens" aria-hidden="true" />
      {TABS.map((t) => <button type="button" key={t.value} className="tab" aria-current={t.value === tab ? 'page' : undefined}
        onClick={() => onTab(t.value)}>
        <Icon name={t.icon} fill={t.value === tab} />
        <span>{t.label}</span>
      </button>)}
    </div>
    <button type="button" className="tab-action glass" data-tour="add" onClick={onAdd} aria-label="Registrar">
      <Icon name="plus" weight={2.6} />
    </button>
  </nav>;
}
