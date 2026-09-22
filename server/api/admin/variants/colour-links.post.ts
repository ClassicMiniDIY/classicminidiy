/**
 * POST /api/admin/variants/colour-links — link (or unlink) EVERY variant
 * colour row with this name, case-insensitively, to one approved colour.
 * Fixing a name once fixes it on every variant that lists it.
 *
 *   body: { colorName: string, colorId: string | null }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { auditVariantAction, UUID_RE } from '../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ colorName?: string; colorId?: string | null }>(event);
  const colorName = (body?.colorName ?? '').trim();
  const colorId = body?.colorId ?? null;
  if (!colorName || colorName.length > 120)
    throw createError({ statusCode: 400, statusMessage: 'Missing colour name' });
  if (colorId !== null && !UUID_RE.test(colorId))
    throw createError({ statusCode: 400, statusMessage: 'Invalid colour' });

  const db = getServiceClient();
  let colour: { id: string; name: string } | null = null;
  if (colorId) {
    const { data, error: colourError } = await db
      .from('colors')
      .select('id, name')
      .eq('id', colorId)
      .eq('status', 'approved')
      .maybeSingle();
    if (colourError) throw createError({ statusCode: 500, statusMessage: colourError.message });
    if (!data) throw createError({ statusCode: 400, statusMessage: 'That colour is not in the public archive' });
    colour = data;
  }

  // The same grouping the GET shows: lower(trim(name)). Computed here rather
  // than with ilike, whose `%`, `_` and `*` wildcards would widen the match.
  const key = colorName.toLowerCase();
  const spellings = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error: readError } = await db
      .from('model_variant_colors')
      .select('color_name')
      .order('variant_id')
      .order('color_name')
      .range(from, from + 999);
    if (readError) throw createError({ statusCode: 500, statusMessage: readError.message });
    for (const r of data ?? []) if (r.color_name.trim().toLowerCase() === key) spellings.add(r.color_name);
    if (!data || data.length < 1000) break;
  }
  if (!spellings.size) throw createError({ statusCode: 404, statusMessage: 'No variant lists that colour' });

  const { data: updated, error } = await db
    .from('model_variant_colors')
    .update({ color_id: colorId })
    .in('color_name', [...spellings])
    .select('variant_id');
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const auditError = await auditVariantAction(
    db,
    user.id,
    colorId ? 'variant_colour_linked' : 'variant_colour_unlinked',
    'variant_colour',
    colorId,
    { color_name: colorName, colour: colour?.name ?? null, rows: updated?.length ?? 0 }
  );
  return { success: true, rows: updated?.length ?? 0, warning: auditError };
});
