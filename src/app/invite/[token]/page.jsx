import Link from 'next/link';
import { AuthShell } from '../../auth-panel';
import { findValidInvitation, MIN_PASSWORD_LENGTH } from '../../../lib/server/invitations';

export const dynamic = 'force-dynamic';
// The link token is a credential; keep its path out of cross-origin Referer headers.
// no-referrer would make browsers send Origin: null on the form post, failing the origin check.
export const metadata = { title: 'Invitación', referrer: 'same-origin', robots: { index: false, follow: false } };

const formErrors = {
  mismatch: 'Las contraseñas no coinciden.',
  weak_password: 'La contraseña debe tener al menos 8 caracteres.',
  email_taken: 'Ya existe una cuenta con este correo.',
};

export default async function InvitationPage({ params, searchParams }) {
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = await findValidInvitation(token);

  if (!invitation) {
    return <AuthShell title="Mis PRs">
      <p className="auth-message" role="status">Este link ya no es válido. Pide una nueva invitación.</p>
      <Link className="plain-button wide" href="/app">Ir al inicio</Link>
    </AuthShell>;
  }

  return <AuthShell title={`Hola ${invitation.name}`} subtitle="Crea tu contraseña para entrar a Mis PRs.">
    {error && <p className="auth-message error" role="alert">{formErrors[error] ?? 'No se pudo crear la cuenta. Inténtalo de nuevo.'}</p>}
    <form className="auth-form" action="/auth/invite" method="post">
      <input type="hidden" name="token" value={token} />
      <div className="list form-group">
        <label className="field"><span>Correo</span><input name="email" type="email" value={invitation.email} autoComplete="username" readOnly /></label>
        <label className="field"><span>Contraseña</span><input name="password" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} required /></label>
        <label className="field"><span>Repetir</span><input name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" placeholder="Repite la contraseña" required /></label>
      </div>
      <button className="filled-button">Crear cuenta</button>
    </form>
  </AuthShell>;
}
