import { route } from '../../../../../lib/server/api';
import { addAthleteComment } from '../../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route({ body: 5000, status: 201 }, async ({ userId, input, params }) => ({
  comment: await addAthleteComment(userId, params.id, input.body),
}));
