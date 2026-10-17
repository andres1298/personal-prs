import { findValidInvitation, MIN_PASSWORD_LENGTH } from '../../../lib/server/invitations';

export const dynamic = 'force-dynamic';
// The link token is a credential; keep its path out of cross-origin Referer headers.
// no-referrer would make browsers send Origin: null on the form post, failing the origin check.
export const metadata = { referrer: 'same-origin' };

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
    return <main className="auth-panel wrap">
      <img src="/icon-192.png" width="72" height="72" alt="" />
      <h1>Mis PRs</h1>
      <p role="status">Este link ya no es válido. Pide una nueva invitación.</p>
      <a className="auth-demo" href="/">Ir al inicio</a>
    </main>;
  }

  return <main className="auth-panel wrap">
    <img src="/icon-192.png" width="72" height="72" alt="" />
    <h1>Hola {invitation.name}</h1>
    <p className="sub">Crea tu contraseña para entrar a Mis PRs.</p>
    {error && <p role="alert">{formErrors[error] ?? 'No se pudo crear la cuenta. Inténtalo de nuevo.'}</p>}
    <form className="auth-form" action="/auth/invite" method="post">
      <input type="hidden" name="token" value={token} />
      <label>Correo <input name="email" type="email" value={invitation.email} autoComplete="username" readOnly /></label>
      <label>Contraseña <input name="password" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required /></label>
      <label>Repite la contraseña <input name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required /></label>
      <button className="primary">Crear cuenta</button>
    </form>
  </main>;
}
