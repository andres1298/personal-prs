import Link from 'next/link';
import { AuthShell } from '../auth-panel';

export const dynamic = 'force-dynamic';

const formErrors = {
  invalid_email: 'Escribe un correo válido.',
  rate_limited: 'Demasiadas solicitudes. Espera un rato e inténtalo de nuevo.',
  unavailable: 'La recuperación de contraseña no está disponible en este momento.',
};

export default async function ForgotPasswordPage({ searchParams }) {
  const { sent, error } = await searchParams;
  if (sent === '1') {
    // Same message whether or not the account exists.
    return <AuthShell title="Revisa tu correo">
      <p className="auth-message" role="status">Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Caduca en 1 hora y solo funciona una vez.</p>
      <p className="auth-footnote">Si no lo ves en unos minutos, mira en spam.</p>
      <Link className="plain-button wide" href="/">Volver a iniciar sesión</Link>
    </AuthShell>;
  }
  return <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una contraseña nueva.">
    {error && <p className="auth-message error" role="alert">{formErrors[error] ?? 'No se pudo enviar el enlace. Inténtalo de nuevo.'}</p>}
    <form className="auth-form" action="/auth/forgot-password" method="post">
      <div className="list form-group">
        <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="username" maxLength={254} placeholder="correo@ejemplo.com" required /></label>
      </div>
      <button className="filled-button">Enviar enlace</button>
    </form>
    <Link className="plain-button wide" href="/">Volver a iniciar sesión</Link>
  </AuthShell>;
}
