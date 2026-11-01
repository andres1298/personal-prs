import Image from 'next/image';
import Link from 'next/link';
import LoginForm from './login-form';

const authErrors = {
  credentials: 'Correo o contraseña incorrectos.',
  link_expired: 'El enlace de confirmación caducó. Si ya confirmaste tu correo, inicia sesión; si no, regístrate de nuevo para recibir otro.',
  link_invalid: 'El enlace de confirmación no es válido. Si ya confirmaste tu correo, inicia sesión; si no, regístrate de nuevo.',
  configuration: 'El acceso a tu cuenta todavía no está disponible.',
  captcha_failed: 'No pudimos verificar que eres una persona. Inténtalo de nuevo.',
  account_created: 'Tu cuenta quedó creada. Inicia sesión con tu correo y la contraseña que elegiste.',
};

export function AuthShell({ title, subtitle, children }) {
  return <main className="auth-panel wrap">
    <Image className="app-icon" src="/icon-192.png" width={84} height={84} alt="" priority />
    <h1 className="display">{title}</h1>
    {subtitle && <p className="auth-subtitle">{subtitle}</p>}
    {children}
  </main>;
}

export default function AuthPanel({ configured, signedIn, authError, captchaSiteKey = '' }) {
  return <AuthShell title="Mis PRs" subtitle="Guarda tus marcas personales y prepara tu entrenamiento.">
    {authError && <p className="auth-message error" role="alert">{authErrors[authError] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.'}</p>}
    {signedIn ? <>
      <p className="auth-message" role="status">Tu cuenta todavía no tiene acceso. Si acabas de registrarte, confirma tu correo desde el enlace que te enviamos; si no, solicita una invitación al administrador.</p>
      <form action="/auth/logout" method="post"><button className="filled-button">Cerrar sesión</button></form>
    </> : configured ? <LoginForm captchaSiteKey={captchaSiteKey} />
      : <p className="auth-message" role="status">El acceso a tu cuenta todavía no está disponible.</p>}
    {configured && !signedIn && <Link className="plain-button wide" href="/register">Crear cuenta</Link>}
    <Link className="plain-button wide" href="/app?demo=1">Explorar con datos de ejemplo</Link>
    <p className="auth-footnote">El modo de ejemplo no guarda registros en tu cuenta.</p>
  </AuthShell>;
}
