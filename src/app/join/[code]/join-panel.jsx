'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { writeStored } from '../../../components/hooks';

/** Accepts a coach's invitation, or keeps the code on the device until the visitor signs in. */
export default function JoinPanel({ code, signedIn, own, otherCoach, coachName }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!signedIn) writeStored('prs_pending_join', code); }, [signedIn, code]);

  async function accept() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/coaching', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudo aceptar la invitación. Inténtalo de nuevo.');
      window.location.assign('/app');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  if (!signedIn) {
    return <>
      <p className="auth-message" role="status">Entra a tu cuenta o crea una para aceptar. Al entrar volverás a esta invitación.</p>
      <Link className="filled-button" href="/app">Iniciar sesión</Link>
      <Link className="plain-button wide" href="/register">Crear cuenta</Link>
    </>;
  }
  if (own) {
    return <>
      <p className="auth-message" role="status">Esta invitación es tuya: compártela con tus atletas.</p>
      <Link className="plain-button wide" href="/coach">Ir al modo coach</Link>
    </>;
  }
  if (otherCoach) {
    return <>
      <p className="auth-message" role="status">Ya sigues el plan de {otherCoach}. Para aceptar esta invitación, sal primero de ese plan desde Ajustes.</p>
      <Link className="plain-button wide" href="/app">Ir a la app</Link>
    </>;
  }
  return <>
    <p className="auth-message" role="status">Al aceptar, {coachName} podrá ver tus PRs y lo que anotes en sus sesiones, sin poder modificarlos. Puedes salir del plan cuando quieras desde Ajustes.</p>
    {error && <p className="auth-message error" role="alert">{error}</p>}
    <button type="button" className="filled-button" disabled={busy} onClick={accept}>{busy ? 'Aceptando…' : 'Aceptar invitación'}</button>
    <Link className="plain-button wide" href="/app">Ahora no</Link>
  </>;
}
