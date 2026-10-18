'use client';

import { useEffect, useState } from 'react';
import { request } from './admin-request';
import { useAlert } from '../components/ui/alert';
import { List, Row } from '../components/ui/list';
import { Switch } from '../components/ui/controls';

const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: '2-digit' });

function recordLabel(count) {
  return count === 1 ? '1 registro' : `${count} registros`;
}

export default function MembersPanel() {
  const alert = useAlert();
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function refresh() {
    try { setMembers((await request('/api/members')).members); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { refresh(); }, []);

  async function toggle(member) {
    const disabled = !member.disabledAt;
    if (disabled) {
      const confirmed = await alert({
        title: `¿Deshabilitar a ${member.name || member.email}?`,
        message: 'Perderá el acceso a la app hasta que lo vuelvas a habilitar.',
        actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Deshabilitar', role: 'destructive', value: true }],
      });
      if (!confirmed) return;
    }
    setBusyId(member.id); setError('');
    try {
      await request(`/api/members/${member.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disabled }),
      });
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusyId(''); }
  }

  const active = members?.filter((member) => !member.disabledAt).length ?? 0;

  return <>
    {error && <p className="field-error" role="alert">{error}</p>}
    {!members && !error && <p className="empty compact">Cargando…</p>}
    {members && <List header={`Usuarios · ${active} ${active === 1 ? 'activo' : 'activos'} de ${members.length}`}>
      {members.map((member) => <Row key={member.id} className={member.disabledAt ? 'off' : ''}
        title={<>{member.name || member.email || 'Sin nombre'}{member.isAdmin && <small className="badge">admin</small>}</>}
        subtitle={<>
          {member.name && member.email && <>{member.email}<br /></>}
          {recordLabel(member.recordCount)} · desde {dateFormat.format(new Date(member.createdAt))}
          {member.disabledAt && ` · deshabilitado ${dateFormat.format(new Date(member.disabledAt))}`}
        </>}>
        {!member.isAdmin && <Switch checked={!member.disabledAt} disabled={busyId === member.id}
          label={`Acceso de ${member.name || member.email}`} onChange={() => toggle(member)} />}
      </Row>)}
    </List>}
  </>;
}
