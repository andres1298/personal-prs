'use client';

import { useEffect, useRef, useState } from 'react';
import { request } from './admin-request';
import { useAlert } from '../components/ui/alert';
import { List, Row } from '../components/ui/list';

const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit' });

export default function InvitationsPanel() {
  const alert = useAlert();
  const [invitations, setInvitations] = useState([]);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const linkInput = useRef(null);

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

  async function revoke(invitation) {
    const confirmed = await alert({
      title: `¿Revocar la invitación de ${invitation.name}?`,
      message: 'El link dejará de funcionar.',
      actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Revocar', role: 'destructive', value: true }],
    });
    if (!confirmed) return;
    setError('');
    try { await request(`/api/invitations/${invitation.id}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { setError(err.message); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { linkInput.current?.select(); }
  }

  return <>
    <form onSubmit={create} className="form">
      <List header="Nueva invitación">
        <label className="field"><span>Nombre</span><input name="name" required maxLength={80} autoComplete="off" placeholder="Nombre" /></label>
        <label className="field"><span>Correo</span><input name="email" type="email" required maxLength={254} autoComplete="off" placeholder="correo@ejemplo.com" /></label>
      </List>
      <button className="filled-button" disabled={busy}>{busy ? 'Creando…' : 'Crear link'}</button>
    </form>
    {error && <p className="field-error" role="alert">{error}</p>}
    {link && <List header="Link de invitación" footer="Compártelo solo con esa persona. Caduca en 7 días.">
      <div className="row link-row">
        <input ref={linkInput} readOnly value={link} aria-label="Link de invitación" />
        <button className="tinted-button small" type="button" onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</button>
      </div>
    </List>}
    {invitations.length > 0 && <List header="Pendientes">
      {invitations.map((invitation) => <Row key={invitation.id} className={invitation.expired ? 'off' : ''} title={invitation.name}
        subtitle={`${invitation.email} · ${invitation.expired ? 'venció' : 'vence'} ${dateFormat.format(new Date(invitation.expiresAt))}`}>
        <span className="row-actions">
          <button className="tinted-button small" type="button" onClick={() => renew(invitation)} aria-label={`Nuevo link para ${invitation.name}`}>Nuevo link</button>
          <button className="tinted-button small danger" type="button" onClick={() => revoke(invitation)} aria-label={`Revocar invitación de ${invitation.name}`}>Revocar</button>
        </span>
      </Row>)}
    </List>}
  </>;
}
