import { route } from '../../../../lib/server/api';
import { createInvite } from '../../../../lib/server/coaching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The token is returned once, to build the link; only its hash is stored.
export const POST = route({ coach: true, body: 500, status: 201 }, ({ userId, input }) => createInvite(userId, input));
