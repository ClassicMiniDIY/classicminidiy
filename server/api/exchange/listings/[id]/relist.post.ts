/**
 * POST /api/exchange/listings/:id/relist  (seller relist)
 *
 * The seller's own "Relist" button on /dashboard/listings. It puts a sold,
 * expired or cancelled listing back live.
 *
 * This runs on the server because a relist writes `published_at`, which a
 * seller session may not write directly; the database refuses it. The admin
 * relist (`PUT /api/admin/listings/:id/status` with `relist: true`) builds the
 * same column set from the same helper, `relistUpdates()`.
 *
 *   body: { price?: number }
 *   returns: { success: true, listing }
 *
 * - 403 when the caller does not own the listing.
 * - 409 when the listing is not sold, expired or cancelled.
 * - 409 `NOT_APPROVED` when a moderator never approved it: only moderation
 *   makes a listing live for the first time, so a rejected listing cannot come
 *   back this way.
 * - 409 when the status changed between the read and the write.
 *
 * No admin audit row: this is a seller action.
 */
import { requireUserClient } from '../../../../utils/userAuth';
import { getServiceClient } from '../../../../utils/supabase';
import { relistUpdates } from '../../../../../shared/utils/listingPromotion';

/** The statuses a seller may relist from. */
const RELISTABLE = ['sold', 'expired', 'cancelled'] as const;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserClient(event);

  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing listing id' });

  const body = await readBody<{ price?: unknown }>(event);
  const price = body?.price;
  if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'price must be a number of 0 or more' });
  }

  const db = getServiceClient();
  const { data: listing, error: loadErr } = await db
    .from('listings')
    .select('id, user_id, status, tier, approved_at, price')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
  if (listing.user_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can only relist your own listings' });
  }
  if (!(RELISTABLE as readonly string[]).includes(listing.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only a sold, expired or cancelled listing can be relisted',
      data: { code: 'NOT_RELISTABLE', status: listing.status },
    });
  }
  if (!listing.approved_at) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This listing was never approved by a moderator, so it cannot be relisted',
      data: { code: 'NOT_APPROVED' },
    });
  }

  // The status filter makes the write conditional on what was read: a second
  // tab that relisted (or an admin who changed the status) in between leaves
  // zero rows to update, and that is a 409, not a silent double write.
  const { data: updated, error: upErr } = await db
    .from('listings')
    .update(relistUpdates({ price: price as number | undefined }))
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', listing.status)
    .select('*')
    .maybeSingle();
  if (upErr) throw createError({ statusCode: 500, statusMessage: 'Failed to relist listing' });
  if (!updated) {
    throw createError({
      statusCode: 409,
      statusMessage: 'The listing changed while it was being relisted. Reload and try again.',
      data: { code: 'CONFLICT' },
    });
  }

  return { success: true, listing: updated };
});
