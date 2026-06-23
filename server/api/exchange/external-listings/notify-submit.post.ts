/**
 * POST /api/exchange/external-listings/notify-submit
 *
 * Post-create hook: the Find row is inserted client-side (useExternalListings,
 * RLS-gated); this re-verifies ownership server-side and (Stage 8) will notify
 * admins of a pending Find. Converged from TME: auth verifyBearerToken →
 * requireUserClient. Consumed fire-and-forget by useExternalListings, so a throw
 * here never blocks submission.
 *
 *   body: { findId }
 */
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';

const rateLimitMiddleware = createRateLimitMiddleware({ ...RateLimitPresets.moderate, keyPrefix: 'finds-notify' });

export default defineEventHandler(async (event) => {
  await rateLimitMiddleware(event);

  const { user } = await requireUserClient(event);

  const body = await readBody<{ findId?: string }>(event);
  if (!body?.findId) throw createError({ statusCode: 400, message: 'findId is required' });

  const supabase = getServiceClient();
  const { data: find, error } = await supabase
    .from('external_listings')
    .select('id, submitted_by, title, source_url, source_site')
    .eq('id', body.findId)
    .single();

  if (error || !find) throw createError({ statusCode: 404, message: 'Find not found' });
  if (find.submitted_by !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only notify on your own submission' });
  }

  // TODO(Stage 8): enqueue an admin "new find pending review" notification_queue
  // event — the finds event type + its process-notifications builder aren't
  // defined yet (classicminidiy-supabase). Ownership/validation above stays so
  // wiring the enqueue later is a one-liner against `find`.

  return { success: true };
});
