/**
 * Dynamic sitemap source for the Model Variants detail pages (registered in
 * nuxt.config `sitemap.sources`). `/archive/variants/[slug]` is SSR, so the
 * sitemap module cannot discover the 141 slugs on its own.
 *
 * Reads through `server/utils/modelVariants.ts` like every other consumer, so
 * the move from the bundled seed to the `model_variants` table changes nothing
 * here. `lastmod` is the seed's capture date until rows carry `updated_at`.
 */
import { allModelVariants } from '../../utils/modelVariants';

const SEED_DATE = '2026-09-22';

export default defineSitemapEventHandler(() =>
  allModelVariants().map((v) => ({
    loc: `/archive/variants/${v.slug}`,
    lastmod: SEED_DATE,
    changefreq: 'monthly' as const,
    priority: 0.6,
  }))
);
