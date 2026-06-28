/**
 * Marketplace (Mini Exchange) sitemap source, registered in nuxt.config
 * `sitemap.sources`. Flag-gated: emits NOTHING until the Exchange is live, so no
 * /exchange/* URLs leak into the sitemap pre-cutover. (The static /exchange/**
 * page routes are excluded from auto-discovery in nuxt.config, so this source is
 * the single place marketplace URLs enter the sitemap.)
 *
 * When live: every active listing, approved find, and approved wanted post.
 * The public section landing pages (/exchange, /exchange/listings, …) are static
 * routes handled by sitemap auto-discovery (gated build-time in nuxt.config's
 * `exclude`); this source only adds the dynamic detail URLs. Private surfaces
 * (messages, watchlist, create/edit forms, onboarding) are excluded there.
 */
import { getServiceClient } from '../../utils/supabase';

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig();
  if (!config.public.exchangeEnabled) return [];

  const service = getServiceClient();

  const [listingsRes, findsRes, wantedRes] = await Promise.all([
    service.from('listings').select('slug, updated_at, created_at').eq('status', 'active').limit(5000),
    service.from('external_listings').select('slug, updated_at, published_at').eq('status', 'approved').limit(5000),
    service
      .from('wanted_posts')
      .select('id, created_at')
      .eq('status', 'active')
      .eq('moderation_status', 'approved')
      .limit(5000),
  ]);

  if (listingsRes.error) console.error('[sitemap] exchange listings query failed:', listingsRes.error.message);
  if (findsRes.error) console.error('[sitemap] exchange finds query failed:', findsRes.error.message);
  if (wantedRes.error) console.error('[sitemap] exchange wanted query failed:', wantedRes.error.message);

  const listingUrls = (listingsRes.data ?? [])
    .filter((l) => l.slug)
    .map((l) => ({
      loc: `/exchange/listings/${l.slug}`,
      lastmod: l.updated_at || l.created_at,
      changefreq: 'weekly' as const,
      priority: 0.8,
    }));

  const findUrls = (findsRes.data ?? [])
    .filter((f) => f.slug)
    .map((f) => ({
      loc: `/exchange/finds/${f.slug}`,
      lastmod: f.updated_at || f.published_at,
      changefreq: 'weekly' as const,
      priority: 0.7,
    }));

  const wantedUrls = (wantedRes.data ?? [])
    .filter((w) => w.id)
    .map((w) => ({
      loc: `/exchange/wanted/${w.id}`,
      lastmod: w.created_at,
      changefreq: 'weekly' as const,
      priority: 0.6,
    }));

  return [...listingUrls, ...findUrls, ...wantedUrls];
});
