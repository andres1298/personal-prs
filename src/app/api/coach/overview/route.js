import { route } from '../../../../lib/server/api';
import { getOverview } from '../../../../lib/server/coaching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route({ coach: true }, ({ userId }) => getOverview(userId));
