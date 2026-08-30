/**
 * POST /api/exchange/notifications/watchlist-sold
 *
 * Tells everyone watching a listing that it sold. Called fire-and-forget by
 * `app/pages/dashboard/listings.vue` after the seller confirms the sale and
 * ticks "notify watchers".
 *
 * This route did not exist from the TME cutover until now: the client called
 * it, the call 404'd into `server/api/[...].ts`, and the caller swallowed the
 * failure in a `.catch(console.error)` while the success toast told the seller
 * their watchers had been notified. Nobody was.
 *
 * Body: { listingId, finalPrice? }
 */
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { queueNotification, buildBatchKey } from '../../../utils/exchange/notificationQueue';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserClient(event);

  const body = await readBody<{ listingId?: string; finalPrice?: number }>(event);
  const listingId = typeof body?.listingId === 'string' ? body.listingId : '';
  if (!listingId) {
    throw createError({ statusCode: 400, message: 'Missing required field: listingId' });
  }

  const service = getServiceClient();

  // Ownership is the authorization boundary here: only the seller may announce
  // their own sale, or anyone could spam every watcher on any listing.
  const { data: listing, error: listingError } = await service
    .from('listings')
    .select('id, user_id, title, slug, price')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw createError({ statusCode: 404, message: 'Listing not found' });
  }
  if (listing.user_id !== user.id) {
    throw createError({ statusCode: 403, message: 'Not your listing' });
  }

  const { data: watchers, error: watchersError } = await service
    .from('watchlist')
    .select('user_id')
    .eq('listing_id', listingId);

  if (watchersError) {
    // The sale itself already succeeded — never fail the caller over the
    // notification fan-out.
    console.error('[WatchlistSold] Failed to read watchers:', watchersError);
    return { success: true, notified: 0 };
  }

  // The seller is excluded even if they watch their own listing.
  const recipients = [...new Set((watchers ?? []).map((w) => w.user_id))].filter((id) => id !== user.id);

  const finalPrice = typeof body?.finalPrice === 'number' && Number.isFinite(body.finalPrice) ? body.finalPrice : null;

  await Promise.all(
    recipients.map((userId) =>
      queueNotification({
        userId,
        eventType: 'watchlist_sold',
        payload: { listingId, title: listing.title, slug: listing.slug, finalPrice },
        channel: 'both',
        // One key per listing, so a seller who fires this twice does not send
        // two emails for the same sale.
        batchKey: buildBatchKey('watchlist_sold', { listingId }),
      })
    )
  );

  return { success: true, notified: recipients.length };
});
