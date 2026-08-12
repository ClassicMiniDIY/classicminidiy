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

/** Statuses an admin may set from the moderation UI. `draft` is deliberately
 *  absent — it is the seller's pre-submission state, not a moderation verdict,
 *  and pushing a listing back to draft would hide it from the queue entirely.
 *  `example_*` rows are curated fixtures, seeded rather than moderated. */
const ALLOWED = ['pending', 'active', 'sold', 'expired', 'cancelled'] as const;

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

  const db = getServiceClient();
  const { data: listing, error: loadErr } = await db
    .from('listings')
    .select('id, user_id, title, slug, status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });

  if (listing.status === status && !body?.relist) {
    return { success: true, status, unchanged: true };
  }

  const updates: Record<string, unknown> = { status };

  // Going live for the first time stamps published_at; it is otherwise left
  // alone so a relist keeps its original publication date.
  if (status === 'active' && !body?.relist) {
    updates.published_at = new Date().toISOString();
  }

  // Relist: clear the sale metadata so the listing doesn't render as sold.
  if (body?.relist) {
    updates.sold_date = null;
    updates.final_price = null;
    updates.published_at = new Date().toISOString();
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
