/**
 * POST /api/exchange/notifications/price-drop
 *
 * Tells everyone watching a listing that its price fell. Called
 * fire-and-forget by `app/pages/exchange/listings/[slug]/edit.vue` when a save
 * lowers the price.
 *
 * Like its watchlist-sold sibling, this route was called but never written —
 * the request 404'd and the caller swallowed it, so price-drop notifications
 * have never fired.
 *
 * Body: { listingId, previousPrice, newPrice }
 */
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { queueNotification, buildBatchKey } from '../../../utils/exchange/notificationQueue';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserClient(event);

  const body = await readBody<{ listingId?: string; previousPrice?: number; newPrice?: number }>(event);
  const listingId = typeof body?.listingId === 'string' ? body.listingId : '';
  if (!listingId) {
    throw createError({ statusCode: 400, message: 'Missing required field: listingId' });
  }

  const previousPrice = Number(body?.previousPrice);
  const newPrice = Number(body?.newPrice);
  if (!Number.isFinite(previousPrice) || !Number.isFinite(newPrice)) {
    throw createError({ statusCode: 400, message: 'previousPrice and newPrice must be numbers' });
  }
  // A "price drop" that is not a drop is a bug in the caller, not a
  // notification. Refusing it here stops a rounding slip or a re-save from
  // emailing every watcher that the price went up.
  if (newPrice >= previousPrice) {
    throw createError({ statusCode: 400, message: 'newPrice must be lower than previousPrice' });
  }

  const service = getServiceClient();

  const { data: listing, error: listingError } = await service
    .from('listings')
    .select('id, user_id, title, slug')
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
    console.error('[PriceDrop] Failed to read watchers:', watchersError);
    return { success: true, notified: 0 };
  }

  const recipients = [...new Set((watchers ?? []).map((w) => w.user_id))].filter((id) => id !== user.id);

  await Promise.all(
    recipients.map((userId) =>
      queueNotification({
        userId,
        eventType: 'price_drop',
        payload: { listingId, title: listing.title, slug: listing.slug, previousPrice, newPrice },
        channel: 'both',
        // Keyed per listing: a seller nudging the price down repeatedly in one
        // digest window collapses into a single notification rather than one
        // per edit.
        batchKey: buildBatchKey('price_drop', { listingId }),
      })
    )
  );

  return { success: true, notified: recipients.length };
});
