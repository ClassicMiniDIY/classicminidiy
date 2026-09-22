/** GET /api/admin/variants/:id — one variant with ALL its photos (any status) and colours. Admin only. */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { UUID_RE } from '../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const id = getRouterParam(event, 'id') ?? '';
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });

  const { data, error } = await getServiceClient()
    .from('model_variants')
    .select(
      '*, model_variant_photos (id, url, kind, caption, credit, is_primary, sort_order, status, submitted_by), model_variant_colors (color_name, color_id, sort_order, colors (name, code))'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });

  const photos = [...(data.model_variant_photos ?? [])].sort(
    (a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  );
  const colours = [...(data.model_variant_colors ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const { model_variant_photos: _p, model_variant_colors: _c, ...variant } = data as any;
  return { variant, photos, colours };
});
