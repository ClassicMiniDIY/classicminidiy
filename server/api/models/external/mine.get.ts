/**
 * GET /api/models/external/mine — the caller's own external submissions
 * (any status), for the dashboard. Runs under the caller's RLS identity, which
 * already scopes rows to `submitted_by = auth.uid()`.
 */
import { requireUserClient } from '../../../utils/userAuth';
import type { ExternalModelSubmission } from '../../../../data/models/external-models';
import type { ExternalSourceSite } from '../../../../data/models/external-sources';

export default defineEventHandler(async (event): Promise<{ submissions: ExternalModelSubmission[] }> => {
  const { supabase } = await requireUserClient(event);
  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');

  const { data: rows, error } = await supabase
    .from('external_models')
    .select('id, slug, title, source_site, source_url, status, rejection_reason, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[external/mine] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load your submissions' });
  }

  const ids = (rows ?? []).map((r) => r.id);
  const primaryByModel = new Map<string, string>();
  if (ids.length) {
    const { data: images } = await supabase
      .from('external_model_images')
      .select('external_model_id, storage_path, is_primary, sort_order')
      .in('external_model_id', ids)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });
    for (const img of images ?? []) {
      if (!primaryByModel.has(img.external_model_id)) {
        primaryByModel.set(
          img.external_model_id,
          `${supabaseUrl}/storage/v1/object/public/model-images/${img.storage_path}`
        );
      }
    }
  }

  const submissions: ExternalModelSubmission[] = (rows ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    sourceSite: r.source_site as ExternalSourceSite,
    sourceUrl: r.source_url,
    status: r.status as ExternalModelSubmission['status'],
    rejectionReason: r.rejection_reason,
    primaryImage: primaryByModel.get(r.id) ?? null,
    createdAt: r.created_at,
  }));

  return { submissions };
});
