import { ShellSkeleton } from '../components/ui/screen-skeleton';

// Shown right away while the server checks the session: the skeleton of the screen this device
// opened on last (plan, Execute or the coach's calendar), not a spinner.
export default function Loading() {
  return <ShellSkeleton />;
}
