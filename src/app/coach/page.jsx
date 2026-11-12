import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '../auth-panel';
import { getAccess } from '../../lib/server/auth';
import { isCoach } from '../../lib/server/coaching';
import CoachApp from '../../components/coach/coach-app';
import './coach.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modo coach', robots: { index: false, follow: false } };

export default async function CoachPage() {
  const { user, authorized } = await getAccess();
  if (!authorized) redirect('/app');
  if (!(await isCoach(user.id))) {
    return <AuthShell tone="--b-blue" title="Modo coach">
      <p className="auth-message" role="status">Tu cuenta todavía no tiene el rol de coach. Pídeselo al administrador.</p>
      <Link className="plain-button wide" href="/app">Volver a la app</Link>
    </AuthShell>;
  }
  return <CoachApp userId={user.id} />;
}
