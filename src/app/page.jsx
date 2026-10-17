import App from './prs-app';
import AuthPanel from './auth-panel';
import { getAccess, hasAuthConfiguration } from '../lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const { demo, authError } = await searchParams;
  if (demo === '1') return <App hasBackend={false} />;
  const configured = hasAuthConfiguration();
  const { user, authorized } = await getAccess();
  if (!authorized) return <AuthPanel configured={configured} signedIn={Boolean(user)} authError={Boolean(authError)} />;
  return <App hasBackend={true} userId={user.id} />;
}
