import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { buildPartSearchFilter, safePartNumberPattern } from './partSearchFilter';

/**
 * The parts-archive kill switch, in one place.
 *
 * Every consumer of parts data that runs on the SERVICE ROLE bypasses the RLS
 * that protects anon, so a source set to `declined` on /admin/parts would keep
 * being served through the public API unless each consumer filtered it out by
 * hand. Three of them do — the `/archive/parts` search route, the
 * `parts-lookup` MCP tool, and omnisearch — and three copies of the same guard
 * is how one of them stops matching the others. So the guard lives here and is
 * IMPORTED, never copied.
 *
 * Fails closed: an unreadable source list returns `null`, and every caller
 * treats `null` as "return nothing", not as "return everything".
 */

export interface VisiblePartSource {
  id: string;
  name: string;
  domain: string;
  licence_status: string;
}

export interface VisiblePartSources {
  visible: VisiblePartSource[];
  visibleIds: string[];
  sourceById: Map<string, VisiblePartSource>;
}

type ServiceClient = SupabaseClient<Database>;

/**
 * The sources the public is allowed to see, or `null` when the list could not
 * be read. `visibleIds` may legitimately be empty — every source declined —
 * and callers must return nothing in that case too, since the `or()` filter
 * below cannot be built from an empty list.
 */
export async function loadVisiblePartSources(db: ServiceClient): Promise<VisiblePartSources | null> {
  const { data, error } = await db.from('part_sources').select('id, name, domain, licence_status');
  if (error) {
    console.error('[parts] could not read part_sources:', error.message);
    return null;
  }
  const visible = ((data ?? []) as VisiblePartSource[]).filter((source) => source.licence_status !== 'declined');
  return {
    visible,
    visibleIds: visible.map((source) => source.id),
    sourceById: new Map(visible.map((source) => [source.id, source])),
  };
}

/**
 * The PostgREST `or()` that keeps a `parts` query inside the visible sources.
 *
 * A part with no source is ours, not a retailer's, and stays visible —
 * matching the RLS policy the anon consumers read through.
 */
export function visibleSourceFilter(visibleIds: string[]): string {
  return `source_id.is.null,source_id.in.(${visibleIds.join(',')})`;
}

/** The columns omnisearch and the direct-answer card need. Explicit, never `*`. */
const OMNISEARCH_PART_COLUMNS = 'part_number_display, part_number_norm, description, kind, system, source_id';

interface PartRow {
  part_number_display: string;
  part_number_norm: string;
  description: string | null;
  kind: string | null;
  system: string | null;
  source_id: string | null;
}

export interface PartHit {
  partNumber: string;
  /** The normalised number, which is also the `/archive/parts` slug. */
  slug: string;
  description: string | null;
  kind: string | null;
  system: string | null;
  sourceName: string | null;
}

/**
 * Published parts matching a query, inside the kill switch, ordered by number.
 *
 * Shared by omnisearch's `parts` surface. The `/archive/parts` route keeps its
 * own query because it pages and counts; the MCP tool keeps its own because it
 * over-fetches by one and attaches supersessions. Both build their `parts`
 * request from `loadVisiblePartSources` + `visibleSourceFilter` above, which
 * is the part that must not drift.
 */
export async function searchVisibleParts(
  db: ServiceClient,
  rawQuery: string,
  limit: number,
  preloaded?: VisiblePartSources | null
): Promise<PartHit[]> {
  const sources = preloaded === undefined ? await loadVisiblePartSources(db) : preloaded;
  if (!sources || sources.visibleIds.length === 0) return [];

  const filter = buildPartSearchFilter(rawQuery);
  if (!filter) return [];

  const { data, error } = await db
    .from('parts')
    .select(OMNISEARCH_PART_COLUMNS)
    .eq('status', 'published')
    .or(visibleSourceFilter(sources.visibleIds))
    .or(filter)
    .order('part_number_norm')
    .limit(limit);

  if (error) {
    console.error('[parts] search failed:', error.message);
    return [];
  }

  // The filter is a contains-match on the number OR the description, and
  // the rows come back in number order — so a part whose DESCRIPTION cites
  // the number searched for ("gasket for 12G940") can sit above the part
  // that IS 12G940. An exact number goes first; the rest keep their order.
  const exact = safePartNumberPattern(rawQuery);
  const hits = (data ?? []).map((row) => toHit(row, sources));
  return [...hits.filter((hit) => hit.slug === exact), ...hits.filter((hit) => hit.slug !== exact)];
}

function toHit(row: PartRow, sources: VisiblePartSources): PartHit {
  return {
    partNumber: row.part_number_display,
    slug: row.part_number_norm,
    description: row.description,
    kind: row.kind,
    system: row.system,
    sourceName: row.source_id ? (sources.sourceById.get(row.source_id)?.name ?? null) : null,
  };
}

/**
 * The part that IS the number, or null. An equality on the normalised
 * number inside the kill switch — not the contains-search with a limit of
 * one, which returned whichever citing part sorted first and so missed the
 * part itself whenever a description mentioned it.
 */
export async function findVisiblePart(
  db: ServiceClient,
  rawNumber: string,
  preloaded?: VisiblePartSources | null
): Promise<PartHit | null> {
  const exact = safePartNumberPattern(rawNumber);
  if (exact.length < 2) return null;
  const sources = preloaded === undefined ? await loadVisiblePartSources(db) : preloaded;
  if (!sources || sources.visibleIds.length === 0) return null;

  const { data, error } = await db
    .from('parts')
    .select(OMNISEARCH_PART_COLUMNS)
    .eq('status', 'published')
    .or(visibleSourceFilter(sources.visibleIds))
    .eq('part_number_norm', exact)
    .limit(1);
  if (error) {
    console.error('[parts] exact lookup failed:', error.message);
    return null;
  }
  const row = data?.[0];
  return row ? toHit(row, sources) : null;
}
