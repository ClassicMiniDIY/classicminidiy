/**
 * Dynamic sitemap source for the paint-colour archive detail pages
 * (registered in nuxt.config `sitemap.sources`). @nuxtjs/sitemap only
 * auto-discovers static/prerendered routes, so the SSR `/archive/colors/[id]`
 * pages would be missing without this.
 *
 * Lists every APPROVED colour by its `id` (the value the detail route + share
 * URLs use) with `updated_at` as lastmod. Service role, pinned to
 * `status = 'approved'` so pending/rejected submissions never leak.
 */
import { getServiceClient } from '../../utils/supabase';

export default defineSitemapEventHandler(async () => {
  const service = getServiceClient();
  const { data, error } = await service
    .from('colors')
    .select('id, updated_at')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('[sitemap] colors query failed:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      loc: `/archive/colors/${c.id}`,
      lastmod: c.updated_at,
      changefreq: 'monthly' as const,
      priority: 0.6,
    }));
});
