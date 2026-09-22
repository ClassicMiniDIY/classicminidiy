/**
 * Dynamic sitemap source for the Model Variants detail pages (registered in
 * nuxt.config `sitemap.sources`). `/archive/variants/[slug]` is SSR, so the
 * sitemap module cannot discover the slugs on its own. Approved rows only,
 * through the same read path as the pages.
 */
import { loadModelVariants } from '../../utils/modelVariants';

export default defineSitemapEventHandler(async () => {
  try {
    return (await loadModelVariants()).map((v) => ({
      loc: `/archive/variants/${v.slug}`,
      lastmod: v.updated_at,
      changefreq: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error('[sitemap] model_variants query failed:', err);
    return [];
  }
});
