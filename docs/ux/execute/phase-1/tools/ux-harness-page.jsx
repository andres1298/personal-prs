import App from '../prs-app';

// Local-only UX capture harness (never committed): renders the signed-in app; the browser fixture answers /api/*.
export default function Harness() {
  return <App hasBackend userId="00000000-0000-4000-8000-000000000001" />;
}
