import App from './prs-app';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <App hasBackend={Boolean(process.env.APPS_SCRIPT_URL)} />;
}
