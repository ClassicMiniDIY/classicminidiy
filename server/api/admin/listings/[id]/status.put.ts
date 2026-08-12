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

/** Statuses an admin may set. Mirrors the options the admin listings UI actually
 *  offers, including its "Set Example (Free/Paid)" actions — `example_*` rows are
 *  the curated demo listings surfaced by `useExampleListings`, and this route is
 *  the only server path that can set them (the enforce_listing_status_transition
 *  trigger refuses them for non-service-role callers).
 *
 *  `draft` is deliberately absent: it is the seller's pre-submission state, not a
 *  moderation verdict, and pushing a listing back to draft would drop it out of
 *  the queue with no way back in. */
const ALLOWED = [
  'pending',
  'active',
  'sold',
  'expired',
  'cancelled',
  'example_free',
  'example_paid',
] as const;

/** Mirrors FEATURED_DURATION_DAYS in app/composables/useListings.ts. */
const FEATURED_DURATION_DAYS = 30;

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
    .select('id, user_id, title, slug, status, tier')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });

  if (listing.status === status && !body?.relist) {
    return { success: true, status, unchanged: true };
  }

  const updates: Record<string, unknown> = { status };

  // Going live — whether by approval or by relist — republishes, so published_at
  // is stamped either way. (Relist matching approval here is intentional: a
  // relisted listing should sort as newly published in browse.)
  if (status === 'active') {
    updates.published_at = new Date().toISOString();
  }

  // Relist: reset the sale trail. This MUST stay in sync with
  // `relistListing()` in app/composables/useListings.ts — that is the seller's
  // own relist button, and "relist" has to mean the same thing whoever clicks
  // it. Leaving tracking_* behind resurfaces stale shipping info on the detail
  // page, and leaving promoted_on_social_at set makes the relisted listing look
  // already-promoted to the social worker.
  if (body?.relist) {
    updates.sold_date = null;
    updates.final_price = null;
    updates.tracking_number = null;
    updates.tracking_carrier = null;
    updates.promoted_on_social_at = null;
    updates.featured_until =
      listing.tier === 'paid'
        ? new Date(Date.now() + FEATURED_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;
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
