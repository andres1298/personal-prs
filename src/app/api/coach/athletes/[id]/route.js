import { route } from '../../../../../lib/server/api';
import { assertCoachOf, endLink } from '../../../../../lib/server/coaching';
import { listRecords, toLegacyRecord } from '../../../../../lib/server/records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// An athlete's records, read-only and only while the link is active.
export const GET = route({ coach: true }, async ({ userId, params }) => {
  await assertCoachOf(userId, params.id);
  return { records: (await listRecords(params.id)).map(toLegacyRecord) };
});

export const DELETE = route({ coach: true }, async ({ userId, params }) => { await endLink(userId, { coachId: userId, athleteId: params.id }); });
