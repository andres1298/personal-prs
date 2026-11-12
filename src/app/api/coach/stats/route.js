import { route } from '../../../../lib/server/api';
import { getCoachStats } from '../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The coach's athletes, sessions, logs and records between ?from and ?to (YYYY-MM-DD).
export const GET = route({ coach: true }, ({ userId, query }) => getCoachStats(userId, query.get('from'), query.get('to')));
