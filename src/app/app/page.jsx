import App from '../prs-app';
import AuthPanel from '../auth-panel';
import { getAccess, hasAuthConfiguration } from '../../lib/server/auth';
import { hasPendingTour } from '../../lib/server/records';

export const dynamic = 'force-dynamic';
// Sign-in and private records: reachable from the landing page but kept out of search results.
export const metadata = { title: 'Entrar', robots: { index: false, follow: true } };

export default async function Home({ searchParams }) {
  const { demo, authError } = await searchParams;
  if (demo === '1') return <App hasBackend={false} />;
  const configured = hasAuthConfiguration();
  const { user, authorized, isAdmin } = await getAccess();
  if (!authorized) return <AuthPanel configured={configured} signedIn={Boolean(user)} authError={authError} />;
  // The tour is a convenience: if its state cannot be read, the app still opens without it.
  const tourPending = await hasPendingTour(user.id).catch(() => false);
  return <App hasBackend={true} userId={user.id} isAdmin={isAdmin} tourPending={tourPending} />;
}
