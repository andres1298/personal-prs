'use client';

import { useState } from 'react';
import { CATALOG_TABS, bestRecord, firstRm, formatValue, getCatalog } from '../../lib/catalog';
import Icon from '../ui/icon';
import { List, Row } from '../ui/list';
import { LargeTitle } from '../ui/nav-bar';
import { SegmentedControl } from '../ui/controls';

export default function PrsView({ records, banner, busy, onQuick, onOpen }) {
  const [tab, setTab] = useState('Lift');
  const [group, setGroup] = useState(null);
  const { type, groups } = getCatalog()[tab];
  const visible = group ? groups.filter((g) => g.name === group) : groups;

  const label = (move) => {
    if (type === 'weight') {
      const rm = firstRm(records, move);
      return rm ? <>{bestRecord(records, move, rm).value} lb{rm > 1 && <small>{rm}RM</small>}</> : null;
    }
    const best = bestRecord(records, move);
    return best ? formatValue(best.value, type) : null;
  };

  return <>
    <LargeTitle title="PRs" trailing={<button type="button" className="nav-text" data-tour="quick-upload" onClick={onQuick} disabled={busy}>
      <Icon name="bolt" fill /> Carga rápida
    </button>} />
    {banner}
    <SegmentedControl label="Categoría" value={tab} onChange={(next) => { setTab(next); setGroup(null); }}
      options={CATALOG_TABS.map((key) => ({ value: key, label: key }))} />
    <div className="chips" role="group" aria-label="Grupos" data-tour="prs-groups">
      {groups.map((g) => {
        const count = g.moves.filter((move) => records.some((r) => r.move === move)).length;
        return <button type="button" key={g.name} className="chip" aria-pressed={g.name === group} style={{ '--c': `var(${g.color})` }}
          onClick={() => setGroup(group === g.name ? null : g.name)}>
          <span>{g.name}</span><small className="num">{count}/{g.moves.length}</small>
        </button>;
      })}
    </div>
    {visible.map((g) => <List key={g.name} header={<><i className="dot" style={{ '--c': `var(${g.color})` }} />{g.name}</>}>
      {g.moves.map((move) => <Row key={move} title={move} chevron onClick={() => onOpen(move)}
        detail={label(move) || <span className="muted">—</span>} />)}
    </List>)}
  </>;
}
