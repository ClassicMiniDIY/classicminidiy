/**
 * GET /api/models  (keystone §11 PR 6 — extended for external listings)
 *
 * Public browse + full-text search over the `model_browse_cards` view, a
 * read-time UNION of PUBLISHED first-party models + APPROVED external listings
 * ("Around the Web"), discriminated by `kind`. The view already restricts to
 * public statuses, so drafts/pending never leak. Supports `q` (FTS on the
 * combined `search` vector), `category`, `pricing` (first-party only), `source`
 * (`all` | `first_party` | `external` | a specific site slug), `sort`, and
 * pagination. Returns a mixed `BrowseCard[]`.
 */
import { getServiceClient } from '../../utils/supabase';
import type { ModelCard, PricingMode } from '../../../data/models/model-library';
import type { BrowseCard, ExternalModelCard } from '../../../data/models/external-models';
import { SUPPORTED_SOURCE_SITES, type ExternalSourceSite } from '../../../data/models/external-sources';

const PRICING_MODES = ['free', 'tips', 'pwyw', 'fixed'];
const SORTS = ['newest', 'popular', 'likes', 'featured'];
const SOURCES = ['all', 'first_party', 'external', ...SUPPORTED_SOURCE_SITES];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : '';
  const category = typeof query.category === 'string' ? query.category.trim() : '';
  const pricing = typeof query.pricing === 'string' && PRICING_MODES.includes(query.pricing) ? query.pricing : '';
  const source = typeof query.source === 'string' && SOURCES.includes(query.source) ? query.source : 'all';
  const sort = typeof query.sort === 'string' && SORTS.includes(query.sort) ? query.sort : 'newest';
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const service = getServiceClient();
  const imageUrl = (path: string | null) =>
    path ? `${supabaseUrl}/storage/v1/object/public/model-images/${path}` : null;

  let builder = service
    .from('model_browse_cards')
    .select(
      'kind, id, slug, title, summary, category_slug, created_at, published_at, like_count, comment_count, download_count, click_count, pricing_mode, price_cents, min_price_cents, currency, license_code, safety_critical, is_featured, author_id, source_site, source_url, source_author_name, primary_image_path',
      { count: 'exact' }
    );

  if (category) builder = builder.eq('category_slug', category);
  if (q) builder = builder.textSearch('search', q, { type: 'websearch', config: 'english' });

  // Source scoping.
  if (source === 'first_party') builder = builder.eq('kind', 'first_party');
  else if (source === 'external') builder = builder.eq('kind', 'external');
  else if (SUPPORTED_SOURCE_SITES.includes(source as ExternalSourceSite)) {
    builder = builder.eq('kind', 'external').eq('source_site', source);
  }

  // Pricing only applies to first-party listings.
  if (pricing) builder = builder.eq('kind', 'first_party').eq('pricing_mode', pricing);

  switch (sort) {
    case 'popular':
      builder = builder.order('engagement_count', { ascending: false }).order('sort_at', { ascending: false });
      break;
    case 'likes':
      builder = builder.order('like_count', { ascending: false }).order('sort_at', { ascending: false });
      break;
    case 'featured':
      builder = builder.order('is_featured', { ascending: false }).order('sort_at', { ascending: false });
      break;
    default:
      builder = builder.order('sort_at', { ascending: false });
  }

  const from = (page - 1) * limit;
  builder = builder.range(from, from + limit - 1);

  const { data: rows, count, error } = await builder;
  if (error) {
    console.error('[models/index] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load models' });
  }

  const list = rows ?? [];

  // Batch author profiles for the first-party rows only.
  const ownerIds = [...new Set(list.filter((m) => m.author_id).map((m) => m.author_id as string))];
  const authorById = new Map<string, ModelCard['author']>();
  if (ownerIds.length) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', ownerIds);
    for (const p of profiles ?? []) {
      authorById.set(p.id, { id: p.id, displayName: p.display_name, username: p.username, avatarUrl: p.avatar_url });
    }
  }

  const cards: BrowseCard[] = list.map((m) => {
    if (m.kind === 'external') {
      const card: ExternalModelCard = {
        kind: 'external',
        id: m.id as string,
        slug: m.slug as string,
        title: m.title as string,
        summary: m.summary,
        categorySlug: m.category_slug as string,
        sourceSite: (m.source_site ?? 'other') as ExternalSourceSite,
        sourceUrl: m.source_url as string,
        sourceAuthorName: m.source_author_name,
        likeCount: m.like_count ?? 0,
        clickCount: m.click_count ?? 0,
        isFeatured: m.is_featured ?? false,
        primaryImage: imageUrl(m.primary_image_path),
        createdAt: m.created_at as string,
        publishedAt: m.published_at,
      };
      return card;
    }
    const card: ModelCard = {
      kind: 'first_party',
      id: m.id as string,
      slug: m.slug as string,
      title: m.title as string,
      summary: m.summary,
      categorySlug: m.category_slug as string,
      pricingMode: (m.pricing_mode ?? 'free') as PricingMode,
      priceCents: m.price_cents,
      minPriceCents: m.min_price_cents,
      currency: m.currency ?? 'usd',
      licenseCode: m.license_code ?? '',
      likeCount: m.like_count ?? 0,
      commentCount: m.comment_count ?? 0,
      downloadCount: m.download_count ?? 0,
      safetyCritical: m.safety_critical ?? false,
      isFeatured: m.is_featured ?? false,
      primaryImage: imageUrl(m.primary_image_path),
      author: m.author_id ? authorById.get(m.author_id) ?? null : null,
      createdAt: m.created_at as string,
    };
    return card;
  });

  const total = count ?? 0;
  return { models: cards, total, page, limit, hasMore: from + cards.length < total };
});
