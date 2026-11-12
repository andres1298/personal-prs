import { route } from '../../../../lib/server/api';
import { listActivity } from '../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route({ coach: true }, async ({ userId }) => ({ events: await listActivity(userId) }));
