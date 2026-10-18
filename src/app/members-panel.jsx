'use client';

import { useEffect, useState } from 'react';
import { request } from './admin-request';

const rowNote = { fontSize: 13, marginTop: 2 };
const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: '2-digit' });

function recordLabel(count) {
  return count === 1 ? '1 registro' : `${count} registros`;
}

export default function MembersPanel() {
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
    if (disabled && !confirm(`¿Deshabilitar el acceso de ${member.name || member.email}?`)) return;
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
    <div className="sec">Usuarios{members && ` · ${active} ${active === 1 ? 'activo' : 'activos'} de ${members.length}`}</div>
    {error && <p className="sub" role="alert">{error}</p>}
    {!members && !error && <p className="sub">Cargando…</p>}
    {members?.map((member) => <div className={`setrow admin-row${member.disabledAt ? ' off' : ''}`} key={member.id}>
      <div className="who">{member.name || member.email || 'Sin nombre'}{member.isAdmin && ' · admin'}
        <div className="sub" style={rowNote}>
          {member.name && member.email && <>{member.email}<br /></>}
          {recordLabel(member.recordCount)} · desde {dateFormat.format(new Date(member.createdAt))}
          {member.disabledAt && ` · deshabilitado ${dateFormat.format(new Date(member.disabledAt))}`}
        </div>
      </div>
      {!member.isAdmin && <button
        type="button" className={`switch${member.disabledAt ? '' : ' on'}`} disabled={busyId === member.id}
        role="switch" aria-checked={!member.disabledAt} aria-label={`Acceso de ${member.name || member.email}`}
        onClick={() => toggle(member)}
      />}
    </div>)}
  </>;
}
