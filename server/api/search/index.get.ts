import { getServiceClient } from '../../utils/supabase';
import {
  ToolCatalog,
  TOOL_CATEGORY_LABELS,
  ARCHIVE_SEARCH_SECTIONS,
} from '../../../data/models/toolbox-catalog';
import wiringDiagrams from '../../../data/wiringDiagrams.json';

/**
 * Omnisearch — one query across every surface (design S2/S3).
 *
 * THREE sources are merged here rather than in the database:
 *   * `omnisearch()` in Postgres covers the data surfaces (wheels, colours,
 *     documents, registry, exchange listings, models).
 *   * The Toolbox is a static catalog in the web repo, so it is matched in
 *     process. Adding a calculator then never needs a migration, and tool
 *     matching can use synonyms ("CR", "lb-ft") that would be awkward to store.
 *   * Static archive content — wiring diagrams, and the reference sections that
 *     live in JSON rather than Postgres. Without these, searching "wiring" or
 *     "weights" returned nothing from the archive at all.
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

/**
 * Shared ranking for the in-process sources: name prefix beats name substring
 * beats a synonym hit beats a description hit. Returns null for no match.
 */
function rank(needle: string, name: string, terms: string[], summary: string): number | null {
  const lower = name.toLowerCase();
  if (lower.startsWith(needle)) return 0;
  if (lower.includes(needle)) return 1;
  if (terms.some((term) => term.includes(needle) || needle.includes(term))) return 2;
  if (summary.toLowerCase().includes(needle)) return 3;
  return null;
}

function searchTools(query: string): SearchResult[] {
  const needle = query.toLowerCase();

  return ToolCatalog.map((tool) => {
    const score = rank(needle, tool.name, tool.searchTerms, tool.summary);
    return score === null ? null : { tool, score };
  })
    .filter((hit): hit is { tool: (typeof ToolCatalog)[number]; score: number } => hit !== null)
    .sort((a, b) => a.score - b.score || a.tool.name.localeCompare(b.tool.name))
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

interface DiagramGroup {
  title: string;
  items: { name: string; from?: number; to?: number; link?: string }[];
}

/**
 * Wiring diagrams, one result per diagram.
 *
 * Deep-links into `/archive/electrical?q=` rather than at the raw S3 PDF: that
 * page seeds its own filter from the query param, so the visitor lands on the
 * diagram WITH its ground polarity, year range and siblings, instead of on a
 * bare PDF with no way back.
 */
function searchDiagrams(query: string): SearchResult[] {
  const needle = query.toLowerCase();
  const groups = wiringDiagrams as unknown as Record<string, DiagramGroup>;
  const hits: { result: SearchResult; score: number }[] = [];

  for (const [key, group] of Object.entries(groups)) {
    if (!group?.items) continue;
    for (const item of group.items) {
      const years = item.from && item.to ? `${item.from}–${item.to}` : item.from ? `${item.from}+` : '';
      const score = rank(needle, item.name, [group.title.toLowerCase(), 'wiring', 'diagram'], years);
      if (score === null) continue;

      hits.push({
        score,
        result: {
          surface: 'archive',
          id: `diagram-${key}-${item.name}`,
          title: item.name,
          subtitle: [group.title, years].filter(Boolean).join(' · '),
          url: `/archive/electrical?q=${encodeURIComponent(item.name)}`,
          icon: 'fas fa-bolt',
          tag: 'Wiring',
          contributorUsername: null,
          verified: true,
        },
      });
    }
  }

  return hits.sort((a, b) => a.score - b.score).map((hit) => hit.result);
}

/**
 * Archive sections that live in JSON rather than Postgres. Section-level on
 * purpose — see the comment on ARCHIVE_SEARCH_SECTIONS.
 */
function searchArchiveSections(query: string): SearchResult[] {
  const needle = query.toLowerCase();

  return ARCHIVE_SEARCH_SECTIONS.map((section) => {
    const score = rank(needle, section.name, section.searchTerms, section.summary);
    return score === null ? null : { section, score };
  })
    .filter((hit): hit is { section: (typeof ARCHIVE_SEARCH_SECTIONS)[number]; score: number } => hit !== null)
    .sort((a, b) => a.score - b.score)
    .map(({ section }) => ({
      surface: 'archive' as const,
      id: `section-${section.key}`,
      title: section.name,
      subtitle: section.summary,
      url: section.to,
      icon: section.icon,
      tag: 'Archive',
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

  // Order matters: the in-process sources go first within their surface, and
  // archive sections go LAST so a broad word like "wheels" surfaces real entries
  // above the section landing page.
  const results = [...searchTools(query), ...searchDiagrams(query), ...dbResults, ...searchArchiveSections(query)].sort(
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
