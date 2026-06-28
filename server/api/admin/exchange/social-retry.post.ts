/**
 * POST /api/admin/exchange/social-retry
 *
 * Admin endpoint to retry social-media posting for a specific listing, for only
 * the failed platform(s) — Facebook, Instagram, and/or Bluesky. Consumed by the
 * promotions admin page (app/pages/admin/exchange/promotions.vue).
 *
 * Converged from TME's server/api/admin/social-retry: auth rewired from the
 * hand-rolled token + is_admin check to CMDIY's requireAdminAuth, and the social
 * utils now live under server/utils/exchange/.
 *
 *   body: { listingId: string, platforms: ('facebook'|'instagram'|'bluesky')[] }
 */
import {
  postToFacebook,
  postToInstagram,
  postToBluesky,
  getPhotoPublicUrl,
  type ListingForSocialPost,
  type SocialPostResult,
} from '../../../utils/exchange/socialMedia';
import { prepareImageForInstagram, cleanupTempImages } from '../../../utils/exchange/imageProcessor';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  // Throws 401 (not signed in) / 403 (not admin) — replaces TME's manual
  // token-verify + profiles.is_admin lookup.
  await requireAdminAuth(event);
  const supabase = getServiceClient();

  const body = await readBody(event);
  const { listingId, platforms } = body as {
    listingId: string;
    platforms: ('facebook' | 'instagram' | 'bluesky')[];
  };

  if (!listingId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing listingId' });
  }
  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid platforms array' });
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select(
      `
      id, title, description, slug, price, currency, year, model, location,
      listing_category, condition, tier,
      listing_photos ( storage_path, display_order, is_primary, category )
    `
    )
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
  }

  // Sort photos: primary first, then by display_order
  const photos = (listing.listing_photos as any[]) || [];
  const sortedPhotos = [...photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.display_order - b.display_order;
  });
  const photoUrls = sortedPhotos.slice(0, 5).map((p) => getPhotoPublicUrl(p.storage_path));

  console.log(`[Social Retry] Listing ${listingId} - ${listing.title}; photos: ${photoUrls.length}`);

  const results: {
    facebook?: SocialPostResult;
    instagram?: SocialPostResult;
    bluesky?: SocialPostResult;
  } = {};

  if (platforms.includes('facebook')) {
    results.facebook = await postToFacebook(listing as ListingForSocialPost, photoUrls);
  }

  if (platforms.includes('instagram')) {
    // Auto-crop images to a valid Instagram aspect ratio first.
    const instagramPhotoUrls: string[] = [];
    let anyImagesCropped = false;
    for (let i = 0; i < photoUrls.length; i++) {
      const { url, wasCropped } = await prepareImageForInstagram(photoUrls[i], listingId, i, supabase);
      instagramPhotoUrls.push(url);
      if (wasCropped) anyImagesCropped = true;
    }
    results.instagram = await postToInstagram(listing as ListingForSocialPost, instagramPhotoUrls);
    if (anyImagesCropped) {
      cleanupTempImages(listingId, supabase).catch((err) => {
        console.warn('[Social Retry] Failed to cleanup temp images:', err);
      });
    }
  }

  if (platforms.includes('bluesky')) {
    results.bluesky = await postToBluesky(listing as ListingForSocialPost, photoUrls);
  }

  // Merge successful post IDs into the listing's promotion record.
  const { data: promo } = await supabase
    .from('listing_promotions')
    .select('id, features')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const socialFeatures: Record<string, unknown> = {};
  if (results.facebook?.success && results.facebook.postId) {
    socialFeatures.facebook_post_id = results.facebook.postId;
    socialFeatures.facebook_retry_at = new Date().toISOString();
  }
  if (results.instagram?.success && results.instagram.postId) {
    socialFeatures.instagram_post_id = results.instagram.postId;
    socialFeatures.instagram_retry_at = new Date().toISOString();
  }
  if (results.bluesky?.success && results.bluesky.postId) {
    socialFeatures.bluesky_post_id = results.bluesky.postId;
    socialFeatures.bluesky_retry_at = new Date().toISOString();
  }

  if (Object.keys(socialFeatures).length > 0) {
    if (promo) {
      const updatedFeatures = { ...((promo.features as Record<string, unknown>) || {}), ...socialFeatures };
      await supabase.from('listing_promotions').update({ features: updatedFeatures }).eq('id', promo.id);
    } else {
      // Free listings have no promotion row yet — create one to hold the post IDs.
      socialFeatures.social_posted_at = new Date().toISOString();
      await supabase.from('listing_promotions').insert({
        listing_id: listingId,
        tier: listing.tier || 'free',
        amount_paid: 0,
        payment_method: 'admin',
        features: socialFeatures,
      });
    }
  }

  // If every requested platform succeeded, mark the listing promoted.
  const allRequested = platforms.every((p) => results[p]?.success);
  if (allRequested) {
    await supabase
      .from('listings')
      .update({ promoted_on_social: true, promoted_on_social_at: new Date().toISOString() })
      .eq('id', listingId);
  }

  return { success: true, results, allSucceeded: allRequested };
});
