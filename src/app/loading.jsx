import { AppSkeleton } from '../components/ui/screen-skeleton';

// Shown right away while the server checks the session: the app's shape, not a spinner.
export default function Loading() {
  return <AppSkeleton />;
}
