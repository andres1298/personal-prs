'use client';

import { useEffect, useState } from 'react';
import { useAlert } from '../ui/alert';
import Sheet from '../ui/sheet';

const NAME_MAX = 40;

// `groups` are the shared groups ({ tab, type, name }); the group decides the measurement type.
export default function NewMovementSheet({ open, groups, onClose, onCreate }) {
  const alert = useAlert();
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(''); setGroup(groups[0]?.name ?? ''); } }, [open, groups]);

  const type = groups.find((item) => item.name === group)?.type;
  const tabs = [...new Set(groups.map((item) => item.tab))];

  async function save(event) {
    event.preventDefault();
    if (!name.trim() || !group || saving) return;
    setSaving(true);
    try {
      await onCreate(name, group);
      onClose();
    } catch (err) {
      await alert({ title: 'No se pudo crear', message: err.message });
    } finally { setSaving(false); }
  }

  return <Sheet open={open} onClose={onClose} title="Nuevo movimiento" layer={3}
    leading={<button type="button" className="nav-text" onClick={onClose}>Cancelar</button>}
    trailing={<button type="submit" form="new-movement-form" className="nav-text strong" disabled={!name.trim() || !group || saving}>
      {saving ? 'Guardando…' : 'Guardar'}
    </button>}>
    <form id="new-movement-form" className="form" onSubmit={save} noValidate>
      <div className="list form-group">
        <label className="field">
          <span>Nombre</span>
          <input required maxLength={NAME_MAX} autoComplete="off" placeholder="Thruster" value={name}
            onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>Categoría</span>
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            {tabs.map((tab) => <optgroup key={tab} label={tab}>
              {groups.filter((item) => item.tab === tab).map((item) => <option key={item.name}>{item.name}</option>)}
            </optgroup>)}
          </select>
        </label>
      </div>
      {type && <p className="list-footer">
        {type === 'weight'
          ? 'Se registra en libras con 1RM, 3RM o 5RM, y aparece en la carga rápida.'
          : 'Se registra como tiempo (mm:ss), donde un tiempo menor es mejor.'}
      </p>}
    </form>
  </Sheet>;
}
