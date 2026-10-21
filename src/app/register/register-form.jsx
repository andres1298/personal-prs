'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/ui/icon';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../lib/password-policy';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const messages = {
  invalid_name: 'Escribe tu nombre (máximo 80 caracteres).',
  invalid_email: 'Escribe un correo válido.',
  invalid_password: `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`,
  wrong_code: 'El código del gimnasio no es correcto.',
  captcha_failed: 'No pudimos verificar que eres una persona. Inténtalo de nuevo.',
  rate_limited: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  unavailable: 'El registro todavía no está disponible.',
};

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.append(script);
    }
    script.addEventListener('load', () => resolve(window.turnstile), { once: true });
    script.addEventListener('error', reject, { once: true });
  });
}

export default function RegisterForm({ siteKey }) {
  const widget = useRef(null);
  const widgetId = useRef(null);
  const [token, setToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    if (!siteKey || !widget.current) return undefined;
    let cancelled = false;
    loadTurnstile().then((turnstile) => {
      if (cancelled) return;
      widgetId.current = turnstile.render(widget.current, {
        sitekey: siteKey,
        callback: setToken,
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    }).catch(() => setError('No se pudo cargar la verificación. Recarga la página.'));
    return () => {
      cancelled = true;
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  async function submit(event) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    const email = String(body.get('email') ?? '').trim();
    body.set('cf-turnstile-response', token);
    setBusy(true); setError('');
    try {
      const response = await fetch('/auth/register', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (result.ok) setSentTo(email);
      else setError(messages[result.error] ?? 'No se pudo crear la cuenta. Inténtalo de nuevo.');
    } catch {
      setError('No se pudo crear la cuenta. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
      // A Turnstile token is single-use, so every attempt needs a fresh one.
      setToken('');
      if (widgetId.current != null) window.turnstile?.reset(widgetId.current);
    }
  }

  if (sentTo) return <div className="check-email" role="status">
    <span className="check-email-icon"><Icon name="mail" size={34} /></span>
    <h2>Revisa tu correo</h2>
    <p>Te enviamos un enlace de confirmación a <strong>{sentTo}</strong>. Ábrelo para activar tu cuenta y entrar.</p>
    <p className="check-email-hint">Si no lo ves en unos minutos, mira en spam. Si ya tenías una cuenta, inicia sesión con tu contraseña.</p>
  </div>;

  return <form className="auth-form" onSubmit={submit}>
    {error && <p className="auth-message error" role="alert">{error}</p>}
    <div className="list form-group">
      <label className="field"><span>Nombre</span><input name="name" autoComplete="name" maxLength={80} placeholder="Tu nombre" required /></label>
      <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="username" placeholder="correo@ejemplo.com" required /></label>
      <label className="field">
        <span>Contraseña</span>
        <input name="password" type={showPassword ? 'text' : 'password'} minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} required />
        <button type="button" className="reveal-button" aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
      </label>
      <label className="field"><span>Código</span><input name="code" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Código del gimnasio" required /></label>
    </div>
    <div ref={widget} className="turnstile-box" />
    <button className="filled-button" disabled={busy || !token}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
  </form>;
}
