/**
 * POST /api/admin/variants/registry — set or clear one registry car's Model
 * Variant. An admin decision is recorded as `variant_match = 'reviewed'`, and
 * a clear sets both columns null (the pair is CHECKed together).
 *
 *   body: { entryId: string, variantId: string | null }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { getModelVariantById } from '../../../utils/modelVariants';
import { auditVariantAction, UUID_RE } from '../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ entryId?: string; variantId?: string | null }>(event);
  const entryId = body?.entryId ?? '';
  const variantId = body?.variantId ?? null;
  if (!UUID_RE.test(entryId)) throw createError({ statusCode: 400, statusMessage: 'Missing registry entry' });
  if (variantId !== null && !UUID_RE.test(variantId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid variant' });
  }
  // Only an approved (public) variant can be linked; the snapshot holds exactly those.
  const variant = variantId ? await getModelVariantById(variantId) : null;
  if (variantId && !variant) throw createError({ statusCode: 400, statusMessage: 'That variant is not public' });

  const db = getServiceClient();
  const { data: entry } = await db
    .from('registry_entries')
    .select('id, year, model, variant_id, variant_match')
    .eq('id', entryId)
    .maybeSingle();
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Registry entry not found' });

  const { error } = await db
    .from('registry_entries')
    .update(
      variantId ? { variant_id: variantId, variant_match: 'reviewed' } : { variant_id: null, variant_match: null }
    )
    .eq('id', entryId);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const auditError = await auditVariantAction(
    db,
    user.id,
    variantId ? 'registry_variant_set' : 'registry_variant_cleared',
    'registry',
    entryId,
    {
      car: `${entry.year ?? ''} ${entry.model ?? ''}`.trim(),
      from: entry.variant_id,
      from_match: entry.variant_match,
      to: variantId,
      to_name: variant?.name ?? null,
    }
  );
  return { success: true, warning: auditError };
});
