/**
 * GET /api/models/mine  (keystone §11 PR 7)
 *
 * The caller's own models at any status (drafts, pending, published, rejected,
 * …) for the "my models" dashboard. Runs under the caller's JWT so RLS returns
 * their own rows regardless of status. Primary images are batch-fetched.
 */
import { requireUserClient } from '../../utils/userAuth';

export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireUserClient(event);

  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');

  const { data: rows, error } = await supabase
    .from('models')
    .select(
      'id, slug, title, summary, status, pricing_mode, category_slug, like_count, comment_count, download_count, version_count, current_version_id, created_at, updated_at'
    )
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[models/mine] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not load your models' });
  }

  const models = rows ?? [];
  const ids = models.map((m) => m.id);
  const imageByModel = new Map<string, string>();
  if (ids.length) {
    const { data: images } = await supabase
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

  return {
    models: models.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      summary: m.summary,
      status: m.status,
      pricingMode: m.pricing_mode,
      categorySlug: m.category_slug,
      likeCount: m.like_count,
      commentCount: m.comment_count,
      downloadCount: m.download_count,
      versionCount: m.version_count,
      currentVersionId: m.current_version_id,
      primaryImage: imageByModel.get(m.id) ?? null,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    })),
  };
});
