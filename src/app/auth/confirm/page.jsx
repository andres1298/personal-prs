import Link from 'next/link';
import { AuthShell } from '../../auth-panel';
import { createAuthClient, hasAuthConfiguration } from '../../../lib/server/auth';

export const dynamic = 'force-dynamic';
// The token in the URL is a credential; keep it out of cross-origin Referer headers.
// no-referrer would make browsers send Origin: null on the form post, failing the origin check.
export const metadata = { title: 'Confirmar correo', referrer: 'same-origin', robots: { index: false, follow: false } };

const CONFIRMATION_TYPES = new Set(['signup', 'email']);
const TOKEN_HASH_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

// Shown with the form: the link is still usable.
const formNotices = {
  invalid_password: 'La contraseña debe tener entre 8 y 72 caracteres.',
  mismatch: 'Las contraseñas no coinciden.',
  session_open: 'Marca la casilla para cerrar la sesión abierta y continuar con la cuenta de este enlace.',
  rate_limited: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
};

// Shown instead of the form: the link can no longer be used.
const linkNotices = {
  link_expired: 'El enlace de confirmación caducó o ya se usó. Si ya elegiste tu contraseña, inicia sesión; si no, regístrate de nuevo para recibir otro.',
  link_invalid: 'El enlace de confirmación no es válido. Si ya elegiste tu contraseña, inicia sesión; si no, regístrate de nuevo.',
  incomplete: 'Tu correo quedó confirmado, pero no pudimos terminar de activar tu cuenta. Pide ayuda al administrador para completar el registro.',
};

function single(value) {
  return typeof value === 'string' ? value : '';
}

async function openSessionEmail() {
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return data.user.email || 'otra cuenta';
  } catch {
    return null;
  }
}

export default async function ConfirmPage({ searchParams }) {
  const params = await searchParams;
  const tokenHash = single(params.token_hash);
  const type = single(params.type);
  const notice = single(params.notice);
  const usable = hasAuthConfiguration() && TOKEN_HASH_PATTERN.test(tokenHash) && CONFIRMATION_TYPES.has(type);

  if (!usable) {
    const message = !hasAuthConfiguration() ? 'El acceso a tu cuenta todavía no está disponible.' : linkNotices[notice] ?? linkNotices.link_invalid;
    return <AuthShell title="Mis PRs">
      <p className="auth-message" role="status">{message}</p>
      <Link className="filled-button" href="/app">Iniciar sesión</Link>
      <Link className="plain-button wide" href="/register">Crear cuenta</Link>
    </AuthShell>;
  }

  // The link's account is unknown until the token is used, so any open session gets the warning.
  const sessionEmail = await openSessionEmail();
  return <AuthShell title="Confirma tu correo" subtitle="Elige tu contraseña para activar tu cuenta.">
    {formNotices[notice] && <p className="auth-message error" role="alert">{formNotices[notice]}</p>}
    <form className="auth-form" action="/auth/callback" method="post">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {sessionEmail && <div className="auth-message auth-session" role="status">
        <p>Hay una sesión abierta como <strong>{sessionEmail}</strong>.</p>
        <label className="auth-check">
          <input type="checkbox" name="replace_session" value="1" required />
          <span>Cerrar esa sesión en este navegador y continuar con la cuenta de este enlace.</span>
        </label>
      </div>}
      <div className="list form-group">
        <label className="field"><span>Contraseña</span><input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required /></label>
        <label className="field"><span>Repite la contraseña</span><input name="confirm" type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="Repite la contraseña" required /></label>
      </div>
      <button className="filled-button">Continuar</button>
    </form>
  </AuthShell>;
}
