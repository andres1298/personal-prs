import { route } from '../../../../../lib/server/api';
import { revokeInvite } from '../../../../../lib/server/coaching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = route({ coach: true }, async ({ userId, params }) => { await revokeInvite(userId, params.id); });
