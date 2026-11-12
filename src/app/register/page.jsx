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
  return <AuthShell eyebrow="Cuenta nueva" title={'Crea tu\ncuenta.'} subtitle="Guarda tus PRs y sigue el plan de tu coach. Es gratis."
    action={{ href: '/app', label: 'Entrar' }}>
    <RegisterForm siteKey={siteKey} />
  </AuthShell>;
}
