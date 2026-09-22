/**
 * GET /api/archive/variants
 *
 * The whole Model Variants archive as cards, plus the facet counts the index
 * page's filter chips are built from. The list is 141 rows today and filters
 * client-side like the wheel grid does; the query parameters exist so the same
 * route serves the MCP-free callers (mobile, curl) that want a narrowed list.
 */
import { getQuery } from 'h3';
import { listModelVariants, modelVariantFacets, toModelVariantCard } from '../../../utils/modelVariants';

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

export default defineEventHandler((event) => {
  const q = getQuery(event);
  const variants = listModelVariants({
    query: str(q.q),
    marque: str(q.marque),
    family: str(q.family),
    body: str(q.body),
    market: str(q.market),
    mark: int(q.mark) ?? null,
    year: int(q.year),
    engine_cc: int(q.engine),
    limitedOnly: str(q.limited) === '1' || str(q.limited) === 'true',
  }).map(toModelVariantCard);

  return {
    variants,
    facets: modelVariantFacets(),
    total: variants.length,
  };
});
