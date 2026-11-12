import { route } from '../../../../lib/server/api';
import { createGroup } from '../../../../lib/server/coaching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route({ coach: true, body: 500, status: 201 }, async ({ userId, input }) => ({ group: await createGroup(userId, input) }));
