import Image from 'next/image';
import Link from 'next/link';

const authErrors = {
  credentials: 'Correo o contraseña incorrectos.',
  link_expired: 'El enlace de confirmación caducó. Si ya confirmaste tu correo, inicia sesión; si no, regístrate de nuevo para recibir otro.',
  link_invalid: 'El enlace de confirmación no es válido. Si ya confirmaste tu correo, inicia sesión; si no, regístrate de nuevo.',
  configuration: 'El acceso a tu cuenta todavía no está disponible.',
};

// One side of a loaded barbell, in the plates' own colors: [token, height %].
const PLATES = [['--p45', 100], ['--p45', 100], ['--p25', 84], ['--p10', 64], ['--p5', 48], ['--p2', 38]];

/**
 * The frame of every signed-out screen: a color block with the title and a loaded barbell, and
 * the form under it. `tone` is the block's color token; each screen keeps its own.
 */
export function AuthShell({ title, subtitle, tone = '--b-yellow', children }) {
  return <main className="auth-page" style={{ '--c': `var(${tone})` }}>
    <header className="auth-hero">
      <p className="auth-brand"><Image src="/icon-192.png" width={36} height={36} alt="" priority />Mis PRs</p>
      <div className="auth-barbell" aria-hidden="true">
        {PLATES.map(([color, height], index) => <i key={index} style={{ '--p': `var(${color})`, '--h': `${height}%`, '--i': index }} />)}
        <span />
      </div>
      <h1 className="display">{title}</h1>
      {subtitle && <p className="auth-lead">{subtitle}</p>}
    </header>
    <div className="auth-body">{children}</div>
  </main>;
}

export default function AuthPanel({ configured, signedIn, authError }) {
  return <AuthShell title="Entrar" subtitle="Tus marcas, tu plan y la barra lista para cargar.">
    {authError && <p className="auth-message error" role="alert">{authErrors[authError] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.'}</p>}
    {signedIn ? <>
      <p className="auth-message" role="status">Tu cuenta todavía no tiene acceso. Si acabas de registrarte, confirma tu correo desde el enlace que te enviamos; si no, solicita una invitación al administrador.</p>
      <form action="/auth/logout" method="post"><button className="filled-button">Cerrar sesión</button></form>
    </> : configured ? <form className="auth-form" action="/auth/login" method="post">
      <div className="list form-group">
        <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="username" placeholder="correo@ejemplo.com" required /></label>
        <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
      </div>
      <button className="filled-button">Entrar</button>
    </form>
      : <p className="auth-message" role="status">El acceso a tu cuenta todavía no está disponible.</p>}
    <div className="auth-links">
      {configured && !signedIn && <Link className="auth-link" href="/register"><b>Crear cuenta</b><small>Gratis, con tu correo</small></Link>}
      <Link className="auth-link" href="/app?demo=1"><b>Ver un ejemplo</b><small>Sin cuenta ni registros guardados</small></Link>
    </div>
  </AuthShell>;
}
