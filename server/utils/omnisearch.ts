import { getServiceClient } from './supabase';
import { loadVisiblePartSources, searchVisibleParts } from './partsSearch';
import { resolveDirectAnswers } from './directAnswers';
import { getVideoIndex, searchVideoIndex } from './youtubeCatalog';
import { analyseQuery, type SearchResponse, type SearchResult, type Surface } from '../../shared/utils/searchIntent';
import { ToolCatalog, TOOL_CATEGORY_LABELS, ARCHIVE_SEARCH_SECTIONS } from '../../data/models/toolbox-catalog';
import type { Supplier } from '../../data/models/suppliers';
import suppliersData from '../../data/suppliers.json';
import wiringDiagrams from '../../data/wiringDiagrams.json';

/**
 * Omnisearch — one query across every surface (design S2/S3; unified search in
 * docs/plans/2026-09-14-unified-search.md).
 *
 * SIX sources are merged here rather than in the database:
 *   * `omnisearch()` in Postgres covers the data surfaces (wheels, colours,
 *     documents, registry, exchange listings, models).
 *   * The Toolbox is a static catalog in the web repo, so it is matched in
 *     process. Adding a calculator then never needs a migration, and tool
 *     matching can use synonyms ("CR", "lb-ft") that would be awkward to store.
 *   * Static archive content — wiring diagrams, and the reference sections that
 *     live in JSON rather than Postgres. Without these, searching "wiring" or
 *     "weights" returned nothing from the archive at all.
 *   * The parts archive, through `partsSearch.ts` so the licence kill switch
 *     is the same guard the parts route and the MCP tool run.
 *   * The supplier directory, static JSON.
 *   * Cole's YouTube channel, through the same KV-cached index the chat
 *     agent's `video-search` tool reads. Half of the recorded search misses
 *     were how-to jobs the channel already covers.
 *
 * Reads only, and every underlying row is already public, so this runs on the
 * service client without an auth requirement — the same reasoning as the
 * unauthenticated chat proxy.
 *
 * Misses are NOT recorded here any more. Recording on the search call meant
 * recording on the 180ms debounce, so `bad wo`, `bad wol` and `bad wolf` were
 * three Most Wanted candidates. The client now posts a miss to
 * `/api/search/miss` on a commit — Enter, a click, a close, or 1.5s idle.
 */

const MAX_QUERY_LENGTH = 120;

/**
 * Shared ranking for the in-process sources, ONE WORD AT A TIME.
 *
 * Per word: a hit in the name beats a hit in the synonyms beats a hit in the
 * summary (0..2). The per-word scores are summed and divided by the word
 * count, so a two-word query's best result competes fairly with a one-word
 * query's. Lower is better; null is no match.
 *
 * This used to test the whole query as one substring, which is why `comp
 * ratio` missed the Compression Ratio Calculator: no field contains that
 * phrase, but `comp` prefixes `compression` and `ratio` is a word of the name.
 * The same argument `fuzzyRank.ts` makes for the Fuse-backed sources applies.
 *
 * Every hit is a WORD-PREFIX match, never a substring anywhere. The first cut
 * matched substrings and `ratio` found fifteen suppliers through the word
 * `restoration`; a prefix cannot do that and still finds every abbreviation
 * a person types (`comp`, `carb`, `susp`).
 *
 * A one- or two-word query must match EVERY word; a longer one at least half,
 * rounded up, with each unmatched word costing `UNMATCHED_PENALTY`. Measured:
 * with half-matching on two words, `comp ratio` returned four tools and nine
 * suppliers, because `ratio` alone reaches the Gearbox Calculator and `comp`
 * alone reaches every shop selling "competition" or "components". Two words
 * are a phrase; three or more is a sentence with room for one typo.
 */
const UNMATCHED_PENALTY = 4;

function hasWordPrefix(text: string, word: string): boolean {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((part) => part.startsWith(word));
}

function rankWord(word: string, name: string, terms: string[], summary: string): number | null {
  if (hasWordPrefix(name, word)) return 0;
  if (terms.some((term) => hasWordPrefix(term, word))) return 1;
  if (hasWordPrefix(summary, word)) return 2;
  return null;
}

/**
 * Words that prefix-match everything and mean nothing: a one-letter word
 * reaches any name starting with that letter, and `the` reaches
 * `thermostat`. A six-word question needs three matches, so without this
 * `how do i bleed the brakes` pulled a tool in on `i` + `the` + `brake`.
 */
const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'my', 'do', 'is', 'i']);

function rank(query: string, name: string, terms: string[], summary: string): number | null {
  // Split the query the way `hasWordPrefix` splits the text, on anything that
  // is not a letter or digit. Splitting on whitespace alone left `lb-ft` as
  // one word that could never prefix `lb` or `ft`, so the synonym written for
  // exactly that spelling was unreachable by it.
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
  if (words.length === 0) return null;

  let matched = 0;
  let total = 0;
  for (const word of words) {
    const score = rankWord(word, name, terms, summary);
    if (score === null) {
      total += UNMATCHED_PENALTY;
    } else {
      matched += 1;
      total += score;
    }
  }
  const required = words.length <= 2 ? words.length : Math.ceil(words.length / 2);
  if (matched < required) return null;
  return total / words.length;
}

function searchTools(query: string): SearchResult[] {
  return ToolCatalog.map((tool) => {
    const score = rank(query, tool.name, tool.searchTerms, tool.summary);
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
  const groups = wiringDiagrams as unknown as Record<string, DiagramGroup>;
  const hits: { result: SearchResult; score: number }[] = [];

  for (const [key, group] of Object.entries(groups)) {
    if (!group?.items) continue;
    for (const item of group.items) {
      const years = item.from && item.to ? `${item.from}–${item.to}` : item.from ? `${item.from}+` : '';
      const score = rank(query, item.name, [group.title.toLowerCase(), 'wiring', 'diagram'], years);
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
  return ARCHIVE_SEARCH_SECTIONS.map((section) => {
    const score = rank(query, section.name, section.searchTerms, section.summary);
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

/**
 * The supplier directory. Static, curated, dated — see `data/models/suppliers.ts`
 * for what it deliberately is not. Tags and the region group are the synonyms,
 * so `body panels` and `japan` both find shops.
 */
function searchSuppliers(query: string): SearchResult[] {
  const suppliers = suppliersData as Supplier[];
  return suppliers
    .map((supplier) => {
      const terms = [...supplier.tags.map((tag) => tag.replace(/-/g, ' ')), supplier.group.replace(/-/g, ' ')];
      const score = rank(query, supplier.name, terms, supplier.speciality);
      return score === null ? null : { supplier, score };
    })
    .filter((hit): hit is { supplier: Supplier; score: number } => hit !== null)
    .sort((a, b) => a.score - b.score || a.supplier.name.localeCompare(b.supplier.name))
    .map(({ supplier }) => ({
      surface: 'suppliers' as const,
      id: supplier.id,
      title: supplier.name,
      subtitle: supplier.speciality,
      url: `/archive/suppliers#${supplier.id}`,
      icon: 'fas fa-store',
      tag: supplier.country,
      contributorUsername: null,
      verified: false,
    }));
}

/**
 * Cole's channel, via the index the chat agent already keeps in KV.
 *
 * A failed index read returns NO results rather than failing the search: the
 * other seven surfaces are worth more than a video row, and the index rebuilds
 * itself behind the SWR cache.
 *
 * Ranking is the chat tool's, unchanged. It is good on a sentence ("how do i
 * bleed the brakes" puts the bleeding video first) and loose on a clipped
 * word ("comp" reaches "Compact" and "Completion"). Measured: tightening
 * Fuse's threshold to 0.2 did not change the clipped-word case, because Fuse
 * prefix-matches inside a word regardless. Clipped words are `lookup`
 * queries, where videos rank last, so the noise sits below the fold. The `url` is the YouTube watch link — there is
 * no on-site video page (see "Not in this change" in the design doc) — and the
 * thumbnail travels in `icon` so the palette can render it where an icon goes.
 */
async function searchVideos(query: string, apiKey: string, limit: number): Promise<SearchResult[]> {
  try {
    const index = await getVideoIndex(apiKey);
    return searchVideoIndex(index, query, limit).map((video) => ({
      surface: 'videos' as const,
      id: video.videoId,
      title: video.title,
      subtitle: video.publishedAt.slice(0, 4),
      url: video.url,
      icon: video.thumbnail,
      tag: 'Video',
      contributorUsername: null,
      verified: false,
    }));
  } catch (error: any) {
    console.error('[search] video index unavailable:', error?.message ?? error);
    return [];
  }
}

/**
 * Omnisearch, shared by the HTTP route and the chat agent's `site-search` tool.
 *
 * This used to live entirely inside `server/api/search/index.get.ts`. It was
 * lifted here so the assistant can run the SAME search a visitor runs, rather
 * than a second implementation that drifts — the same import-do-not-reimplement
 * rule the MCP tools already follow for their calculators.
 *
 * Neither caller records a miss here. The visitor's palette posts one on a
 * commit (`/api/search/miss`); the agent's rewording of a question is never a
 * Most Wanted signal.
 */
export interface OmnisearchOptions {
  /**
   * The YouTube Data API key, which is the only thing the video surface
   * needs. Omitted by the chat agent's `site-search` tool: the agent has its
   * own `video-search` tool with the same index and a dedicated result rail,
   * and returning videos twice would fill both.
   */
  youtubeApiKey?: string;
}

export async function runOmnisearch(
  rawQuery: unknown,
  rawLimit?: unknown,
  { youtubeApiKey }: OmnisearchOptions = {}
): Promise<SearchResponse> {
  const query = String(rawQuery ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY_LENGTH);

  const intent = analyseQuery(query);

  if (query.length < 2) {
    return { query, intent, answers: [], total: 0, results: [], counts: {} };
  }

  const perSurfaceLimit = Math.min(Math.max(Number(rawLimit) || 20, 1), 60);
  const supabase = getServiceClient();

  // The network sources run together. The part-source list (the kill switch)
  // is read ONCE and handed to both the parts surface and the part answer,
  // which wait on it inside the same batch, so the round trips overlap the
  // RPC rather than queue behind it. Parts, videos and the direct answers
  // each swallow their own failure; only the core RPC failing makes search
  // unavailable.
  // The parts surface skips a query that is nothing but stop words: the
  // in-process ranking already ignores them, and `the` against a contains-
  // match on ten thousand descriptions is five random washers.
  const partsWorthSearching = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => word.length >= 2 && !STOP_WORDS.has(word));
  const partSources = loadVisiblePartSources(supabase);
  const [{ data, error }, partHits, videoResults, answers] = await Promise.all([
    supabase.rpc('omnisearch', { p_query: query, p_limit: perSurfaceLimit }),
    partsWorthSearching
      ? partSources.then((sources) => searchVisibleParts(supabase, query, perSurfaceLimit, sources))
      : Promise.resolve([]),
    youtubeApiKey ? searchVideos(query, youtubeApiKey, perSurfaceLimit) : Promise.resolve([]),
    partSources.then((sources) => resolveDirectAnswers(supabase, query, intent, { partSources: sources })),
  ]);

  if (error) {
    console.error('[search] omnisearch rpc failed:', error.message);
    throw createError({ statusCode: 502, statusMessage: 'Search is temporarily unavailable' });
  }

  const partResults: SearchResult[] = partHits.map((part) => ({
    surface: 'parts',
    id: part.slug,
    title: part.partNumber,
    subtitle: [part.description, part.system].filter(Boolean).join(' · ') || null,
    url: `/archive/parts?q=${encodeURIComponent(part.partNumber)}`,
    icon: 'fas fa-gear',
    tag: part.sourceName,
    contributorUsername: null,
    verified: false,
  }));

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

  // Order matters twice. Within a surface the in-process sources go first and
  // archive sections go LAST, so a broad word like "wheels" surfaces real
  // entries above the section landing page. Across surfaces the order is the
  // query's: a part number leads with parts, a how-to leads with videos.
  // `sort` is stable, so the within-surface order survives.
  const { surfaceOrder } = intent;
  const results = [
    ...searchTools(query),
    ...searchDiagrams(query),
    ...dbResults,
    ...partResults,
    ...searchSuppliers(query),
    ...videoResults,
    ...searchArchiveSections(query),
  ].sort((a, b) => surfaceOrder.indexOf(a.surface) - surfaceOrder.indexOf(b.surface));

  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.surface] = (acc[result.surface] ?? 0) + 1;
    return acc;
  }, {});

  return { query, intent, answers, total: results.length, results, counts };
}
