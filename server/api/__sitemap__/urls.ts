/**
 * Dynamic sitemap source for the 3D Model Library (registered in nuxt.config
 * `sitemap.sources`). @nuxtjs/sitemap only auto-discovers static/prerendered
 * routes, so the SSR `/models/[slug]` listings would be missing without this.
 *
 * Lists every PUBLISHED model with its `updated_at` as lastmod. Service role,
 * but pinned to `status = 'published'` so drafts/flagged/removed never leak.
 */
import { getServiceClient } from '../../utils/supabase';

export default defineSitemapEventHandler(async () => {
  const service = getServiceClient();
  const { data, error } = await service
    .from('models')
    .select('slug, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('[sitemap] model URLs query failed:', error.message);
    return [];
  }

  return (data ?? []).map((m) => ({
    loc: `/models/${m.slug}`,
    lastmod: m.updated_at,
    changefreq: 'weekly' as const,
    priority: 0.7,
  }));
});
