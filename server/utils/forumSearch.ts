import type { H3Event } from 'h3';
import { serverRuntimeConfig } from './runtimeConfig';

/**
 * Read-only search of the Classic Mini DIY Community forum (Discourse), for the
 * chat agent's `forum-search` tool.
 *
 * Design doc: docs/plans/2026-10-05-chat-forum-search.md.
 *
 * THREE THINGS HERE ARE DELIBERATE:
 *
 *  1. ANONYMOUS, NO API KEY. The forum's admin API key has one per-site limit
 *     shared by the flair sync, the importers and the "Discuss this" route. A
 *     chat tool that the model fires at will must not spend it. The public
 *     `/search.json` endpoint returns exactly what a signed-out visitor sees.
 *
 *  2. ONE REQUEST PER CALL, CACHED. Anonymous search has its own per-IP and
 *     global limits on the forum, shared with every signed-out visitor. No
 *     paging and no topic fetch; results are cached for an hour in KV.
 *
 *  3. FAILURE THROWS INSIDE THE CACHE AND IS REPORTED OUTSIDE IT. A thrown
 *     error is never stored by `defineCachedFunction`, so a forum outage is not
 *     cached for an hour. `searchForum` turns it into `outcome: 'unavailable'`
 *     for the tool, which reports a degradation marker — "the forum has nothing"
 *     and "I could not look" must not look the same.
 */

/** Same default as `nuxt.config.ts` and `server/api/community/discuss.get.ts`. */
const DEFAULT_FORUM_URL = 'https://community.classicminidiy.com';

/** Hard ceiling on the outbound call, well inside the chat's own step budget. */
const TIMEOUT_MS = 2000;

/** One hour. A forum thread does not change answer that fast. */
const CACHE_SECONDS = 60 * 60;

/** Longest excerpt handed to the model, in characters. Discourse sends up to 300. */
const SUMMARY_LIMIT = 240;

/** Longest query sent to the forum or used in a cache key. */
export const FORUM_QUERY_MAX = 120;

/** Discourse's default `min_search_term_length`. A shorter term is a 400, not an empty result. */
export const FORUM_QUERY_MIN = 3;

/** Most results the tool may return. */
export const FORUM_RESULTS_MAX = 6;

/** Sent on every request so the forum's logs say where the traffic comes from. */
export const FORUM_SEARCH_USER_AGENT = 'ClassicMiniDIY-Chat/1.0 (+https://www.classicminidiy.com/chat)';

export interface ForumSearchConfig {
  /** The forum's https origin, no trailing slash. */
  origin: string;
}

export interface ForumSearchResult {
  title: string;
  /** Absolute link to the matching post. Never build a forum link by hand. */
  url: string;
  /** The matching post's excerpt. Not necessarily the accepted answer. */
  summary: string;
  /** The THREAD has an accepted answer. Says nothing about which post it is. */
  solved: boolean;
  /** Replies in the thread (`posts_count - 1`). */
  replies: number;
  /** YYYY-MM-DD of the matching post, or '' when Discourse did not say. */
  date: string;
}

export interface ForumSearchOutcome {
  outcome: 'ok' | 'unavailable';
  results: ForumSearchResult[];
  /** Set when `outcome` is `unavailable`. Short; logged, never shown verbatim. */
  reason?: string;
}

/** The https origin of a configured URL, or null. */
function forumHttpsOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The forum to search, or null when the tool must not be offered.
 *
 * An ABSENT key falls back to the default forum, like every other forum
 * consumer here, so a caller with no event (tests, scripts) gets the same tool
 * set production has. A key that is PRESENT but empty or not https is a
 * deliberate or broken setting, and the tool is withheld rather than pointed
 * somewhere it should not go.
 */
export function forumSearchConfig(event?: H3Event): ForumSearchConfig | null {
  const config = event ? serverRuntimeConfig(event) : useRuntimeConfig();
  const raw = (config as any)?.public?.discourseUrl;
  const origin = forumHttpsOrigin(raw === undefined ? DEFAULT_FORUM_URL : raw);
  return origin ? { origin } : null;
}

/** Trimmed, whitespace collapsed, lower-cased and capped. The cache key depends on it. */
export function normaliseForumQuery(query: string): string {
  return String(query ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, FORUM_QUERY_MAX)
    .trim();
}

/** A Discourse category slug, or '' when the value is not one. */
export function normaliseForumCategory(category: string): string {
  const value = String(category ?? '')
    .trim()
    .toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,49}$/.test(value) ? value : '';
}

/** The few entities a plain-text Discourse blurb can carry. */
function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Plain text, one line, capped. The ellipsis is load-bearing: without it the
 * model cannot tell a sentence that ended from one this cut off.
 */
function toSummary(blurb: unknown): string {
  if (typeof blurb !== 'string') return '';
  const text = decodeEntities(blurb.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT).trimEnd()}…` : text;
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** `/t/<slug>/<id>` for the first post (the same page), `/t/<slug>/<id>/<n>` otherwise. */
export function forumPostUrl(origin: string, slug: string, topicId: number, postNumber: number): string {
  const base = `${origin}/t/${encodeURIComponent(slug || 'topic')}/${topicId}`;
  return postNumber > 1 ? `${base}/${postNumber}` : base;
}

/**
 * Shape a `/search.json` body into results.
 *
 * One result per topic (the first, most relevant matching post), so one long
 * build log cannot fill the list. Then a STABLE partition: threads with an
 * accepted answer first, each group in Discourse's own relevance order.
 * Re-sorting by date or likes would throw that relevance away.
 *
 * Author fields are dropped on purpose: the bot cites the thread, not the person.
 */
export function parseForumSearch(body: any, origin: string): ForumSearchResult[] {
  const topics = new Map<number, any>();
  for (const topic of Array.isArray(body?.topics) ? body.topics : []) {
    const id = positiveInt(topic?.id);
    if (id) topics.set(id, topic);
  }

  const seen = new Set<number>();
  const results: ForumSearchResult[] = [];
  for (const post of Array.isArray(body?.posts) ? body.posts : []) {
    const topicId = positiveInt(post?.topic_id);
    const postNumber = positiveInt(post?.post_number);
    if (!topicId || !postNumber || seen.has(topicId)) continue;
    const topic = topics.get(topicId);
    // A topic the response did not describe has no title and no slug to link.
    if (!topic || typeof topic.title !== 'string' || !topic.title.trim()) continue;
    if (topic.archetype && topic.archetype !== 'regular') continue;
    seen.add(topicId);

    const postsCount = positiveInt(topic.posts_count) ?? 1;
    const created = typeof post.created_at === 'string' ? post.created_at : '';
    results.push({
      title: topic.title.trim(),
      url: forumPostUrl(origin, typeof topic.slug === 'string' ? topic.slug : '', topicId, postNumber),
      summary: toSummary(post.blurb),
      solved: topic.has_accepted_answer === true,
      replies: Math.max(postsCount - 1, 0),
      date: /^\d{4}-\d{2}-\d{2}/.test(created) ? created.slice(0, 10) : '',
    });
  }

  return [...results.filter((r) => r.solved), ...results.filter((r) => !r.solved)];
}

/**
 * The one HTTP call. THROWS on any failure, so the cache never stores one.
 *
 * `retry: 0` is deliberate, as in `shopifyCatalog.ts`: a slow forum answer is
 * worth less to a waiting reader than a fast "I could not check", and a retry
 * would spend a second unit of the anonymous search limit.
 */
export async function fetchForumSearch(origin: string, query: string, category: string): Promise<ForumSearchResult[]> {
  const term = category ? `${query} category:${category}` : query;
  const body = await $fetch<any>(`${origin}/search.json`, {
    query: { q: term },
    headers: { Accept: 'application/json', 'User-Agent': FORUM_SEARCH_USER_AGENT },
    timeout: TIMEOUT_MS,
    retry: 0,
  });
  if (!body || typeof body !== 'object' || !Array.isArray(body.posts)) {
    throw new Error('the forum returned an unexpected response');
  }
  // Discourse sheds load by answering 200 with empty lists and this error set.
  // That is "could not look", not "nothing matches", and must not be cached.
  if (body.grouped_search_result?.error) {
    throw new Error(String(body.grouped_search_result.error).slice(0, 200));
  }
  // Ranked BEFORE the cut, so a solved thread further down still makes the list.
  return parseForumSearch(body, origin).slice(0, FORUM_RESULTS_MAX);
}

/**
 * Built on FIRST CALL, not at module scope: `defineCachedFunction` is a Nitro
 * auto-import, and evaluating it while this module loads would break every
 * test that imports the agent tool set. Same reasoning as `getVideoIndex`.
 *
 * Default key: a hash of (origin, normalised query, category). No secret is in
 * any argument. `swr: false` so a stale entry is refetched, not served while a
 * background refresh runs unawaited in the Worker.
 */
let cachedSearch: ((origin: string, query: string, category: string) => Promise<ForumSearchResult[]>) | null = null;

function cachedForumSearch(origin: string, query: string, category: string): Promise<ForumSearchResult[]> {
  if (!cachedSearch) {
    cachedSearch = defineCachedFunction(fetchForumSearch, {
      maxAge: CACHE_SECONDS,
      swr: false,
      group: 'forum',
      name: 'search',
    });
  }
  return cachedSearch(origin, query, category);
}

/** Test seam. Drops the memoised wrapper so a suite can swap the Nitro helper. */
export function resetForumSearchCache(): void {
  cachedSearch = null;
}

/** Search the forum. Never throws; see the module note on outcomes. */
export async function searchForum(
  config: ForumSearchConfig,
  query: string,
  category: string,
  limit: number
): Promise<ForumSearchOutcome> {
  const term = normaliseForumQuery(query);
  if (term.length < FORUM_QUERY_MIN) return { outcome: 'ok', results: [] };
  const max = Math.min(Math.max(Math.trunc(limit) || 1, 1), FORUM_RESULTS_MAX);
  try {
    const results = await cachedForumSearch(config.origin, term, normaliseForumCategory(category));
    return { outcome: 'ok', results: results.slice(0, max) };
  } catch (error: any) {
    // Timeout, DNS, 429, non-2xx, malformed JSON, load shedding: one outcome.
    return {
      outcome: 'unavailable',
      results: [],
      reason: error?.message ? String(error.message).slice(0, 200) : 'the forum did not respond',
    };
  }
}
