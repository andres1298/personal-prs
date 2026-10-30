'use client';

import { useEffect, useRef, useState } from 'react';
import { CATALOG_TABS, CUSTOM_GROUP, TAB_CATEGORIES, getCatalog } from '../../lib/catalog';
import { useAlert } from '../ui/alert';
import Icon from '../ui/icon';
import Sheet from '../ui/sheet';
import { SegmentedControl } from '../ui/controls';

const NAME_MAX = 40;
const GROUP_MAX = 24;
const NEW_GROUP = '';
const TAB_HINTS = {
  Lift: 'Se mide en libras con 1RM, 3RM o 5RM. Aparece en Execute y en la carga rápida.',
  Cardio: 'Se mide en tiempo (mm:ss); un tiempo menor es mejor.',
  Benchmarks: 'Se mide en tiempo (mm:ss); un tiempo menor es mejor.',
};

// The section's groups, with "Mis movimientos" always offered as the default place.
function groupsOf(tab) {
  const groups = getCatalog()[tab].groups.map(({ name, color }) => ({ name, color }));
  if (!groups.some((group) => group.name === CUSTOM_GROUP.name)) groups.push(CUSTOM_GROUP);
  return groups;
}

/**
 * Creates an own movement. `preset` opens the sheet ({ tab, group }) and can preselect
 * the section and category.
 */
export default function NewMovementSheet({ preset, onClose, onCreate }) {
  const alert = useAlert();
  const [name, setName] = useState('');
  const [tab, setTab] = useState('Lift');
  const [group, setGroup] = useState(CUSTOM_GROUP.name);
  const [newGroup, setNewGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const newGroupInput = useRef(null);
  const groups = groupsOf(tab);
  const creatingGroup = group === NEW_GROUP;
  const canSave = name.trim() && (!creatingGroup || newGroup.trim()) && !saving;

  useEffect(() => {
    if (!preset) return;
    const startTab = CATALOG_TABS.includes(preset.tab) ? preset.tab : 'Lift';
    setName(''); setNewGroup(''); setTab(startTab);
    setGroup(preset.group && groupsOf(startTab).some((g) => g.name === preset.group) ? preset.group : CUSTOM_GROUP.name);
  }, [preset]);

  function changeTab(next) {
    setTab(next);
    if (!creatingGroup) setGroup(CUSTOM_GROUP.name);
  }

  function startNewGroup() {
    setGroup(NEW_GROUP);
    requestAnimationFrame(() => newGroupInput.current?.focus());
  }

  async function save(event) {
    event.preventDefault();
    if (!canSave) return;
    const input = { name, category: TAB_CATEGORIES[tab] };
    // Without a group the server keeps the movement in "Mis movimientos".
    if (creatingGroup) input.groupName = newGroup;
    else if (group !== CUSTOM_GROUP.name) input.groupName = group;
    setSaving(true);
    try {
      await onCreate(input);
      onClose();
    } catch (err) {
      await alert({ title: 'No se pudo crear', message: err.message });
    } finally { setSaving(false); }
  }

  return <Sheet open={!!preset} onClose={onClose} title="Nuevo movimiento" layer={3}
    trailing={<>
      <button type="button" className="nav-text" onClick={onClose}>Cancelar</button>
      <button type="submit" form="new-movement-form" className="nav-text strong" disabled={!canSave}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </>}>
    <form id="new-movement-form" className="form" onSubmit={save} noValidate>
      <div className="list form-group">
        <label className="field">
          <span>Nombre</span>
          <input required maxLength={NAME_MAX} autoComplete="off" placeholder="Thruster" value={name}
            onChange={(event) => setName(event.target.value)} />
        </label>
      </div>

      <h3 className="list-header">Sección</h3>
      <SegmentedControl label="Sección" value={tab} onChange={changeTab}
        options={CATALOG_TABS.map((key) => ({ value: key, label: key }))} />
      <p className="list-footer form-group">{TAB_HINTS[tab]}</p>

      <h3 className="list-header">Categoría</h3>
      <div className="chips wrap" role="group" aria-label="Categoría">
        {groups.map((g) => <button type="button" key={g.name} className="chip" aria-pressed={g.name === group}
          style={{ '--c': `var(${g.color})` }} onClick={() => setGroup(g.name)}>{g.name}</button>)}
        <button type="button" className="chip add" aria-pressed={creatingGroup} onClick={startNewGroup}>
          <Icon name="plus" weight={2.6} />Nueva categoría
        </button>
      </div>
      {creatingGroup && <div className="list form-group">
        <label className="field">
          <span>Categoría</span>
          <input ref={newGroupInput} required maxLength={GROUP_MAX} autoComplete="off" placeholder="Gimnasia" value={newGroup}
            onChange={(event) => setNewGroup(event.target.value)} />
        </label>
      </div>}
      <p className="list-footer">
        {creatingGroup
          ? `Se crea en ${tab} y la puedes usar en tus próximos movimientos.`
          : `Aparecerá en ${tab} dentro de ${group}. Solo tú lo ves.`}
      </p>
    </form>
  </Sheet>;
}
