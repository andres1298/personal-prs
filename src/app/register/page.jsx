import Link from 'next/link';
import { AuthShell } from '../auth-panel';
import RegisterForm from './register-form';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  return <AuthShell title="Crear cuenta" subtitle="Regístrate con tu correo para guardar tus PRs.">
    <RegisterForm siteKey={siteKey} />
    <Link className="plain-button wide" href="/">Ya tengo cuenta</Link>
  </AuthShell>;
}
