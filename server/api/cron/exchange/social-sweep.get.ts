/**
 * GET /api/cron/exchange/social-sweep  (Vercel Cron)
 *
 * Auto-posts paid + active listings that haven't been promoted on social media
 * yet (promoted_on_social = false) to Facebook / Instagram / Bluesky.
 *
 * Replaces TME's per-payment fire-and-forget triggerSocialMediaPost (which the
 * consolidation dropped): a sweep is resilient to a missed payment hook and
 * doesn't tie posting latency to the checkout request. postListingToSocialMedia
 * does an atomic promoted_on_social claim, so overlapping sweeps never double-post
 * and failures revert the flag (the listing reappears next sweep / in the admin
 * promotions retry queue).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Fails closed —
 * if cronSecret is unset or the header doesn't match, 401.
 */
import { postListingToSocialMedia, type ListingForSocialPost } from '../../../utils/exchange/socialMedia';
import { getServiceClient } from '../../../utils/supabase';

// Cap per run so one sweep can't fan out unbounded Meta/Bluesky calls; the next
// run picks up the remainder.
const MAX_PER_SWEEP = 10;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const auth = getHeader(event, 'authorization');
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  // Nothing to post until the marketplace is live — avoids empty sweeps in prod
  // while the exchange is still flag-gated off.
  if (!config.public.exchangeEnabled) {
    return { swept: 0, processed: 0, skipped: 'exchange disabled' };
  }

  const supabase = getServiceClient();

  const { data: listings, error } = await supabase
    .from('listings')
    .select('*, listing_photos(*)')
    .eq('tier', 'paid')
    .eq('status', 'active')
    .eq('promoted_on_social', false)
    .order('promoted_on_social_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_SWEEP);

  if (error) {
    console.error('[social-sweep] failed to query candidate listings:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load listings' });
  }

  const candidates = listings || [];
  let posted = 0;
  for (const listing of candidates) {
    try {
      // Idempotent: claims the listing atomically, posts, stores IDs, reverts on failure.
      await postListingToSocialMedia(listing as unknown as ListingForSocialPost, supabase);
      posted++;
    } catch (e) {
      console.error(`[social-sweep] error posting listing ${(listing as { id?: string }).id}:`, e);
    }
  }

  console.log(`[social-sweep] swept ${candidates.length} candidate(s), processed ${posted}`);
  return { swept: candidates.length, processed: posted };
});
