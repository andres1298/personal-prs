'use client';

import { useEffect, useState } from 'react';
import { useAlert } from '../ui/alert';
import Sheet from '../ui/sheet';
import { SegmentedControl } from '../ui/controls';

const NAME_MAX = 40;
const TYPES = [{ value: 'WEIGHT', label: 'Peso' }, { value: 'TIME', label: 'Tiempo' }];

export default function NewMovementSheet({ open, onClose, onCreate }) {
  const alert = useAlert();
  const [name, setName] = useState('');
  const [type, setType] = useState('WEIGHT');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(''); setType('WEIGHT'); } }, [open]);

  async function save(event) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate(name, type);
      onClose();
    } catch (err) {
      await alert({ title: 'No se pudo crear', message: err.message });
    } finally { setSaving(false); }
  }

  return <Sheet open={open} onClose={onClose} title="Nuevo movimiento" layer={3}
    leading={<button type="button" className="nav-text" onClick={onClose}>Cancelar</button>}
    trailing={<button type="submit" form="new-movement-form" className="nav-text strong" disabled={!name.trim() || saving}>
      {saving ? 'Guardando…' : 'Guardar'}
    </button>}>
    <form id="new-movement-form" className="form" onSubmit={save} noValidate>
      <div className="list form-group">
        <label className="field">
          <span>Nombre</span>
          <input required maxLength={NAME_MAX} autoComplete="off" placeholder="Thruster" value={name}
            onChange={(event) => setName(event.target.value)} />
        </label>
      </div>
      <SegmentedControl label="Tipo de medición" value={type} onChange={setType} options={TYPES} />
      <p className="list-footer">
        {type === 'WEIGHT'
          ? 'Se registra en libras con 1RM, 3RM o 5RM, y aparece en la carga rápida.'
          : 'Se registra como tiempo (mm:ss), donde un tiempo menor es mejor.'}
      </p>
    </form>
  </Sheet>;
}
