import Image from 'next/image';
import Link from 'next/link';
import PasswordField from '../components/ui/password-field';

const authErrors = {
  credentials: 'Correo o contraseña incorrectos.',
  link_expired: 'El enlace de confirmación caducó. Si ya confirmaste tu correo, inicia sesión; si no, regístrate de nuevo para recibir otro.',
  link_invalid: 'El enlace de confirmación no es válido. Si ya confirmaste tu correo, inicia sesión; si no, regístrate de nuevo.',
  configuration: 'El acceso a tu cuenta todavía no está disponible.',
};

/**
 * The frame of every signed-out screen, in the landing page's voice: the app icon and one link
 * on top, then a small label, a left-aligned title with its last line marked in a block color,
 * a short lead and the form. `title` breaks into lines at "\n"; `tone` is the mark's color token.
 */
export function AuthShell({ eyebrow, title, subtitle, tone = '--b-yellow', action, children }) {
  const lines = title.split('\n');
  return <main className="auth-page" style={{ '--c': `var(${tone})` }}>
    <header className="auth-top">
      <Link href="/" aria-label="Mis PRs, inicio"><Image src="/icon-192.png" width={40} height={40} alt="" priority /></Link>
      {action && <Link className="auth-pill" href={action.href}>{action.label}</Link>}
    </header>
    <div className="auth-copy">
      {eyebrow && <p className="auth-eyebrow"><i aria-hidden="true" />{eyebrow}</p>}
      <h1 className="display">{lines.map((line, index) => <span key={index} className={index === lines.length - 1 ? 'auth-mark' : undefined}>{line}</span>)}</h1>
      {subtitle && <p className="auth-lead">{subtitle}</p>}
    </div>
    <div className="auth-body">{children}</div>
  </main>;
}

const arrow = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export default function AuthPanel({ configured, signedIn, authError }) {
  return <AuthShell eyebrow="Bienvenido de vuelta" title={'Entra a\ntus PRs.'} subtitle="Tus marcas, tu plan y los discos de cada serie."
    action={configured && !signedIn ? { href: '/register', label: 'Crear cuenta' } : null}>
    {authError && <p className="auth-message error" role="alert">{authErrors[authError] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.'}</p>}
    {signedIn ? <>
      <p className="auth-message" role="status">Tu cuenta todavía no tiene acceso. Si acabas de registrarte, confirma tu correo desde el enlace que te enviamos; si no, solicita una invitación al administrador.</p>
      <form action="/auth/logout" method="post"><button className="filled-button">Cerrar sesión</button></form>
    </> : configured ? <form className="auth-form" action="/auth/login" method="post">
      <div className="list form-group">
        <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="username" placeholder="correo@ejemplo.com" required /></label>
        <PasswordField autoComplete="current-password" placeholder="Tu contraseña" />
      </div>
      <button className="filled-button">Entrar{arrow}</button>
    </form>
      : <p className="auth-message" role="status">El acceso a tu cuenta todavía no está disponible.</p>}
    <Link className="auth-outline" href="/app?demo=1">Abrir la demo</Link>
    <p className="auth-footnote">La demo usa datos de ejemplo y no guarda nada en tu cuenta.</p>
  </AuthShell>;
}
