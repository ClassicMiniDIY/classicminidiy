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
 *
 * In the default mixed view, results are INTERLEAVED 2:1 (first-party : external)
 * so first-party lead every page while external stay visible — never buried off
 * the end (see server/utils/browseInterleave.ts). When a filter restricts to a
 * single kind (`source` or `pricing`), it falls back to one straight query.
 */
import { getServiceClient } from '../../utils/supabase';
import { planInterleave, type BrowseKind } from '../../utils/browseInterleave';
import type { ModelCard, PricingMode } from '../../../data/models/model-library';
import type { BrowseCard, ExternalModelCard } from '../../../data/models/external-models';
import { SUPPORTED_SOURCE_SITES, type ExternalSourceSite } from '../../../data/models/external-sources';

const PRICING_MODES = ['free', 'tips', 'pwyw', 'fixed'];
const SORTS = ['newest', 'popular', 'likes', 'featured'];
const SOURCES = ['all', 'first_party', 'external', ...SUPPORTED_SOURCE_SITES];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

const SELECT_COLS =
  'kind, id, slug, title, summary, category_slug, created_at, published_at, like_count, comment_count, download_count, click_count, pricing_mode, price_cents, min_price_cents, currency, license_code, safety_critical, is_featured, author_id, source_site, source_url, source_author_name, primary_image_path';

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

  const applyFilters = (b: any) => {
    if (category) b = b.eq('category_slug', category);
    if (q) b = b.textSearch('search', q, { type: 'websearch', config: 'english' });
    return b;
  };
  const applySort = (b: any) => {
    switch (sort) {
      case 'popular':
        return b.order('engagement_count', { ascending: false }).order('sort_at', { ascending: false });
      case 'likes':
        return b.order('like_count', { ascending: false }).order('sort_at', { ascending: false });
      case 'featured':
        return b.order('is_featured', { ascending: false }).order('sort_at', { ascending: false });
      default:
        return b.order('sort_at', { ascending: false });
    }
  };
  const kindRows = (kind: BrowseKind) =>
    applySort(applyFilters(service.from('model_browse_cards').select(SELECT_COLS).eq('kind', kind)));
  const kindCount = (kind: BrowseKind) =>
    applyFilters(service.from('model_browse_cards').select('id', { count: 'exact', head: true }).eq('kind', kind));

  // A single-kind filter (explicit source, or pricing → first-party only) skips
  // interleaving and runs one straight query.
  let restrictKind: BrowseKind | null = null;
  let siteFilter: string | null = null;
  if (source === 'first_party') restrictKind = 'first_party';
  else if (source === 'external') restrictKind = 'external';
  else if (SUPPORTED_SOURCE_SITES.includes(source as ExternalSourceSite)) {
    restrictKind = 'external';
    siteFilter = source;
  }
  if (pricing) {
    restrictKind = 'first_party';
    siteFilter = null;
  }

  const offset = (page - 1) * limit;
  let list: any[] = [];
  let total = 0;

  if (restrictKind) {
    let b = applySort(applyFilters(service.from('model_browse_cards').select(SELECT_COLS, { count: 'exact' }).eq('kind', restrictKind)));
    if (siteFilter) b = b.eq('source_site', siteFilter);
    if (pricing) b = b.eq('pricing_mode', pricing);
    const { data, count, error } = await b.range(offset, offset + limit - 1);
    if (error) {
      console.error('[models/index] query failed:', error.message);
      throw createError({ statusCode: 500, statusMessage: 'Failed to load models' });
    }
    list = data ?? [];
    total = count ?? 0;
  } else {
    // Mixed view: interleave first-party + external 2:1.
    const [fpC, extC] = await Promise.all([kindCount('first_party'), kindCount('external')]);
    if (fpC.error || extC.error) {
      console.error('[models/index] count failed:', (fpC.error || extC.error)?.message);
      throw createError({ statusCode: 500, statusMessage: 'Failed to load models' });
    }
    const fpTotal = fpC.count ?? 0;
    const extTotal = extC.count ?? 0;
    total = fpTotal + extTotal;

    const plan = planInterleave(fpTotal, extTotal, offset, limit);
    const [fpRes, extRes] = await Promise.all([
      plan.fpCount
        ? kindRows('first_party').range(plan.fpStart, plan.fpStart + plan.fpCount - 1)
        : Promise.resolve({ data: [], error: null }),
      plan.extCount
        ? kindRows('external').range(plan.extStart, plan.extStart + plan.extCount - 1)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (fpRes.error || extRes.error) {
      console.error('[models/index] query failed:', (fpRes.error || extRes.error)?.message);
      throw createError({ statusCode: 500, statusMessage: 'Failed to load models' });
    }
    const fpData = (fpRes.data ?? []) as any[];
    const extData = (extRes.data ?? []) as any[];
    let fi = 0;
    let ei = 0;
    list = plan.order.map((k) => (k === 'first_party' ? fpData[fi++] : extData[ei++])).filter(Boolean);
  }

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

  return { models: cards, total, page, limit, hasMore: offset + cards.length < total };
});
