'use client';

import Icon from './ui/icon';

const TABS = [
  { value: 'exec', label: 'Execute', icon: 'bolt' },
  { value: 'prs', label: 'PRs', icon: 'trophy' },
  { value: 'timer', label: 'Timer', icon: 'timer' },
];

// Floating tab bar: the active tab shows its name; the + action is a separate coral block.
export default function TabBar({ tab, onTab, onAdd, hidden }) {
  return <nav className="tab-bar" aria-label="Navegación principal" data-hidden={hidden}>
    <div className="tab-group" data-tour="tabs">
      {TABS.map((t) => <button type="button" key={t.value} className="tab" aria-current={t.value === tab ? 'page' : undefined}
        aria-label={t.label} onClick={() => onTab(t.value)}>
        <Icon name={t.icon} fill={t.value === tab} />
        <span>{t.label}</span>
      </button>)}
    </div>
    <button type="button" className="tab-action" data-tour="add" onClick={onAdd} aria-label="Registrar">
      <Icon name="plus" weight={2.8} />
    </button>
  </nav>;
}
