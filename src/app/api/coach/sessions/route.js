import { route } from '../../../../lib/server/api';
import { listCoachSessions, saveSession } from '../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ?group=<id> or ?athlete=<id>, with from and to as YYYY-MM-DD.
export const GET = route({ coach: true }, async ({ userId, query }) => ({
  sessions: await listCoachSessions(userId, { groupId: query.get('group'), athleteId: query.get('athlete') }, query.get('from'), query.get('to')),
}));

// body: { target: { groupId } | { athleteId }, date, title, notes, content, published }
export const PUT = route({ coach: true, body: 200000 }, async ({ userId, input }) => ({ session: await saveSession(userId, input) }));
