/**
 * PUT /api/admin/listings/:id  (admin content correction)
 *
 * Lets an admin fix a live listing directly — a wrong price, a nonsense chassis
 * number, a description with someone's phone number in it — WITHOUT sending the
 * listing back through moderation. That is the whole point of the route: a
 * typo correction is not a review event, so nothing here touches review state.
 *
 * There was previously no admin write path for listing CONTENT at all.
 * `useListings().updateListing()` hard-filters `.eq('user_id', user.id)`, and
 * `/exchange/listings/:slug/edit` 403s a non-owner, so the only admin listing
 * writes that existed were ./[id]/status.put.ts and ./[id]/tier.put.ts.
 *
 *   body: { changes: Record<string, unknown> }
 *   returns: { success: true, slug, changed: string[] }
 *
 * Service-role, so it bypasses the owner-scoped RLS on `listings`. That makes
 * ADMIN_EDITABLE_COLUMNS below the security boundary — same role that
 * `EDIT_TARGETS` plays in server/api/admin/queue/approve.post.ts. Read the note
 * on that constant before adding to it.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * Content columns an admin may correct. This mirrors the field set the seller's
 * own edit form exposes (`app/pages/exchange/listings/[slug]/edit.vue`), and it
 * is an ALLOWLIST because `changes` arrives from the browser as free-form JSON.
 *
 * Deliberately absent, and why:
 *   - `status`, `tier` — they have their own routes precisely so those
 *     transitions stay observable and auditable on their own terms. Moderation
 *     is the only path to `active` (see ./[id]/status.put.ts), and a content
 *     correction must not become a back door to it.
 *   - `user_id` — reassigning a listing steals or dumps ownership, and takes
 *     its trust credit with it.
 *   - `payment_status`, `paid_amount`, `stripe_*` — Stripe's webhook owns those.
 *   - `featured_until`, `promoted_on_social*`, `email_blast_sent` — worker
 *     bookkeeping; hand-editing them re-promotes or silently un-promotes.
 *   - `id`, `slug`, `created_at`, `published_at` — identity and timeline.
 *     (`slug` IS rewritten here, but only as a derived consequence of a title
 *     change, never from client input.)
 */
const ADMIN_EDITABLE_COLUMNS = new Set([
  // Core
  'title',
  'description',
  'price',
  'condition',
  'listing_type',
  // Vehicle / engine
  'year',
  'manufacturer',
  'model',
  'mileage',
  'engine_size',
  'color',
  // Heritage and provenance
  'vin_number',
  'chassis_number',
  'build_date',
  'original_color',
  'previous_owners_count',
  'restoration_status',
  'last_restoration_date',
  'has_heritage_cert',
  'matching_numbers',
  'has_service_history',
  'heritage_cert_number',
  'heritage_cert_details',
  'restoration_details',
  // Detailed specifications
  'engine_number',
  'gearbox_type',
  'carb_type',
  'exhaust_type',
  'brake_type',
  'roof_color',
  'has_stripes',
  'stripe_color',
  'wheel_size',
  'wheel_type',
  'bumper_type',
  'window_type',
  'has_sunroof',
  'seat_type',
  'interior_color',
  'dashboard_type',
  'steering_wheel_type',
  // Modifications and condition
  'factory_options',
  'engine_mods',
  'suspension_mods',
  'performance_upgrades',
  'other_modifications',
  'rust_condition',
  'underside_condition',
  // Parts
  'part_number',
  'part_condition',
  'quantity_available',
  'oem_or_aftermarket',
  'fits_models',
  'shipping_available',
  'shipping_cost',
  // Location
  'location',
  'city',
  'state_province',
  'country',
  'postal_code',
  'latitude',
  'longitude',
  'formatted_address',
]);

/** Mirrors generateSlug() in app/composables/useListings.ts. A renamed listing
 *  gets a new URL whoever renames it — keeping the old slug on an admin rename
 *  would make the two paths disagree about what a title change means. */
function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  return `${baseSlug}-${crypto.randomUUID().split('-')[0]}`;
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);

  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing listing id' });

  const body = await readBody<{ changes?: Record<string, unknown> }>(event);
  const requested = body?.changes;
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) {
    throw createError({ statusCode: 400, statusMessage: 'changes must be an object' });
  }

  // Reject rather than silently drop. A rejected column is a bug in the caller
  // — an admin who thinks they cleared `status` and got a 200 back would have
  // no way to know the write never happened.
  const rejected = Object.keys(requested).filter((key) => !ADMIN_EDITABLE_COLUMNS.has(key));
  if (rejected.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Not editable via this route: ${rejected.join(', ')}`,
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

  const updates: Record<string, unknown> = { ...requested };

  // An empty title would take the listing's identity and its URL with it.
  if ('title' in updates) {
    const title = typeof updates.title === 'string' ? updates.title.trim() : '';
    if (!title) throw createError({ statusCode: 400, statusMessage: 'title cannot be empty' });
    updates.title = title;
    if (title !== listing.title) updates.slug = generateSlug(title);
  }

  if (!Object.keys(updates).length) {
    return { success: true, slug: listing.slug, changed: [] };
  }

  const { data: updated, error: upErr } = await db
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select('slug')
    .single();
  if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message });

  // The audit log is the entire record of this edit — no email is sent, because
  // an admin correcting a typo is not a moderation event and the seller should
  // not get a "your listing was reviewed" mail for one. Field NAMES only: the
  // values can be free text a seller wrote, and this table is read by admins
  // browsing unrelated actions.
  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'listing_edited',
    target_type: 'listing',
    target_id: id,
    details: {
      title: listing.title,
      status: listing.status,
      owner_id: listing.user_id,
      self_edit: listing.user_id === user.id,
      fields: Object.keys(updates),
    },
  });

  return { success: true, slug: updated?.slug || listing.slug, changed: Object.keys(updates) };
});
