/**
 * POST /api/admin/variants/registry — set or clear one registry car's Model
 * Variant. An admin decision is recorded as `variant_match = 'reviewed'`, and
 * a clear sets both columns null (the pair is CHECKed together).
 *
 *   body: { entryId: string, variantId: string | null }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
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
  const db = getServiceClient();
  // Only an approved (public) variant can be linked. Read the row, not the
  // per-isolate snapshot, so a variant hidden elsewhere a minute ago is refused.
  let variant: { id: string; name: string } | null = null;
  if (variantId) {
    const { data, error: variantError } = await db
      .from('model_variants')
      .select('id, name')
      .eq('id', variantId)
      .eq('status', 'approved')
      .maybeSingle();
    if (variantError) throw createError({ statusCode: 500, statusMessage: variantError.message });
    if (!data) throw createError({ statusCode: 400, statusMessage: 'That variant is not public' });
    variant = data;
  }

  const { data: entry, error: entryError } = await db
    .from('registry_entries')
    .select('id, year, model, variant_id, variant_match, status')
    .eq('id', entryId)
    .maybeSingle();
  if (entryError) throw createError({ statusCode: 500, statusMessage: entryError.message });
  // The tab lists approved cars only; the route holds the same line.
  if (!entry || entry.status !== 'approved') {
    throw createError({ statusCode: 404, statusMessage: 'Registry entry not found' });
  }

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
