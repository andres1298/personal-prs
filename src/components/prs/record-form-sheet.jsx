'use client';

import { useRef, useState } from 'react';
import { CATALOG, RMS, moveInfo, parseValue, today } from '../../lib/catalog';
import { useAlert } from '../ui/alert';
import Sheet from '../ui/sheet';
import { SegmentedControl } from '../ui/controls';

const FIRST_MOVE = CATALOG.Lift.groups[0].moves[0];

function RecordForm({ initial, onSave, formId, onSavingChange }) {
  const alert = useAlert();
  const [move, setMove] = useState(initial.move || FIRST_MOVE);
  const [value, setValue] = useState('');
  const [rm, setRm] = useState(initial.rm || 1);
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { type } = moveInfo(move);

  async function submit(event) {
    event.preventDefault();
    const record = { move, value: parseValue(value, type), date, notes: notes.trim() };
    if (type === 'weight') record.rm = rm;
    if (!(record.value > 0)) { setInvalid(true); return; }
    onSavingChange(true);
    try {
      await onSave(record);
    } catch (err) {
      await alert({ title: 'No se pudo guardar', message: err.message });
    } finally {
      onSavingChange(false);
    }
  }

  return <form id={formId} className="form" onSubmit={submit} noValidate>
    <div className="list form-group">
      <label className="field">
        <span>Movimiento</span>
        <select value={move} onChange={(event) => { setMove(event.target.value); setInvalid(false); }}>
          {Object.entries(CATALOG).map(([tab, category]) => category.groups.map((group) =>
            <optgroup key={`${tab}-${group.name}`} label={`${tab} · ${group.name}`}>
              {group.moves.map((m) => <option key={m}>{m}</option>)}
            </optgroup>))}
        </select>
      </label>
      <label className="field">
        <span>{type === 'time' ? 'Tiempo' : 'Peso'}</span>
        <input required inputMode={type === 'time' ? 'numeric' : 'decimal'} placeholder={type === 'time' ? 'mm:ss' : 'lb'}
          value={value} aria-invalid={invalid} onChange={(event) => { setValue(event.target.value); setInvalid(false); }} />
      </label>
      <label className="field">
        <span>Fecha</span>
        <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
    </div>
    {invalid && <p className="field-error" role="alert">{type === 'time' ? 'Escribe el tiempo como mm:ss, por ejemplo 4:45.' : 'Escribe un peso mayor que cero.'}</p>}
    {type === 'weight' && <SegmentedControl label="Repeticiones máximas" value={rm} onChange={setRm}
      options={RMS.map((n) => ({ value: n, label: `${n}RM` }))} />}
    <div className="list form-group">
      <label className="field stacked">
        <span>Notas</span>
        <textarea rows={3} value={notes} placeholder="Opcional" onChange={(event) => setNotes(event.target.value)} />
      </label>
    </div>
  </form>;
}

export default function RecordFormSheet({ form, onClose, onSave }) {
  const last = useRef(form);
  if (form) last.current = form;
  const [saving, setSaving] = useState(false);
  const formId = 'record-form';
  return <Sheet open={!!form} onClose={onClose} title="Nuevo registro" layer={1}
    leading={<button type="button" className="nav-text" onClick={onClose}>Cancelar</button>}
    trailing={<button type="submit" form={formId} className="nav-text strong" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>}>
    {last.current && <RecordForm key={last.current.id} initial={last.current} onSave={onSave}
      formId={formId} onSavingChange={setSaving} />}
  </Sheet>;
}
