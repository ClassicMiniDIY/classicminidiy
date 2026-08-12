/**
 * PUT /api/admin/listings/:id/tier  (admin listing tier override)
 *
 * The second of the two admin listing routes that were never ported during the
 * TME consolidation — `useAdmin().updateListingTier()` has been 404ing against
 * it. See ./status.put.ts for the fuller story.
 *
 * Lets an admin grant or revoke the premium tier by hand (comping a seller,
 * correcting a botched payment) WITHOUT touching Stripe. It deliberately does
 * not write `listing_promotions`: that table is the payment ledger, and an
 * admin override is not a payment. `payment_status` is likewise left alone so a
 * genuinely-paid listing keeps its record.
 *
 *   body: { tier: 'free' | 'paid' }
 *   returns: { success: true, tier }
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';

const ALLOWED = ['free', 'paid'] as const;
/** Mirrors FEATURED_DAYS in the edge function's _shared/listings.ts. */
const FEATURED_DAYS = 30;

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);

  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing listing id' });

  const body = await readBody<{ tier?: string }>(event);
  const tier = body?.tier;
  if (!tier || !(ALLOWED as readonly string[]).includes(tier)) {
    throw createError({ statusCode: 400, statusMessage: "tier must be 'free' or 'paid'" });
  }

  const db = getServiceClient();
  const { data: listing, error: loadErr } = await db
    .from('listings')
    .select('id, title, tier, featured_until')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });

  if (listing.tier === tier) return { success: true, tier, unchanged: true };

  // featured_until has to move with the tier or the two disagree: a listing
  // downgraded to free while still holding a future featured_until keeps its
  // priority placement and homepage carousel slot for free.
  const updates: Record<string, unknown> = { tier };
  if (tier === 'paid') {
    updates.featured_until = new Date(Date.now() + FEATURED_DAYS * 24 * 60 * 60 * 1000).toISOString();
  } else {
    updates.featured_until = null;
  }

  const { error: upErr } = await db.from('listings').update(updates).eq('id', id);
  if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message });

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: tier === 'paid' ? 'listing_tier_granted' : 'listing_tier_revoked',
    target_type: 'listing',
    target_id: id,
    details: { from: listing.tier, to: tier, title: listing.title },
  });

  return { success: true, tier };
});
