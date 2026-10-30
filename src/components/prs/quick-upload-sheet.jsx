'use client';

import { useEffect, useState } from 'react';
import { RMS, formatValue, isValidQuickWeight, isValidReps, latestRecord, parseValue, repsGroups, today, weightGroups } from '../../lib/catalog';
import { useAlert } from '../ui/alert';
import Sheet from '../ui/sheet';
import { List, Row } from '../ui/list';
import { SegmentedControl } from '../ui/controls';

// Each tab lists its movements: lifts per RM and gymnastics as maximum repetitions.
const REPS = 'reps';
const groupsOf = (mode) => (mode === REPS ? repsGroups() : weightGroups());
const allRecorded = (records, mode) => groupsOf(mode).flatMap((g) => g.moves).every((m) => latestRecord(records, m, mode));

// Only fills movement + RM pairs (or gymnastics movements) without records; edits survive switching tabs.
export default function QuickUploadSheet({ open, records, onClose, onSave }) {
  const alert = useAlert();
  const [mode, setMode] = useState(1);          // 1, 3, 5 or REPS
  const [values, setValues] = useState({});   // `${move}|${mode}` → typed text
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setMode(1); setValues({}); } }, [open]);

  const reps = mode === REPS;
  const entries = Object.entries(values)
    .map(([key, raw]) => { const [move, n] = key.split('|'); return { move, mode: n === REPS ? REPS : +n, raw }; })
    .filter((e) => e.raw.trim() && !latestRecord(records, e.move, e.mode));
  const isValid = (e) => (e.mode === REPS ? isValidReps(e.raw) : isValidQuickWeight(e.raw));
  const valid = entries.length > 0 && entries.every(isValid);
  const allDone = allRecorded(records, mode);

  async function save() {
    if (!valid) return;
    setSaving(true);
    const date = today();
    try {
      await onSave(entries.map((e) => (e.mode === REPS
        ? { move: e.move, value: parseValue(e.raw, 'reps'), date }
        : { move: e.move, value: parseValue(e.raw, 'weight'), date, rm: e.mode })));
    } catch (err) {
      await alert({ title: 'No se pudo guardar', message: err.message });
    } finally { setSaving(false); }
  }

  return <Sheet open={open} onClose={onClose} title="Carga rápida"
    trailing={<>
      <button type="button" className="nav-text" onClick={onClose}>Cancelar</button>
      <button type="button" className="nav-text strong" disabled={!valid || saving} onClick={save}>
        {saving ? 'Guardando…' : entries.length ? `Guardar (${entries.length})` : 'Guardar'}
      </button>
    </>}>
    <p className="sheet-lead">Completa los pesos y repeticiones que te faltan. Se guardan con fecha de hoy.</p>
    <SegmentedControl label="Repeticiones máximas" value={mode} onChange={setMode}
      options={[...RMS.map((n) => ({ value: n, label: `${n}RM${allRecorded(records, n) ? ' ✓' : ''}` })),
        ...(repsGroups().length ? [{ value: REPS, label: `Reps${allRecorded(records, REPS) ? ' ✓' : ''}` }] : [])]} />
    {allDone && <p className="sheet-lead">{reps ? 'Ya tienes todos tus máximos de repeticiones registrados.' : `Ya tienes todos los ${mode}RM registrados.`}</p>}
    {groupsOf(mode).map((group) => <List key={group.name} header={<><i className="dot" style={{ '--c': `var(${group.color})` }} />{group.name}</>}>
      {group.moves.map((move) => {
        const last = latestRecord(records, move, mode);
        const key = `${move}|${mode}`;
        const raw = values[key] || '';
        const bad = !!raw.trim() && !isValid({ mode, raw });
        const name = reps ? `${move}, máximo de repeticiones` : `${move} ${mode}RM`;
        return <Row as="label" key={move} title={move} className={`quick-row${last ? ' done' : ''}`}>
          {last
            ? <input value={formatValue(last.value, reps ? 'reps' : 'weight')} disabled aria-label={name} />
            : <input inputMode={reps ? 'numeric' : 'decimal'} placeholder={reps ? 'reps' : 'lb'} autoComplete="off" value={raw} aria-invalid={bad}
              aria-label={reps ? name : `${name} en libras`} onChange={(event) => setValues((v) => ({ ...v, [key]: event.target.value }))} />}
        </Row>;
      })}
    </List>)}
  </Sheet>;
}
