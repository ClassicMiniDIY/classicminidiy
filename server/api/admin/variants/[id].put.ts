/**
 * PUT /api/admin/variants/:id — admin content correction, including
 * reclassification (marque / family / mark / market). The allowlist and the
 * validation are `ADMIN_VARIANT_COLUMNS` / `validateAdminVariantChanges` in
 * server/utils/variantAdmin.ts; read the note there before widening it.
 *
 *   body: { changes: Record<string, unknown> }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { auditVariantAction, UUID_RE, validateAdminVariantChanges } from '../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const id = getRouterParam(event, 'id') ?? '';
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  const body = await readBody<{ changes?: unknown }>(event);

  const valid = validateAdminVariantChanges(body?.changes);
  if (!valid.ok) throw createError({ statusCode: 400, statusMessage: valid.error });

  const db = getServiceClient();
  const { data: before, error: readError } = await db.from('model_variants').select('*').eq('id', id).maybeSingle();
  if (readError) throw createError({ statusCode: 500, statusMessage: readError.message });
  if (!before) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });

  const start = ('year_start' in valid.updates ? valid.updates.year_start : before.year_start) as number | null;
  const end = ('year_end' in valid.updates ? valid.updates.year_end : before.year_end) as number | null;
  if (start !== null && end !== null && end < start) {
    throw createError({ statusCode: 400, statusMessage: 'The last year cannot be before the first year' });
  }

  // Validated and allowlisted above; the generated Update type cannot see that.
  const { error } = await db
    .from('model_variants')
    .update(valid.updates as never)
    .eq('id', id);
  if (error) {
    // Readable for the one constraint an admin can hit by renaming.
    const msg = error.message.includes('model_variants_identity_unique')
      ? 'Another variant already has this marque, name and first year'
      : error.message.includes('model_variants_years_ordered')
        ? 'The years are out of order; set the first year as well'
        : error.message;
    throw createError({ statusCode: 400, statusMessage: msg });
  }

  const auditError = await auditVariantAction(db, user.id, 'variant_edited', 'variant', id, {
    slug: before.slug,
    name: before.name,
    fields: Object.keys(valid.updates),
    // Reversible: the value each field held before, and what it became.
    changes: Object.fromEntries(
      Object.entries(valid.updates).map(([k, to]) => [k, { from: (before as Record<string, unknown>)[k] ?? null, to }])
    ),
  });
  return { success: true, warning: auditError };
});
