'use client';

import { useEffect, useState } from 'react';
import { bestRecord, formatValue, getCatalog, RMS } from '../../lib/catalog';
import { useAlert } from '../ui/alert';
import Icon from '../ui/icon';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const joinUrl = (code) => `${window.location.origin}/join/${code}`;

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function CopyButton({ text, label = 'Copiar link' }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="tinted-button small" onClick={async () => { setCopied(await copy(text)); setTimeout(() => setCopied(false), 1800); }}>
    {copied ? 'Copiado' : label}
  </button>;
}

/** Athletes, groups and invitations: who the coach works with and how they join. */
export default function PeopleView({ overview, api }) {
  const alert = useAlert();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);         // athlete id whose records are open
  const [groupName, setGroupName] = useState('');
  const [invite, setInvite] = useState({ name: '', groupId: '' });
  const [link, setLink] = useState(null);         // { name, url } shown once after creating a personal link

  // Runs a mutation, then reloads the overview; errors show as an alert.
  async function run(action) {
    setBusy(true);
    try { await action(); await api.reloadOverview(); return true; }
    catch (err) { await alert({ title: 'No se pudo completar', message: err.message }); return false; }
    finally { setBusy(false); }
  }
  const confirm = (title, message, label) => alert({ title, message, actions: [{ label: 'Cancelar', role: 'cancel' }, { label, role: 'destructive', value: true }] });

  async function createGroup(event) {
    event.preventDefault();
    if (await run(() => api.send('/api/coach/groups', 'POST', { name: groupName }))) setGroupName('');
  }
  async function createInvite(event) {
    event.preventDefault();
    await run(async () => {
      const created = await api.send('/api/coach/invites', 'POST', { name: invite.name, groupId: invite.groupId || null });
      setLink({ name: created.invite.name, url: joinUrl(created.token) });
      setInvite({ name: '', groupId: '' });
    });
  }
  const toggleMember = (group, athleteId) => run(() => api.send(`/api/coach/groups/${group.id}`, 'PATCH', {
    memberIds: group.memberIds.includes(athleteId) ? group.memberIds.filter((id) => id !== athleteId) : [...group.memberIds, athleteId],
  }));
  async function renameGroup(group, name) {
    if (name.trim() && name.trim() !== group.name) await run(() => api.send(`/api/coach/groups/${group.id}`, 'PATCH', { name }));
  }
  async function newCode(group) {
    if (await confirm(`¿Cambiar el código de ${group.name}?`, 'El código y el link actuales dejan de funcionar. Quienes ya se unieron siguen en el grupo.', 'Cambiar código')) {
      await run(() => api.send(`/api/coach/groups/${group.id}`, 'PATCH', { newCode: true }));
    }
  }
  async function archive(group) {
    if (await confirm(`¿Archivar ${group.name}?`, 'El grupo desaparece de tu calendario y sus atletas dejan de ver sus sesiones, salvo las que ya anotaron. Siguen siendo tus atletas.', 'Archivar')) {
      await run(() => api.send(`/api/coach/groups/${group.id}`, 'DELETE'));
    }
  }
  async function removeAthlete(athlete) {
    if (await confirm(`¿Quitar a ${athlete.name}?`, 'Deja de recibir tu programación y tú dejas de ver sus PRs. Conserva sus registros y queda en tu historial de atletas.', 'Quitar')) {
      if (await run(() => api.send(`/api/coach/athletes/${athlete.id}`, 'DELETE'))) setOpen(null);
    }
  }

  const { athletes, former, groups, invites } = overview;
  return <>
    <header className="coach-head"><h1 className="display">Atletas</h1></header>
    <div className="people">
      <section className="panel">
        <h2>Atletas activos · {athletes.length}</h2>
        {!athletes.length && <p className="panel-note">Todavía no tienes atletas. Comparte el código de un grupo o crea un link personal.</p>}
        {athletes.map((athlete) => <div className="person" key={athlete.id}>
          <button type="button" className="person-head" aria-expanded={open === athlete.id} onClick={() => setOpen(open === athlete.id ? null : athlete.id)}>
            <span className="person-text"><b>{athlete.name}</b><small>{athlete.email && athlete.email !== athlete.name ? `${athlete.email} · ` : ''}{athlete.division ? `pesos de ${athlete.division === 'WOMEN' ? 'chicas' : 'chicos'} · ` : 'sin categoría de pesos · '}desde {dateFormat.format(new Date(athlete.since))}</small></span>
            <Icon name="chevronDown" weight={2.4} />
          </button>
          {open === athlete.id && <div className="person-body">
            {groups.length > 0 && <div className="member-chips">
              {groups.map((group) => <button type="button" key={group.id} className="chip" style={{ '--c': `var(${group.color})` }}
                aria-pressed={group.memberIds.includes(athlete.id)} disabled={busy} onClick={() => toggleMember(group, athlete.id)}>{group.name}</button>)}
            </div>}
            <AthleteRecords athleteId={athlete.id} api={api} />
            <button type="button" className="tinted-button small danger" disabled={busy} onClick={() => removeAthlete(athlete)}>Quitar de mis atletas</button>
          </div>}
        </div>)}
        {former.length > 0 && <>
          <h2>Historial · ya no siguen tu plan</h2>
          {former.map((athlete) => <div className="person former" key={athlete.id}>
            <span className="person-text"><b>{athlete.name}</b>
              <small>{athlete.left ? 'Salió' : 'Lo quitaste'} el {dateFormat.format(new Date(athlete.endedAt))} · estuvo desde {dateFormat.format(new Date(athlete.since))}</small></span>
            <span className="badge">inactivo</span>
          </div>)}
        </>}
      </section>

      <section className="panel">
        <h2>Grupos · {groups.length}</h2>
        {groups.map((group) => <div className="group-card" key={group.id} style={{ '--b': `var(${group.color})` }}>
          <input className="group-name display" defaultValue={group.name} key={group.name} maxLength={40} aria-label="Nombre del grupo"
            onBlur={(event) => renameGroup(group, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          <p>{group.memberIds.length === 1 ? '1 atleta' : `${group.memberIds.length} atletas`} · código <b className="code num">{group.joinCode}</b></p>
          <div className="group-actions">
            <CopyButton text={joinUrl(group.joinCode)} />
            <CopyButton text={group.joinCode} label="Copiar código" />
            <button type="button" className="tinted-button small" disabled={busy} onClick={() => newCode(group)}>Cambiar código</button>
            <button type="button" className="tinted-button small" disabled={busy} onClick={() => archive(group)}>Archivar</button>
          </div>
        </div>)}
        <form className="inline-form" onSubmit={createGroup}>
          <input value={groupName} maxLength={40} placeholder="Nombre del nuevo grupo" aria-label="Nombre del nuevo grupo" onChange={(event) => setGroupName(event.target.value)} />
          <button className="pill-btn" disabled={busy || !groupName.trim()}>Crear grupo</button>
        </form>
        <p className="panel-note">Cualquiera con el código o el link del grupo puede unirse con su cuenta. Los atletas lo escriben en Ajustes → Coach.</p>
      </section>

      <section className="panel">
        <h2>Link personal</h2>
        <form className="inline-form stacked" onSubmit={createInvite}>
          <input value={invite.name} maxLength={80} placeholder="Nombre de la persona" aria-label="Nombre de la persona" onChange={(event) => setInvite({ ...invite, name: event.target.value })} />
          <select value={invite.groupId} aria-label="Grupo" onChange={(event) => setInvite({ ...invite, groupId: event.target.value })}>
            <option value="">Plan individual, sin grupo</option>
            {groups.map((group) => <option key={group.id} value={group.id}>Grupo {group.name}</option>)}
          </select>
          <button className="pill-btn" disabled={busy || !invite.name.trim()}>Crear link</button>
        </form>
        {link && <div className="link-box" role="status">
          <p>Link para <b>{link.name}</b>. Envíaselo en privado: sirve una sola vez, vence en 7 días y no se vuelve a mostrar.</p>
          <input readOnly value={link.url} aria-label="Link de invitación" onFocus={(event) => event.target.select()} />
          <CopyButton text={link.url} />
        </div>}
        {invites.length > 0 && <h2>Pendientes</h2>}
        {invites.map((pending) => <div className="person former" key={pending.id}>
          <span className="person-text"><b>{pending.name}</b>
            <small>{pending.expired ? 'Venció' : 'Vence'} el {dateFormat.format(new Date(pending.expiresAt))}{pending.groupId ? ` · ${groups.find((group) => group.id === pending.groupId)?.name ?? ''}` : ''}</small></span>
          <button type="button" className="tinted-button small" disabled={busy} onClick={() => run(() => api.send(`/api/coach/invites/${pending.id}`, 'DELETE'))}>Revocar</button>
        </div>)}
      </section>
    </div>
  </>;
}

// Read-only: the athlete's best per movement, as their own PRs screen would show it.
function AthleteRecords({ athleteId, api }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    api.recordsOf(athleteId).then((list) => { if (current) setRecords(list); }).catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [athleteId, api]);
  if (error) return <p className="field-error" role="alert">{error}</p>;
  if (!records) return <p className="panel-note">Cargando PRs…</p>;
  const rows = Object.values(getCatalog()).flatMap(({ type, groups }) => groups.flatMap((group) => group.moves.map((move) => {
    const bests = type === 'weight' ? RMS.map((rm) => [rm, bestRecord(records, move, rm)]).filter(([, best]) => best) : [[null, bestRecord(records, move)]].filter(([, best]) => best);
    return bests.length ? { move, type, bests } : null;
  }))).filter(Boolean);
  if (!rows.length) return <p className="panel-note">Todavía no tiene PRs registrados.</p>;
  return <table className="pr-table">
    <tbody>
      {rows.map(({ move, type, bests }) => <tr key={move}>
        <th scope="row">{move}</th>
        <td className="num">{bests.map(([rm, best]) => `${formatValue(best.value, type)}${rm ? ` · ${rm}RM` : ''}`).join('   ')}</td>
      </tr>)}
    </tbody>
  </table>;
}
