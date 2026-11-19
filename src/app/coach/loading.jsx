import { CoachSkeleton } from '../../components/ui/screen-skeleton';
import './coach.css';

// Shown right away while the server checks the coach's session.
export default function Loading() {
  return <CoachSkeleton />;
}
