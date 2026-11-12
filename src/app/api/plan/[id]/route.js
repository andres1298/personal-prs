import { route } from '../../../../lib/server/api';
import { saveLog } from '../../../../lib/server/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// body: { results?, completed?, seen? }
export const PUT = route({ body: 50000 }, async ({ userId, input, params }) => ({ log: await saveLog(userId, params.id, input) }));
