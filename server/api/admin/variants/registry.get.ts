/**
 * GET /api/admin/variants/registry — every approved registry car with its
 * Model Variant link and the shared matcher's top suggestions, for the admin
 * "Registry links" tab. Admin only.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { loadModelVariants, toModelVariantCard } from '../../../utils/modelVariants';
import { matchRegistryToVariant } from '../../../../shared/utils/variantMatch';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const db = getServiceClient();

  const [{ data, error }, variants] = await Promise.all([
    db
      .from('registry_entries')
      .select('id, year, model, trim, engine_size, body_type, body_number, variant_id, variant_match')
      .eq('status', 'approved')
      .order('year', { ascending: true, nullsFirst: false })
      .range(0, 1999),
    loadModelVariants(),
  ]);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const cards = variants.map(toModelVariantCard);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const bySlug = new Map(variants.map((v) => [v.slug, v]));

  return {
    variants: variants.map((v) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      yearStart: v.year_start,
      yearEnd: v.year_end,
    })),
    cars: (data ?? []).map((car: any) => {
      const { ranked, confident } = matchRegistryToVariant(car, cards, 3);
      const linked = car.variant_id ? byId.get(car.variant_id) : undefined;
      return {
        id: car.id,
        year: car.year,
        model: car.model,
        trim: car.trim,
        engineSize: car.engine_size,
        bodyType: car.body_type,
        variantId: car.variant_id,
        variantMatch: car.variant_match,
        // A link to a variant that is now hidden shows as its id only.
        variantName: linked?.name ?? null,
        variantSlug: linked?.slug ?? null,
        confident,
        suggestions: ranked
          .map((m) => bySlug.get(m.slug))
          .filter(Boolean)
          .map((v) => ({ id: v!.id, name: v!.name, slug: v!.slug })),
      };
    }),
  };
});
