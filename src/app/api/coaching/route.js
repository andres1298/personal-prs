import { route } from '../../../lib/server/api';
import { acceptJoin, CoachingError, endLink, getCoaching } from '../../../lib/server/coaching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// body: { code }: a group's join code or the token of a personal link.
export const POST = route({ body: 500 }, ({ userId, input }) => acceptJoin(userId, input.code));

// The athlete leaves their coach's plan.
export const DELETE = route({}, async ({ userId }) => {
  const coach = await getCoaching(userId);
  if (!coach) throw new CoachingError('not_found');
  await endLink(userId, { coachId: coach.id, athleteId: userId });
});
