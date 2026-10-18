'use client';

import { useEffect, useState } from 'react';
import { RMS, isValidQuickWeight, latestRecord, parseValue, today, weightGroups } from '../../lib/catalog';
import { useAlert } from '../ui/alert';
import Sheet from '../ui/sheet';
import { List, Row } from '../ui/list';
import { SegmentedControl } from '../ui/controls';

// Only fills movement + RM pairs without records; edits survive switching RM.
export default function QuickUploadSheet({ open, records, onClose, onSave }) {
  const alert = useAlert();
  const [rm, setRm] = useState(1);
  const [values, setValues] = useState({});   // `${move}|${rm}` → typed text
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setRm(1); setValues({}); } }, [open]);

  const moves = weightGroups().flatMap((g) => g.moves);
  const entries = Object.entries(values)
    .map(([key, raw]) => { const [move, n] = key.split('|'); return { move, rm: +n, raw }; })
    .filter((e) => e.raw.trim() && !latestRecord(records, e.move, e.rm));
  const valid = entries.length > 0 && entries.every((e) => isValidQuickWeight(e.raw));
  const allDone = moves.every((m) => latestRecord(records, m, rm));

  async function save() {
    if (!valid) return;
    setSaving(true);
    const date = today();
    try {
      await onSave(entries.map((e) => ({ move: e.move, value: parseValue(e.raw, 'weight'), date, rm: e.rm })));
    } catch (err) {
      await alert({ title: 'No se pudo guardar', message: err.message });
    } finally { setSaving(false); }
  }

  return <Sheet open={open} onClose={onClose} title="Carga rápida"
    leading={<button type="button" className="nav-text" onClick={onClose}>Cancelar</button>}
    trailing={<button type="button" className="nav-text strong" disabled={!valid || saving} onClick={save}>
      {saving ? 'Guardando…' : entries.length ? `Guardar (${entries.length})` : 'Guardar'}
    </button>}>
    <p className="sheet-lead">Completa los pesos que te faltan. Se guardan con fecha de hoy.</p>
    <SegmentedControl label="Repeticiones máximas" value={rm} onChange={setRm}
      options={RMS.map((n) => ({ value: n, label: `${n}RM${moves.every((m) => latestRecord(records, m, n)) ? ' ✓' : ''}` }))} />
    {allDone && <p className="sheet-lead">Ya tienes todos los {rm}RM registrados.</p>}
    {weightGroups().map((group) => <List key={group.name} header={<><i className="dot" style={{ '--c': `var(${group.color})` }} />{group.name}</>}>
      {group.moves.map((move) => {
        const last = latestRecord(records, move, rm);
        const key = `${move}|${rm}`;
        const raw = values[key] || '';
        const bad = !!raw.trim() && !isValidQuickWeight(raw);
        return <Row as="label" key={move} title={move} className={`quick-row${last ? ' done' : ''}`}>
          {last
            ? <input value={`${last.value} lb`} disabled aria-label={`${move} ${rm}RM`} />
            : <input inputMode="decimal" placeholder="lb" autoComplete="off" value={raw} aria-invalid={bad}
              aria-label={`${move} ${rm}RM en libras`} onChange={(event) => setValues((v) => ({ ...v, [key]: event.target.value }))} />}
        </Row>;
      })}
    </List>)}
  </Sheet>;
}
