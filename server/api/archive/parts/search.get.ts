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
import { buildPartSearchFilter } from '../../../utils/partSearchFilter';

const PAGE_SIZE = 24;
const MAX_PAGE = 200;

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
  // catalogueTotal null, not 0: with no visible source the page cannot say how
  // big the archive is, and 0 would be a claim rather than an admission.
  if (visibleIds.length === 0)
    return { parts: [], total: 0, catalogueTotal: null, page, pageSize: PAGE_SIZE, systems: [] };

  let request = db
    .from('parts')
    .select('part_number_display, part_number_norm, description, kind, system, source_id', { count: 'exact' })
    .eq('status', 'published')
    .or(`source_id.is.null,source_id.in.(${visibleIds.join(',')})`);

  if (search) {
    const filter = buildPartSearchFilter(search);
    // Input that reduces to nothing usable returns no results, rather than
    // falling through to an unfiltered query that looks like a working search.
    if (!filter)
      return {
        parts: [],
        total: 0,
        catalogueTotal: null,
        page,
        pageSize: PAGE_SIZE,
        query: search,
        system: system || null,
      };
    request = request.or(filter);
  }
  if (system) request = request.eq('system', system);

  const from = (page - 1) * PAGE_SIZE;

  // The catalogue size depends only on the visible sources, not on the query,
  // so it runs alongside the search rather than after it. Awaiting it in
  // sequence added a round trip to every search for a number that could not
  // change based on what was typed.
  const [searchResult, catalogueResult] = await Promise.all([
    request.order('part_number_norm').range(from, from + PAGE_SIZE - 1),
    db
      .from('parts')
      .select('id', { count: 'exact', head: true })
      // Published only, matching the listing. A licence takedown can withdraw a
      // source's parts while leaving the source row alone, and a headline that
      // counts rows the search cannot return is wrong in exactly that case.
      .eq('status', 'published')
      .or(`source_id.is.null,source_id.in.(${visibleIds.join(',')})`),
  ]);

  const { data, count, error } = searchResult;
  const { count: catalogueTotal, error: catalogueError } = catalogueResult;
  if (catalogueError) console.error('[archive/parts] catalogue total unavailable:', catalogueError.message);

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
    // Null, not 0, when unreadable: "0 part numbers" is a lie a reader believes.
    catalogueTotal: catalogueError ? null : (catalogueTotal ?? 0),
    page,
    pageSize: PAGE_SIZE,
    query: search || null,
    system: system || null,
  };
});
