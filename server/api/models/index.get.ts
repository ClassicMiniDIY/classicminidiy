/**
 * GET /api/models  (keystone §11 PR 6)
 *
 * Public browse + full-text search over PUBLISHED models. Reads via the service
 * role but always pins `status = 'published'` so drafts/flagged/removed never
 * leak. Supports `q` (Postgres FTS on the generated `search` tsvector),
 * `category`, `pricing`, `sort`, and pagination. Primary images and author
 * profiles are batch-fetched for the page of results.
 */
import { getServiceClient } from '../../utils/supabase';
import { assertModelsEnabled } from '../../utils/models';
import type { ModelCard, PricingMode } from '../../../data/models/model-library';

const PRICING_MODES = ['free', 'tips', 'pwyw', 'fixed'];
const SORTS = ['newest', 'popular', 'likes', 'featured'];
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

export default defineEventHandler(async (event) => {
  assertModelsEnabled();

  const query = getQuery(event);
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : '';
  const category = typeof query.category === 'string' ? query.category.trim() : '';
  const pricing = typeof query.pricing === 'string' && PRICING_MODES.includes(query.pricing) ? query.pricing : '';
  const sort = typeof query.sort === 'string' && SORTS.includes(query.sort) ? query.sort : 'newest';
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');
  const service = getServiceClient();

  let builder = service
    .from('models')
    .select(
      'id, slug, title, summary, category_slug, pricing_mode, price_cents, min_price_cents, currency, license_code, like_count, comment_count, download_count, safety_critical, is_featured, owner_id, created_at',
      { count: 'exact' }
    )
    .eq('status', 'published');

  if (category) builder = builder.eq('category_slug', category);
  if (pricing) builder = builder.eq('pricing_mode', pricing);
  if (q) builder = builder.textSearch('search', q, { type: 'websearch', config: 'english' });

  switch (sort) {
    case 'popular':
      builder = builder.order('download_count', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'likes':
      builder = builder.order('like_count', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'featured':
      builder = builder.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
      break;
    default:
      builder = builder.order('created_at', { ascending: false });
  }

  const from = (page - 1) * limit;
  builder = builder.range(from, from + limit - 1);

  const { data: rows, count, error } = await builder;
  if (error) {
    console.error('[models/index] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load models' });
  }

  const models = rows ?? [];
  const ids = models.map((m) => m.id);
  const ownerIds = [...new Set(models.map((m) => m.owner_id))];

  // Batch: one primary image per model (is_primary first, then sort order).
  const imageByModel = new Map<string, string>();
  if (ids.length) {
    const { data: images } = await service
      .from('model_images')
      .select('model_id, storage_path, is_primary, sort_order')
      .in('model_id', ids)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });
    for (const img of images ?? []) {
      if (!imageByModel.has(img.model_id)) {
        imageByModel.set(img.model_id, `${supabaseUrl}/storage/v1/object/public/model-images/${img.storage_path}`);
      }
    }
  }

  // Batch: author profiles.
  const authorById = new Map<string, ModelCard['author']>();
  if (ownerIds.length) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', ownerIds);
    for (const p of profiles ?? []) {
      authorById.set(p.id, {
        id: p.id,
        displayName: p.display_name,
        username: p.username,
        avatarUrl: p.avatar_url,
      });
    }
  }

  const cards: ModelCard[] = models.map((m) => ({
    id: m.id,
    slug: m.slug,
    title: m.title,
    summary: m.summary,
    categorySlug: m.category_slug,
    pricingMode: m.pricing_mode as PricingMode,
    priceCents: m.price_cents,
    minPriceCents: m.min_price_cents,
    currency: m.currency,
    licenseCode: m.license_code,
    likeCount: m.like_count,
    commentCount: m.comment_count,
    downloadCount: m.download_count,
    safetyCritical: m.safety_critical,
    isFeatured: m.is_featured,
    primaryImage: imageByModel.get(m.id) ?? null,
    author: authorById.get(m.owner_id) ?? null,
    createdAt: m.created_at,
  }));

  const total = count ?? 0;
  return { models: cards, total, page, limit, hasMore: from + cards.length < total };
});
