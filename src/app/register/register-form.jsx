'use client';

import { useRef, useState } from 'react';
import Icon from '../../components/ui/icon';
import TurnstileWidget from '../../components/turnstile-widget';

const messages = {
  invalid_name: 'Escribe tu nombre (máximo 80 caracteres).',
  invalid_email: 'Escribe un correo válido.',
  captcha_failed: 'No pudimos verificar que eres una persona. Inténtalo de nuevo.',
  rate_limited: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  unavailable: 'El registro todavía no está disponible.',
};

export default function RegisterForm({ siteKey }) {
  const turnstile = useRef(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

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
      turnstile.current?.reset();
    }
  }

  if (sentTo) return <div className="check-email" role="status">
    <span className="check-email-icon"><Icon name="mail" size={34} /></span>
    <h2>Revisa tu correo</h2>
    <p>Te enviamos un enlace de confirmación a <strong>{sentTo}</strong>. Ábrelo para elegir tu contraseña y activar tu cuenta.</p>
    <p className="check-email-hint">Si no lo ves en unos minutos, mira en spam. Si ya tenías una cuenta, inicia sesión con tu contraseña.</p>
  </div>;

  return <form className="auth-form" onSubmit={submit}>
    {error && <p className="auth-message error" role="alert">{error}</p>}
    <div className="list form-group">
      <label className="field"><span>Nombre</span><input name="name" autoComplete="name" maxLength={80} placeholder="Tu nombre" required /></label>
      <label className="field"><span>Correo</span><input name="email" type="email" autoComplete="email" placeholder="correo@ejemplo.com" required /></label>
    </div>
    <p className="auth-footnote">Elegirás tu contraseña al abrir el enlace que te enviaremos por correo.</p>
    <TurnstileWidget ref={turnstile} siteKey={siteKey} onToken={setToken}
      onLoadError={() => setError('No se pudo cargar la verificación. Recarga la página.')} />
    <button className="filled-button" disabled={busy || !token}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
  </form>;
}
