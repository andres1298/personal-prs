'use client';

import Icon from './ui/icon';

const PLAN_TAB = { value: 'plan', label: 'Plan', icon: 'calendar' };
const TABS = [
  { value: 'exec', label: 'Execute', icon: 'bolt' },
  { value: 'prs', label: 'PRs', icon: 'trophy' },
  { value: 'timer', label: 'Timer', icon: 'timer' },
];

// Floating tab bar: the active tab shows its name; the + action is a separate coral block.
// The plan tab exists only for members who follow a coach; `planBadge` marks something new in it.
export default function TabBar({ tab, onTab, onAdd, hidden, plan = false, planBadge = false }) {
  const tabs = plan ? [PLAN_TAB, ...TABS] : TABS;
  return <nav className="tab-bar" aria-label="Navegación principal" data-hidden={hidden}>
    <div className="tab-group" data-tour="tabs">
      {tabs.map((t) => <button type="button" key={t.value} className="tab" aria-current={t.value === tab ? 'page' : undefined}
        aria-label={t.label} onClick={() => onTab(t.value)}>
        <Icon name={t.icon} fill={t.value === tab} />
        <span>{t.label}</span>
        {t.value === 'plan' && planBadge && <i className="tab-badge" aria-label="Hay novedades" />}
      </button>)}
    </div>
    <button type="button" className="tab-action" data-tour="add" onClick={onAdd} aria-label="Registrar">
      <Icon name="plus" weight={2.8} />
    </button>
  </nav>;
}
