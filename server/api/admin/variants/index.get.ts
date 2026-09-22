/**
 * GET /api/admin/variants — every variant (any status) with the counts the
 * admin table shows. Service role; admin only.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const db = getServiceClient();

  const [variants, registry] = await Promise.all([
    db
      .from('model_variants')
      .select(
        'id, slug, name, marque, family, body_style, mark, market, year_start, year_end, is_limited_edition, status, updated_at, model_variant_photos (status), model_variant_colors (color_id)'
      )
      .order('mark', { ascending: true, nullsFirst: false })
      .order('year_start', { ascending: true })
      .range(0, 1999),
    db
      .from('registry_entries')
      .select('id, variant_id')
      .eq('status', 'approved')
      .not('variant_id', 'is', null)
      .order('id')
      .range(0, 1999),
  ]);
  if (variants.error) throw createError({ statusCode: 500, statusMessage: variants.error.message });

  const registered = new Map<string, number>();
  for (const r of registry.data ?? []) {
    if (r.variant_id) registered.set(r.variant_id, (registered.get(r.variant_id) ?? 0) + 1);
  }

  return {
    variants: (variants.data ?? []).map((v: any) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      marque: v.marque,
      family: v.family,
      bodyStyle: v.body_style,
      mark: v.mark,
      market: v.market,
      yearStart: v.year_start,
      yearEnd: v.year_end,
      isLimitedEdition: v.is_limited_edition,
      status: v.status,
      updatedAt: v.updated_at,
      photos: (v.model_variant_photos ?? []).filter((p: any) => p.status === 'approved').length,
      hiddenPhotos: (v.model_variant_photos ?? []).filter((p: any) => p.status !== 'approved').length,
      colours: (v.model_variant_colors ?? []).length,
      coloursLinked: (v.model_variant_colors ?? []).filter((c: any) => c.color_id).length,
      // Null, not 0, when the count could not be read (the parts screen's rule).
      registered: registry.error ? null : (registered.get(v.id) ?? 0),
    })),
  };
});
