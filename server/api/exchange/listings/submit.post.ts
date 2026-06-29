/**
 * POST /api/exchange/listings/submit
 *
 * Converged from TheMiniExchange's server/api/listings/submit. The listing row
 * itself is created client-side (useListings -> PostgREST insert); this endpoint
 * is the post-create hook that (a) re-verifies ownership server-side and (b)
 * fires the "submitted for review" confirmation + admin-pending notifications.
 *
 *   body: { listingId, listingTitle? }
 *
 * Email convergence: the legacy route called AWS SES directly. Per the
 * consolidation decision, transactional email routes through notification_queue
 * + process-notifications instead. The `listing_submitted` / `admin_listing_pending`
 * event types + their process-notifications builders are NOT registered yet, so
 * the enqueue is a Stage 8 TODO (see classicminidiy-supabase). Until then this
 * route performs the ownership re-check and returns success — the listing is
 * already submitted; only the confirmation email is deferred.
 */
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { queueNotification, queueAdminNotification, buildBatchKey } from '../../../utils/exchange/notificationQueue';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserClient(event);

  const body = await readBody<{ listingId?: string; listingTitle?: string }>(event);
  if (!body?.listingId) {
    throw createError({ statusCode: 400, statusMessage: 'Listing ID is required' });
  }

  // Service-role ownership re-check (the row is already inserted under RLS as the
  // owner; this guards the email/admin-notify step against a forged listingId).
  const db = getServiceClient();
  const { data: listing, error } = await db
    .from('listings')
    .select('id, slug, title, user_id, profiles:user_id ( display_name )')
    .eq('id', body.listingId)
    .maybeSingle();

  if (error) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
  if (listing.user_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can only submit your own listings' });
  }

  // Transactional email via notification_queue + process-notifications (SES):
  // confirm to the seller, and fan a pending-review digest out to admins.
  // Both are fire-and-forget (never throw); awaited so they run before the
  // serverless function freezes after the response.
  const sellerName = (listing as { profiles?: { display_name?: string | null } }).profiles?.display_name || 'a seller';
  await Promise.all([
    queueNotification({
      userId: listing.user_id,
      eventType: 'listing_submitted',
      payload: { listingTitle: listing.title, listingSlug: listing.slug },
      batchKey: buildBatchKey('listing_submitted', { listingId: listing.id }),
    }),
    queueAdminNotification({
      eventType: 'admin_listing_pending',
      payload: { listingTitle: listing.title, sellerName },
    }),
  ]);

  return { success: true, message: 'Listing submitted for review' };
});
