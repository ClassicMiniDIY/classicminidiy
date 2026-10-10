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
 *   409 `DRAFT` for a draft listing (see below).
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';

const ALLOWED = ['free', 'paid'] as const;
type Tier = (typeof ALLOWED)[number];

function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (ALLOWED as readonly string[]).includes(value);
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);

  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing listing id' });

  const body = await readBody<{ tier?: string }>(event);
  const tier = body?.tier;
  if (!isTier(tier)) {
    throw createError({ statusCode: 400, statusMessage: "tier must be 'free' or 'paid'" });
  }

  const db = getServiceClient();
  const { data: listing, error: loadErr } = await db
    .from('listings')
    .select('id, title, tier, status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });

  // Never on a draft. A premium draft can go to review only through the
  // payment path, which an admin grant does not run (payment_status stays
  // pending), so a granted draft could never be submitted: the seller would
  // have to pay or switch back to free, which throws the grant away. Grant
  // premium once the seller has submitted the listing (pending) or it is live.
  if (listing.status === 'draft') {
    throw createError({
      statusCode: 409,
      statusMessage: 'This listing is still a draft. Grant premium after the seller submits it.',
      data: { code: 'DRAFT' },
    });
  }

  if (listing.tier === tier) return { success: true, tier, unchanged: true };

  // `tier` only. Featured = premium and live (isListingFeatured()), with no end
  // date, so there is no featured end date to move with the tier.
  const { error: upErr } = await db.from('listings').update({ tier }).eq('id', id);
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
