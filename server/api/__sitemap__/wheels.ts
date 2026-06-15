/**
 * Dynamic sitemap source for the wheel-fitment archive detail pages
 * (registered in nuxt.config `sitemap.sources`). The SSR `/archive/wheels/[id]`
 * pages aren't auto-discovered by @nuxtjs/sitemap.
 *
 * The detail route + share URLs use the wheel's `id` (surfaced in the UI as
 * `uuid` — see useWheels.ts `mapToWheel`). Lists every APPROVED wheel with
 * `updated_at` as lastmod. Service role, pinned to `status = 'approved'`.
 */
import { getServiceClient } from '../../utils/supabase';

export default defineSitemapEventHandler(async () => {
  const service = getServiceClient();
  const { data, error } = await service
    .from('wheels')
    .select('id, updated_at')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('[sitemap] wheels query failed:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((w) => w.id)
    .map((w) => ({
      loc: `/archive/wheels/${w.id}`,
      lastmod: w.updated_at,
      changefreq: 'monthly' as const,
      priority: 0.6,
    }));
});
