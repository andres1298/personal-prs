'use client';

import { useState } from 'react';
import TurnstileWidget from '../components/turnstile-widget';

// A plain form post to /auth/login. With a site key (provider CAPTCHA mode) it adds the Turnstile widget,
// whose hidden `cf-turnstile-response` input travels with the form, and waits for a token before submitting.
export default function LoginForm({ captchaSiteKey = '' }) {
  const [token, setToken] = useState('');
  const [loadError, setLoadError] = useState(false);
  return <form className="auth-form" action="/auth/login" method="post">
    {loadError && <p className="auth-message error" role="alert">No se pudo cargar la verificación. Recarga la página.</p>}
    <div className="list form-group">
      <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="username" placeholder="correo@ejemplo.com" required /></label>
      <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" placeholder="Requerida" required /></label>
    </div>
    {captchaSiteKey && <TurnstileWidget siteKey={captchaSiteKey} onToken={setToken} onLoadError={() => setLoadError(true)} />}
    <button className="filled-button" disabled={Boolean(captchaSiteKey) && !token}>Entrar</button>
  </form>;
}
