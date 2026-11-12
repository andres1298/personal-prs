import { CoachingError } from '../../../lib/server/coaching';
import { route } from '../../../lib/server/api';
import { ProfileInputError, setDivision } from '../../../lib/server/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// body: { division: 'MEN' | 'WOMEN' }
export const PUT = route({ body: 200 }, async ({ userId, input }) => {
  try { return { division: await setDivision(userId, input.division) }; }
  catch (error) { throw error instanceof ProfileInputError ? new CoachingError('invalid_input') : error; }
});
