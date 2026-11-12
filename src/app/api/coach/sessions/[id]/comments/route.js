import { route } from '../../../../../../lib/server/api';
import { addCoachComment } from '../../../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// body: { athleteId, body }
export const POST = route({ coach: true, body: 5000, status: 201 }, async ({ userId, input, params }) => ({
  comment: await addCoachComment(userId, params.id, input.athleteId, input.body),
}));
