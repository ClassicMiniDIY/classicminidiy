/**
 * GET /api/archive/parts/search  (public — the /archive/parts index)
 *
 * Search and facets for the part-number archive.
 *
 * A server route rather than a client Supabase query for two reasons: the page
 * must render on the server for SEO, and the retailer link lives in
 * `part_source_records`, which anon deliberately cannot read because it also
 * holds retailer identifiers and raw payloads.
 *
 * THE KILL SWITCH IS ENFORCED HERE, BY HAND. This runs on the service role,
 * which BYPASSES the RLS protecting anon, so a source set to `declined` would
 * still be served unless this route filters it out. Fails closed: an unreadable
 * source list returns nothing rather than everything.
 */
import { getServiceClient } from '../../../utils/supabase';

const PAGE_SIZE = 24;
const MAX_PAGE = 200;

function normalise(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-.]/g, '');
}

/** PostgREST splits `or()` on commas and parens, so an unescaped value changes the filter's shape. */
function escapeForOr(value: string): string {
  return value.replace(/[,()*]/g, ' ').trim();
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : '';
  const system = typeof query.system === 'string' ? query.system.trim().slice(0, 60) : '';
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1));

  const db = getServiceClient();

  const { data: sources, error: sourceError } = await db
    .from('part_sources')
    .select('id, name, domain, licence_status');
  if (sourceError) {
    throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });
  }
  const visible = (sources ?? []).filter((s) => s.licence_status !== 'declined');
  const visibleIds = visible.map((s) => s.id);
  if (visibleIds.length === 0) return { parts: [], total: 0, page, pageSize: PAGE_SIZE, systems: [] };

  let request = db
    .from('parts')
    .select('part_number_display, part_number_norm, description, kind, system, source_id', { count: 'exact' })
    .eq('status', 'published')
    .or(`source_id.is.null,source_id.in.(${visibleIds.join(',')})`);

  if (search) {
    const norm = normalise(search);
    const words = escapeForOr(search);
    request = request.or(`part_number_norm.ilike.*${norm}*,description.ilike.*${words}*`);
  }
  if (system) request = request.eq('system', system);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await request.order('part_number_norm').range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error('parts search error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });
  }

  const sourceById = new Map(visible.map((s) => [s.id, s]));

  return {
    parts: (data ?? []).map((p) => ({
      partNumber: p.part_number_display,
      slug: p.part_number_norm,
      description: p.description,
      kind: p.kind,
      system: p.system,
      source: p.source_id ? (sourceById.get(p.source_id)?.name ?? null) : null,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    query: search || null,
    system: system || null,
  };
});
