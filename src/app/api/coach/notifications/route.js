import { route } from '../../../../lib/server/api';
import { listCoachNotifications, markCoachThreadsSeen } from '../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route({ coach: true }, async ({ userId }) => ({ notifications: await listCoachNotifications(userId) }));

// body: { sessionId, athleteId? }; without an athlete, every thread of the session is read.
export const PUT = route({ coach: true, body: 500 }, async ({ userId, input }) => ({
  seen: await markCoachThreadsSeen(userId, input.sessionId, input.athleteId == null ? undefined : [input.athleteId]),
}));
