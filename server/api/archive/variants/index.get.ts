/**
 * GET /api/archive/variants
 *
 * The approved Model Variants archive as cards, plus facet counts over the
 * WHOLE archive (facets.total) for the index page's filter controls. The
 * query parameters narrow `variants`/`total` only; the colour detail page uses
 * `?color=<colours-archive id>` for its "offered on" block.
 */
import { getQuery } from 'h3';
import { getModelVariantFacets, listModelVariants, toModelVariantCard } from '../../../utils/modelVariants';

function str(v: unknown): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() ? s.trim() : undefined;
}
function int(v: unknown): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const colorId = str(q.color);
  const [rows, facets] = await Promise.all([
    listModelVariants({
      query: str(q.q),
      marque: str(q.marque),
      family: str(q.family),
      body: str(q.body),
      market: str(q.market),
      mark: int(q.mark) ?? null,
      year: int(q.year),
      engine_cc: int(q.engine),
      limitedOnly: str(q.limited) === '1' || str(q.limited) === 'true',
      colorId: colorId && /^[0-9a-f-]{36}$/i.test(colorId) ? colorId : undefined,
    }),
    getModelVariantFacets(),
  ]);
  const variants = rows.map(toModelVariantCard);
  return { variants, facets, total: variants.length };
});
