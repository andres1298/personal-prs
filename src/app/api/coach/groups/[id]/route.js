import { route } from '../../../../../lib/server/api';
import { archiveGroup, updateGroup } from '../../../../../lib/server/coaching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// body: { name?, memberIds?, newCode? }
export const PATCH = route({ coach: true, body: 50000 }, async ({ userId, input, params }) => ({ group: await updateGroup(userId, params.id, input) }));
export const DELETE = route({ coach: true }, async ({ userId, params }) => { await archiveGroup(userId, params.id); });
