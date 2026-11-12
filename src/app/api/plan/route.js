import { route } from '../../../lib/server/api';
import { getCoaching } from '../../../lib/server/coaching';
import { getDivision } from '../../../lib/server/records';
import { listPlan } from '../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The athlete's coach, their weight division and their sessions between ?from and ?to (YYYY-MM-DD).
export const GET = route({}, async ({ userId, query }) => {
  const [coach, sessions, division] = await Promise.all([getCoaching(userId), listPlan(userId, query.get('from'), query.get('to')), getDivision(userId)]);
  return { coach, sessions, division };
});
