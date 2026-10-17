const authErrors = {
  credentials: 'Correo o contraseña incorrectos.',
  configuration: 'El acceso a tu cuenta todavía no está disponible.',
};

export default function AuthPanel({ configured, signedIn, authError }) {
  return <main className="auth-panel wrap">
    <img src="/icon-192.png" width="72" height="72" alt="" />
    <h1>Mis PRs</h1>
    <p className="sub">Guarda tus marcas personales y prepara tu entrenamiento.</p>
    {authError && <p role="alert">{authErrors[authError] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.'}</p>}
    {signedIn ? <>
      <p role="status">Tu cuenta todavía no tiene acceso. Solicita una invitación al administrador.</p>
      <form action="/auth/logout" method="post"><button className="primary">Cerrar sesión</button></form>
    </> : configured ? <form className="auth-form" action="/auth/login" method="post">
      <label>Correo <input name="email" type="email" autoComplete="username" required /></label>
      <label>Contraseña <input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="primary">Entrar</button>
    </form>
      : <p role="status">El acceso a tu cuenta todavía no está disponible.</p>}
    <a className="auth-demo" href="/?demo=1">Explorar con datos de ejemplo</a>
    <p className="sub">El modo de ejemplo no guarda registros en tu cuenta.</p>
  </main>;
}
