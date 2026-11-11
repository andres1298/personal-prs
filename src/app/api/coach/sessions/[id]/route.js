import { route } from '../../../../../lib/server/api';
import { deleteSession, getSessionDetail } from '../../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route({ coach: true }, async ({ userId, params }) => ({ session: await getSessionDetail(userId, params.id) }));
export const DELETE = route({ coach: true }, async ({ userId, params }) => { await deleteSession(userId, params.id); });
