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
import { queueAdminNotification } from '../../../utils/exchange/notificationQueue';

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

  // Notify admins of the pending find (batched digest). Ownership verified above,
  // so submitted_by === user.id; resolve the submitter's display name for the
  // email. Fire-and-forget — never blocks submission.
  const { data: submitter } = await supabase.from('profiles').select('display_name').eq('id', find.submitted_by).maybeSingle();
  await queueAdminNotification({
    eventType: 'admin_find_pending',
    payload: {
      findTitle: find.title,
      sourceSite: find.source_site || 'link',
      submitterName: submitter?.display_name || 'a member',
    },
  });

  return { success: true };
});
