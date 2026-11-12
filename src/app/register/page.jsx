import Link from 'next/link';
import { AuthShell } from '../auth-panel';
import RegisterForm from './register-form';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Crear cuenta',
  description: 'Crea tu cuenta gratis en Mis PRs para guardar tus marcas personales de CrossFit y calcular los discos de cada serie.',
  alternates: { canonical: '/register' },
};

export default function RegisterPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  return <AuthShell title="Crear cuenta" subtitle="Guarda tus PRs y sigue el plan de tu coach." tone="--b-green">
    <RegisterForm siteKey={siteKey} />
    <div className="auth-links"><Link className="auth-link" href="/app"><b>Ya tengo cuenta</b><small>Entrar con mi correo</small></Link></div>
  </AuthShell>;
}
