'use client';

import { useState } from 'react';
import Icon from './icon';

/** A password row for grouped forms, with an eye at the end that shows or hides what was typed. */
export default function PasswordField({ label = 'Contraseña', ...input }) {
  const [shown, setShown] = useState(false);
  return <label className="field">
    <span>{label}</span>
    <input name="password" {...input} type={shown ? 'text' : 'password'} required />
    <button type="button" className="reveal-button" aria-pressed={shown} aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      onClick={() => setShown(!shown)}><Icon name={shown ? 'eyeOff' : 'eye'} /></button>
  </label>;
}
