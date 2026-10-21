import Link from 'next/link';
import { AuthShell } from '../auth-panel';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../lib/password-policy';

export const dynamic = 'force-dynamic';
// The link token is a credential; keep it out of cross-origin Referer headers.
// no-referrer would make browsers send Origin: null on the form post, failing the origin check.
export const metadata = { referrer: 'same-origin' };

const linkErrors = {
  link_expired: 'El enlace caducó. Pide uno nuevo para cambiar tu contraseña.',
  link_invalid: 'El enlace no es válido o ya se usó. Pide uno nuevo para cambiar tu contraseña.',
  update_failed: 'No se pudo guardar la contraseña y el enlace ya se usó. Pide uno nuevo e inténtalo otra vez.',
  unavailable: 'La recuperación de contraseña no está disponible en este momento.',
};

const formErrors = {
  invalid_password: `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`,
  mismatch: 'Las contraseñas no coinciden.',
};

export default async function ResetPasswordPage({ searchParams }) {
  const { token_hash: tokenHash, type, error } = await searchParams;
  if (linkErrors[error] || typeof tokenHash !== 'string' || !tokenHash || type !== 'recovery') {
    return <AuthShell title="Enlace no válido">
      <p className="auth-message error" role="alert">{linkErrors[error] ?? linkErrors.link_invalid}</p>
      <Link className="filled-button" href="/forgot-password">Pedir un enlace nuevo</Link>
      <Link className="plain-button wide" href="/">Volver a iniciar sesión</Link>
    </AuthShell>;
  }
  return <AuthShell title="Nueva contraseña" subtitle="Elige la contraseña que usarás para entrar.">
    {error && <p className="auth-message error" role="alert">{formErrors[error] ?? 'No se pudo guardar la contraseña. Inténtalo de nuevo.'}</p>}
    <form className="auth-form" action="/auth/reset-password" method="post">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <div className="list form-group">
        <label className="field"><span>Contraseña</span><input name="password" type="password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} required /></label>
        <label className="field"><span>Repetir</span><input name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" placeholder="Repite la contraseña" required /></label>
      </div>
      <button className="filled-button">Guardar y entrar</button>
    </form>
  </AuthShell>;
}
