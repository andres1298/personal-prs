'use client';

import { useMemo } from 'react';
import { CUSTOM_GROUP } from '../../lib/catalog';
import { useAlert } from '../ui/alert';
import Icon from '../ui/icon';
import Sheet from '../ui/sheet';
import { List, Row } from '../ui/list';
import { Switch, SymbolTile } from '../ui/controls';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const SECTIONS = { LIFT: 'Lift', CARDIO: 'Cardio', BENCHMARK: 'Benchmarks' };
const ownGroup = (movement) => (movement.groupName === 'Custom' ? CUSTOM_GROUP.name : movement.groupName);

export default function MyMovementsSheet({ open, onClose, movements, onNew, onHide, onDelete }) {
  const alert = useAlert();
  const own = movements.filter((movement) => movement.custom);
  const shared = useMemo(() => {
    const groups = [];
    for (const movement of movements.filter((m) => !m.custom)) {
      let group = groups.find((g) => g.name === movement.groupName);
      if (!group) groups.push(group = { name: movement.groupName, items: [] });
      group.items.push(movement);
    }
    return groups;
  }, [movements]);

  async function toggle(movement, hidden) {
    try { await onHide(movement.id, hidden); }
    catch (err) { await alert({ title: 'No se pudo actualizar', message: err.message }); }
  }

  // The server answers with the record count when a movement has records, and the
  // member then has to confirm a second time before anything is deleted.
  async function remove(movement) {
    const first = await alert({
      title: `¿Eliminar ${movement.name}?`,
      message: 'Se quitará de tus movimientos.',
      actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Eliminar', role: 'destructive', value: true }],
    });
    if (!first) return;
    try {
      await onDelete(movement.id, false);
    } catch (err) {
      if (!err.recordCount) { await alert({ title: 'No se pudo eliminar', message: err.message }); return; }
      const second = await alert({
        title: `Se borrarán ${plural(err.recordCount, 'registro', 'registros')}`,
        message: `${movement.name} tiene ${plural(err.recordCount, 'registro', 'registros')}. Si continúas, se eliminan junto con el movimiento y no se pueden recuperar.`,
        actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Eliminar todo', role: 'destructive', value: true }],
      });
      if (!second) return;
      try { await onDelete(movement.id, true); }
      catch (retry) { await alert({ title: 'No se pudo eliminar', message: retry.message }); }
    }
  }

  return <Sheet open={open} onClose={onClose} title="Mis movimientos" layer={2}
    trailing={<button type="button" className="nav-text strong" onClick={onClose}>Listo</button>}>
    <List header="Creados por ti" footer="Solo tú los ves. Al eliminar uno se borran también sus registros.">
      {own.map((movement) => <Row key={movement.id} title={movement.name}
        subtitle={`${SECTIONS[movement.category] ?? 'Benchmarks'} · ${ownGroup(movement)} · ${movement.measurementType === 'WEIGHT' ? 'Peso' : 'Tiempo'}`}>
        <button type="button" className="nav-text danger" aria-label={`Eliminar ${movement.name}`} onClick={() => remove(movement)}>
          Eliminar
        </button>
      </Row>)}
      <Row leading={<SymbolTile color="--b-lilac"><Icon name="plus" /></SymbolTile>} title="Nuevo movimiento"
        subtitle="En una categoría existente o una nueva" chevron onClick={onNew} />
    </List>
    {shared.map((group) => <List key={group.name} header={group.name}
      footer={group === shared[shared.length - 1] ? 'Si desactivas un movimiento deja de aparecer, pero conservas su historial. Se muestra de nuevo al activarlo.' : undefined}>
      {group.items.map((movement) => <Row key={movement.id} title={movement.name}>
        <Switch checked={!movement.hidden} label={`Mostrar ${movement.name}`} onChange={(visible) => toggle(movement, !visible)} />
      </Row>)}
    </List>)}
  </Sheet>;
}
