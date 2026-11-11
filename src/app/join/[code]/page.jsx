import Link from 'next/link';
import { AuthShell } from '../../auth-panel';
import { getAccess } from '../../../lib/server/auth';
import { describeJoin, getCoaching } from '../../../lib/server/coaching';
import JoinPanel from './join-panel';

export const dynamic = 'force-dynamic';
// The code is a credential; keep its path out of cross-origin Referer headers.
export const metadata = { title: 'Invitación de tu coach', referrer: 'same-origin', robots: { index: false, follow: false } };

export default async function JoinPage({ params }) {
  const { code } = await params;
  const target = await describeJoin(code);
  if (!target) {
    return <AuthShell title="Mis PRs">
      <p className="auth-message" role="status">Este link o código ya no es válido. Pide uno nuevo a tu coach.</p>
      <Link className="plain-button wide" href="/app">Ir al inicio</Link>
    </AuthShell>;
  }
  const { user, authorized } = await getAccess();
  const current = authorized ? await getCoaching(user.id) : null;
  const subtitle = `${target.coachName} te invita a seguir su plan de entrenamiento${target.groupName ? ` en el grupo ${target.groupName}` : ''}.`;
  return <AuthShell title="Invitación" subtitle={subtitle}>
    <JoinPanel code={code} signedIn={authorized} own={authorized && target.coachId === user.id}
      otherCoach={current && current.id !== target.coachId ? current.name : null} coachName={target.coachName} />
  </AuthShell>;
}
