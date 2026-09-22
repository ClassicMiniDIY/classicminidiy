/**
 * GET /api/admin/variants/colour-links — factory colour names across all
 * variants, grouped by name, with how many rows are linked to the colours
 * archive; plus the approved colours to link them to. Admin only.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const db = getServiceClient();

  const [rows, colours] = await Promise.all([
    db.from('model_variant_colors').select('color_name, color_id, model_variants (slug, name)').range(0, 4999),
    db.from('colors').select('id, name, code').eq('status', 'approved').order('name').range(0, 4999),
  ]);
  if (rows.error) throw createError({ statusCode: 500, statusMessage: rows.error.message });
  if (colours.error) throw createError({ statusCode: 500, statusMessage: colours.error.message });

  const byKey = new Map<
    string,
    { name: string; total: number; linked: number; colorIds: Set<string>; variants: { slug: string; name: string }[] }
  >();
  for (const r of rows.data ?? []) {
    const key = String(r.color_name).trim().toLowerCase();
    const g = byKey.get(key) ?? {
      name: String(r.color_name).trim(),
      total: 0,
      linked: 0,
      colorIds: new Set(),
      variants: [],
    };
    g.total += 1;
    if (r.color_id) {
      g.linked += 1;
      g.colorIds.add(r.color_id);
    }
    const v = (r as any).model_variants;
    if (v && g.variants.length < 8) g.variants.push({ slug: v.slug, name: v.name });
    byKey.set(key, g);
  }

  return {
    names: [...byKey.values()]
      .map((g) => ({ name: g.name, total: g.total, linked: g.linked, colorIds: [...g.colorIds], variants: g.variants }))
      .sort((a, b) => a.linked - b.linked || b.total - a.total || a.name.localeCompare(b.name)),
    colours: colours.data ?? [],
  };
});
