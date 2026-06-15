/**
 * Dynamic sitemap source for the document archive (registered in nuxt.config
 * `sitemap.sources`). Covers BOTH the individual document detail pages
 * `/archive/documents/[slug]` and the collection pages
 * `/archive/documents/collection/[slug]` — neither is auto-discovered by
 * @nuxtjs/sitemap (both are SSR, Supabase-backed).
 *
 * Service role, pinned to `status = 'approved'` so drafts/rejected never leak.
 */
import { getServiceClient } from '../../utils/supabase';

type SitemapUrl = {
  loc: string;
  lastmod: string;
  changefreq: 'monthly';
  priority: number;
};

export default defineSitemapEventHandler(async () => {
  const service = getServiceClient();
  const urls: SitemapUrl[] = [];

  const { data: docs, error: docErr } = await service
    .from('archive_documents')
    .select('slug, updated_at')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (docErr) {
    console.error('[sitemap] archive_documents query failed:', docErr.message);
  } else {
    urls.push(
      ...(docs ?? [])
        .filter((d) => d.slug)
        .map((d) => ({
          loc: `/archive/documents/${d.slug}`,
          lastmod: d.updated_at,
          changefreq: 'monthly' as const,
          priority: 0.6,
        }))
    );
  }

  const { data: collections, error: colErr } = await service
    .from('document_collections')
    .select('slug, updated_at')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(2000);

  if (colErr) {
    console.error('[sitemap] document_collections query failed:', colErr.message);
  } else {
    urls.push(
      ...(collections ?? [])
        .filter((c) => c.slug)
        .map((c) => ({
          loc: `/archive/documents/collection/${c.slug}`,
          lastmod: c.updated_at,
          changefreq: 'monthly' as const,
          priority: 0.5,
        }))
    );
  }

  return urls;
});
