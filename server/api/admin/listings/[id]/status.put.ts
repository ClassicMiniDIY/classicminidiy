/**
 * PUT /api/admin/listings/:id/status  (admin listing moderation)
 *
 * This route did not exist. `useAdmin().updateListingStatus()` and
 * `relistListing()` have been calling it since the TME consolidation, which
 * means the approve/reject buttons on /admin/exchange/moderation and
 * /admin/exchange/listings have been 404ing — the admin UI was ported over
 * without its two backing routes (this one and ./tier.put.ts).
 *
 * Together with paid listings never reaching `pending` at all (see
 * promoteListingToPending in classicminidiy-supabase), that left the paid
 * pipeline dead end to end: nothing arrived in the queue, and nothing could be
 * approved out of it.
 *
 *   body: { status: listing_status_enum, relist?: boolean, rejectionReason?: string }
 *   returns: { success: true, status }
 *
 * Service-role, so it also passes the enforce_listing_status_transition trigger
 * that blocks OWNERS from self-publishing past review (migration
 * 20260812000001). Moderation is the only path to `active`, and it lives here.
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';
import { relistUpdates } from '../../../../../shared/utils/listingPromotion';

/** Statuses an admin may set. Mirrors the options the admin listings UI actually
 *  offers, including its "Set Example (Free/Paid)" actions — `example_*` rows are
 *  the curated demo listings surfaced by `useExampleListings`, and this route is
 *  the only server path that can set them (the enforce_listing_status_transition
 *  trigger refuses them for non-service-role callers).
 *
 *  `draft` is deliberately absent: it is the seller's pre-submission state, not a
 *  moderation verdict, and pushing a listing back to draft would drop it out of
 *  the queue with no way back in. */
const ALLOWED = ['pending', 'active', 'sold', 'expired', 'cancelled', 'example_free', 'example_paid'] as const;

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);

  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing listing id' });

  const body = await readBody<{ status?: string; relist?: boolean; rejectionReason?: string }>(event);
  const status = body?.status;
  if (!status || !(ALLOWED as readonly string[]).includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `status must be one of: ${ALLOWED.join(', ')}`,
    });
  }
  // A relist always puts the listing back live; `relistUpdates()` sets `active`.
  if (body?.relist && status !== 'active') {
    throw createError({ statusCode: 400, statusMessage: "relist requires status 'active'" });
  }

  const db = getServiceClient();
  const { data: listing, error: loadErr } = await db
    .from('listings')
    .select('id, user_id, title, slug, status, tier')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });

  if (listing.status === status && !body?.relist) {
    return { success: true, status, unchanged: true };
  }

  const updates: Record<string, unknown> = { status };

  // Going live by approval republishes, so published_at is stamped.
  if (status === 'active') {
    updates.published_at = new Date().toISOString();
  }

  // Relist: the same column set as the seller's own relist
  // (`POST /api/exchange/listings/:id/relist`), from the same helper, so
  // "relist" means the same thing whoever clicks it. It stamps published_at
  // (a relisted listing sorts as newly published) and clears the sale trail.
  // It writes no featured or social column: featured has no window to renew,
  // and a relist never re-queues a social post.
  if (body?.relist) {
    Object.assign(updates, relistUpdates());
  }

  const { error: upErr } = await db.from('listings').update(updates).eq('id', id);
  if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message });

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: body?.relist ? 'listing_relisted' : `listing_${status}`,
    target_type: 'listing',
    target_id: id,
    details: {
      from: listing.status,
      to: status,
      title: listing.title,
      ...(body?.rejectionReason ? { rejectionReason: body.rejectionReason } : {}),
    },
  });

  // Tell the seller. The submission confirmation promises "we'll email you when
  // your listing is approved" and nothing was keeping that promise — the
  // pending->active trigger only moves trust counters. Not batched: the builder
  // reads items[0] only, so the batch key is per listing.
  const notifyOn = ['active', 'cancelled', 'expired'];
  if (listing.user_id && notifyOn.includes(status)) {
    const { error: qErr } = await db.from('notification_queue').insert({
      user_id: listing.user_id,
      event_type: 'listing_status',
      payload: {
        listingTitle: listing.title,
        listingSlug: listing.slug,
        status,
        ...(body?.rejectionReason ? { rejectionReason: body.rejectionReason } : {}),
      },
      channel: 'email',
      batch_key: `status:${id}`,
    });
    // Fire-and-forget: the moderation decision has already committed.
    if (qErr) console.error('[admin/listings/status] failed to queue seller notification:', qErr);
  }

  return { success: true, status };
});
