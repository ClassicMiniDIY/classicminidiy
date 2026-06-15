/**
 * GET /api/models/external/[id] — public detail for an APPROVED external
 * listing, resolved by uuid OR slug. Returns scraped metadata, print settings,
 * source-reported license (display-only), and saved gallery images. No files,
 * pricing, or entitlement — the detail page renders a branded outbound link
 * instead of a download CTA.
 */
import { getServiceClient } from '../../../utils/supabase';
import type { ExternalModelDetail } from '../../../../data/models/external-models';
import type { ExternalSourceSite } from '../../../../data/models/external-sources';
import type { PrintSettings } from '../../../../data/models/model-library';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event): Promise<ExternalModelDetail> => {
  const idOrSlug = getRouterParam(event, 'id');
  if (!idOrSlug) throw createError({ statusCode: 400, statusMessage: 'Missing identifier' });

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const service = getServiceClient();

  const { data: row, error } = await service
    .from('external_models')
    .select(
      'id, slug, title, summary, description, category_slug, tags, source_site, source_url, source_external_id, source_author_name, source_author_url, source_license, remixes_allowed, commercial_use_allowed, print_settings, like_count, click_count, status, created_at, published_at'
    )
    .eq('status', 'approved')
    .eq(UUID_RE.test(idOrSlug) ? 'id' : 'slug', idOrSlug)
    .maybeSingle();

  if (error) {
    console.error('[external/detail] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load listing' });
  }
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Listing not found' });

  const { data: imageRows } = await service
    .from('external_model_images')
    .select('id, storage_path, alt_text, is_primary, sort_order')
    .eq('external_model_id', row.id)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });

  const images = (imageRows ?? []).map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/model-images/${img.storage_path}`,
    altText: img.alt_text,
    isPrimary: img.is_primary,
  }));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    categorySlug: row.category_slug,
    tags: row.tags ?? [],
    sourceSite: row.source_site as ExternalSourceSite,
    sourceUrl: row.source_url,
    sourceExternalId: row.source_external_id,
    sourceAuthorName: row.source_author_name,
    sourceAuthorUrl: row.source_author_url,
    sourceLicense: row.source_license,
    remixesAllowed: row.remixes_allowed,
    commercialUseAllowed: row.commercial_use_allowed,
    printSettings: (row.print_settings as unknown as PrintSettings) ?? null,
    likeCount: row.like_count,
    clickCount: row.click_count,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    images,
  };
});
