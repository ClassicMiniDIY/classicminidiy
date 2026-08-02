import { getServiceClient } from '../../utils/supabase';
import { ToolCatalog, TOOL_CATEGORY_LABELS } from '../../../data/models/toolbox-catalog';

/**
 * Omnisearch — one query across every surface (design S2/S3).
 *
 * Two sources are merged here rather than in the database:
 *   * `omnisearch()` in Postgres covers the data surfaces (wheels, colours,
 *     documents, registry, exchange listings, models).
 *   * The Toolbox is a static catalog in the web repo, so it is matched in
 *     process. Keeping it out of SQL means adding a calculator never needs a
 *     migration, and tool matching can use synonyms ("CR", "lb-ft") that would
 *     be awkward to store.
 *
 * Reads only, and every underlying row is already public, so this runs on the
 * service client without an auth requirement — the same reasoning as the
 * unauthenticated chat proxy. Zero-result queries are recorded as telemetry via
 * record_search_miss(), which writes to an admin-only table.
 */

const SURFACE_ORDER = ['tools', 'wheels', 'archive', 'models', 'exchange'] as const;
type Surface = (typeof SURFACE_ORDER)[number];

export interface SearchResult {
  surface: Surface;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
  icon: string;
  tag: string | null;
  contributorUsername: string | null;
  verified: boolean;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  counts: Record<string, number>;
}

const MAX_QUERY_LENGTH = 120;

/** Tools are matched on name, summary and synonym list, ranked name-first. */
function searchTools(query: string): SearchResult[] {
  const needle = query.toLowerCase();

  return ToolCatalog.map((tool) => {
    const name = tool.name.toLowerCase();
    let rank: number | null = null;

    if (name.startsWith(needle)) rank = 0;
    else if (name.includes(needle)) rank = 1;
    else if (tool.searchTerms.some((term) => term.includes(needle) || needle.includes(term))) rank = 2;
    else if (tool.summary.toLowerCase().includes(needle)) rank = 3;

    return rank === null ? null : { tool, rank };
  })
    .filter((hit): hit is { tool: (typeof ToolCatalog)[number]; rank: number } => hit !== null)
    .sort((a, b) => a.rank - b.rank || a.tool.name.localeCompare(b.tool.name))
    .map(({ tool }) => ({
      surface: 'tools' as const,
      id: tool.slug,
      title: tool.name,
      subtitle: tool.summary,
      url: tool.to,
      icon: tool.icon,
      tag: TOOL_CATEGORY_LABELS[tool.category],
      contributorUsername: null,
      verified: false,
    }));
}

export default defineEventHandler(async (event): Promise<SearchResponse> => {
  const { q, limit } = getQuery(event);

  const query = String(q ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY_LENGTH);

  if (query.length < 2) {
    return { query, total: 0, results: [], counts: {} };
  }

  const perSurfaceLimit = Math.min(Math.max(Number(limit) || 20, 1), 60);
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('omnisearch', {
    p_query: query,
    p_limit: perSurfaceLimit,
  });

  if (error) {
    console.error('[search] omnisearch rpc failed:', error.message);
    throw createError({ statusCode: 502, statusMessage: 'Search is temporarily unavailable' });
  }

  const dbResults: SearchResult[] = (data ?? []).map((row) => ({
    surface: (row.surface as Surface) ?? 'archive',
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    url: row.url,
    icon: row.icon,
    tag: row.tag,
    contributorUsername: row.contributor_username,
    verified: row.verified ?? false,
  }));

  const results = [...searchTools(query), ...dbResults].sort(
    (a, b) => SURFACE_ORDER.indexOf(a.surface) - SURFACE_ORDER.indexOf(b.surface)
  );

  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.surface] = (acc[result.surface] ?? 0) + 1;
    return acc;
  }, {});

  // A miss is the signal that feeds Most Wanted. Fire-and-forget: search must
  // not get slower, or fail, because telemetry did.
  if (results.length === 0) {
    supabase
      .rpc('record_search_miss', { p_query: query })
      .then(({ error: missError }) => {
        if (missError) console.error('[search] record_search_miss failed:', missError.message);
      })
      .catch(() => {});
  }

  return { query, total: results.length, results, counts };
});
