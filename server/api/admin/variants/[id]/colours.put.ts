/**
 * PUT /api/admin/variants/:id/colours — replace a variant's factory colour
 * list (comma or newline separated). Names re-link to the colours archive by
 * the same rule as approvals; existing links on kept names survive.
 *
 *   body: { colours: string }
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';
import { parseColourList, replaceColours } from '../../../../utils/variantApprovals';
import { auditVariantAction, UUID_RE } from '../../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const id = getRouterParam(event, 'id') ?? '';
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  const body = await readBody<{ colours?: unknown }>(event);
  const names = parseColourList(body?.colours);

  const db = getServiceClient();
  const { data: variant } = await db.from('model_variants').select('slug').eq('id', id).maybeSingle();
  if (!variant) throw createError({ statusCode: 404, statusMessage: 'Variant not found' });

  const error = await replaceColours(db, id, names);
  if (error) throw createError({ statusCode: 500, statusMessage: error });

  const auditError = await auditVariantAction(db, user.id, 'variant_colours_replaced', 'variant', id, {
    slug: variant.slug,
    count: names.length,
  });
  return { success: true, count: names.length, warning: auditError };
});
