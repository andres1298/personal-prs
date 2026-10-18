'use client';

import { useEffect, useState } from 'react';
import { request } from './admin-request';

const rowNote = { fontSize: 13, marginTop: 2 };
const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit' });

export default function InvitationsPanel() {
  const [invitations, setInvitations] = useState([]);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try { setInvitations((await request('/api/invitations')).invitations); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { refresh(); }, []);

  async function create(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(''); setCopied(false);
    try {
      const { url } = await request('/api/invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.elements.name.value, email: form.elements.email.value }),
      });
      setLink(url);
      form.reset();
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function renew(invitation) {
    setError(''); setCopied(false);
    try {
      const { url } = await request(`/api/invitations/${invitation.id}`, { method: 'POST' });
      setLink(url);
      await refresh();
    } catch (err) { setError(err.message); }
  }

  async function revoke(id) {
    setError('');
    try { await request(`/api/invitations/${id}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { setError(err.message); }
  }

  async function copy(event) {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { event.currentTarget.closest('.setrow')?.querySelector('input')?.select(); }
  }

  return <>
    <div className="sec">Invitaciones</div>
    <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
      <label>Nombre <input name="name" required maxLength={80} autoComplete="off" /></label>
      <label>Correo <input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
      <button className="primary" disabled={busy}>{busy ? 'Creando…' : 'Crear link'}</button>
    </form>
    {error && <p className="sub" role="alert">{error}</p>}
    {link && <div className="setrow" style={{ marginTop: 10 }}>
      <input readOnly value={link} aria-label="Link de invitación" style={{ flex: 1, minWidth: 0, padding: '8px 10px', fontSize: 14 }} />
      <button className="okbtn" type="button" onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</button>
    </div>}
    {invitations.length > 0 && <div className="sec">Pendientes</div>}
    {invitations.map((invitation) => <div className={`setrow admin-row${invitation.expired ? ' off' : ''}`} key={invitation.id}>
      <div className="who">{invitation.name}
        <div className="sub" style={rowNote}>
          {invitation.email} · {invitation.expired ? 'venció' : 'vence'} {dateFormat.format(new Date(invitation.expiresAt))}
        </div>
      </div>
      <div className="admin-actions">
        <button className="okbtn" type="button" onClick={() => renew(invitation)} aria-label={`Nuevo link para ${invitation.name}`}>Nuevo link</button>
        <button className="okbtn" type="button" onClick={() => revoke(invitation.id)} aria-label={`Revocar invitación de ${invitation.name}`}>Revocar</button>
      </div>
    </div>)}
  </>;
}
