/**
 * GET /api/archive/variants/:slug
 *
 * One approved variant with its related cards and the registry cars linked to
 * it. A miss is a real 404 so the detail page can propagate it
 * (`.claude/rules/images-seo.md`). A variant id (uuid) resolves too — activity
 * feeds and the contribution ledger only know the id — and the page 301s it
 * onto the slug.
 */
import { createError, getRouterParam } from 'h3';
import { getServiceClient } from '../../../utils/supabase';
import { getModelVariant, getModelVariantById, relatedModelVariantsFor } from '../../../utils/modelVariants';

/** How many linked registry cars the page lists; the count covers the rest. */
const REGISTRY_PREVIEW = 8;

export interface VariantRegistryCar {
  id: string;
  year: number | null;
  model: string | null;
  color: string | null;
  trim: string | null;
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? '';
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  }
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug);
  const variant = isId ? await getModelVariantById(slug) : await getModelVariant(slug);
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  }

  // Service role skips RLS, so the approved filter is re-applied here, and the
  // column list names only what the public register already shows (never the
  // submitter contact columns the column-grant regime withholds).
  let registry: VariantRegistryCar[] = [];
  if (variant.registered_count > 0) {
    const { data, error } = await getServiceClient()
      .from('registry_entries')
      .select('id, year, model, color, trim')
      .eq('variant_id', variant.id)
      .eq('status', 'approved')
      .order('year', { ascending: true })
      .limit(REGISTRY_PREVIEW);
    if (error) console.error('[variants] registry read failed:', error.message);
    registry = (data ?? []) as VariantRegistryCar[];
  }

  return { variant, related: await relatedModelVariantsFor(variant), registry };
});
