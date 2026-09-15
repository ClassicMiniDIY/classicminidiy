import { useDebounceFn } from '@vueuse/core';
import { analyseQuery, type SearchIntent, type SearchResponse, type SearchResult } from '~~/shared/utils/searchIntent';

export type { SearchResult };

/**
 * Omnisearch state (design S2).
 *
 * The palette is mounted ONCE in app.vue and opened from anywhere — the header
 * input, the hero input on the homepage, the mobile search icon, or the `/`
 * hotkey. Everything therefore lives in `useState` so those call sites share one
 * instance instead of each rendering their own overlay.
 */

const RECENT_KEY = 'cmdiy:recent-searches';
const RECENT_LIMIT = 5;

/**
 * The palette shows at most this many rows per surface. It is a browsing aid,
 * not the results page — sixteen wheels in a dropdown buries the one Exchange
 * listing and the one archive doc underneath it. The group label keeps showing
 * the TRUE total, and "View all N results" goes to /search, which is unfiltered.
 */
const PALETTE_ROWS_PER_SURFACE = 5;

export interface SearchGroup {
  surface: string;
  label: string;
  /** Capped to PALETTE_ROWS_PER_SURFACE. */
  results: SearchResult[];
  /** How many this surface actually matched — what the group label shows. */
  total: number;
}

const SURFACE_LABELS: Record<string, string> = {
  tools: 'Tools',
  wheels: 'Wheels',
  archive: 'Archive',
  models: 'Models',
  exchange: 'Exchange',
  parts: 'Parts',
  suppliers: 'Suppliers',
  videos: 'Videos',
};

/**
 * How long an empty result set sits before it counts as a miss.
 *
 * Misses feed Most Wanted, and they used to be recorded by the search call
 * itself on the 180ms debounce — so `bad wo`, `bad wol` and `bad wolf` were
 * three rows. A miss is now COMMITTED: on Enter, on close, or after this much
 * idle time with nothing on screen. Long enough to finish a word; short
 * enough that walking away still counts.
 */
const MISS_IDLE_MS = 1500;

export type MissTrigger = 'enter' | 'close' | 'idle' | 'page';

export const surfaceLabel = (surface: string) => SURFACE_LABELS[surface] ?? surface;

/**
 * Per-module, not per-call. `useOmnisearch()` is called from four components
 * (header, hero, mobile icon, the palette) while every piece of state is a
 * shared `useState`; a timer or request token held in the closure of one
 * call could not be cleared by another. These are the only two mutable
 * values that are not `useState`, so they live here as singletons.
 */
let requestToken = 0;
let missIdleTimer: ReturnType<typeof setTimeout> | null = null;

export const useOmnisearch = () => {
  const isOpen = useState('omnisearch:open', () => false);
  const query = useState('omnisearch:query', () => '');
  const results = useState<SearchResult[]>('omnisearch:results', () => []);
  const counts = useState<Record<string, number>>('omnisearch:counts', () => ({}));
  const loading = useState('omnisearch:loading', () => false);
  const highlighted = useState('omnisearch:highlighted', () => 0);
  const recent = useState<string[]>('omnisearch:recent', () => []);
  const intent = useState<SearchIntent>('omnisearch:intent', () => analyseQuery(''));
  /**
   * Queries already posted as misses this session. A miss committed by the
   * idle timer and then again by Enter, or by Enter and then by the `/search`
   * page that Enter navigates to, is one miss.
   */
  const committedMisses = useState<string[]>('omnisearch:committed-misses', () => []);
  /**
   * The query the current `results` belong to. `query` runs ahead of it by up
   * to the debounce: a miss may only be committed for a term that was
   * actually searched, or "bad w" (searched, empty) plus "olf" (typed, not
   * yet searched) commits "bad wolf" without ever asking.
   */
  const searchedQuery = useState('omnisearch:searched-query', () => '');

  const router = useRouter();
  const { track, trackOutbound } = useAnalytics();

  /**
   * Results grouped by surface, preserving the order the API returned them in
   * (tools → wheels → archive → models → exchange). Group labels render as
   * `WHEELS · 3`.
   */
  const groups = computed<SearchGroup[]>(() => {
    const bySurface = new Map<string, SearchResult[]>();
    for (const result of results.value) {
      const bucket = bySurface.get(result.surface);
      if (bucket) bucket.push(result);
      else bySurface.set(result.surface, [result]);
    }
    return [...bySurface.entries()].map(([surface, items]) => ({
      surface,
      label: surfaceLabel(surface),
      results: items.slice(0, PALETTE_ROWS_PER_SURFACE),
      total: items.length,
    }));
  });

  /**
   * Flat list in render order — what the arrow keys walk. Built from the CAPPED
   * group results, so keyboard navigation can never land on a row that is not
   * on screen.
   */
  const flatResults = computed(() => groups.value.flatMap((group) => group.results));

  /** Every match, capped or not — drives the "View all N results" count. */
  const totalResults = computed(() => results.value.length);

  const loadRecent = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      recent.value = raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_LIMIT) : [];
    } catch {
      recent.value = [];
    }
  };

  const rememberSearch = (term: string) => {
    if (typeof window === 'undefined') return;
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    const next = [trimmed, ...recent.value.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
      0,
      RECENT_LIMIT
    );
    recent.value = next;
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode / quota — recents are a nicety, never a hard failure */
    }
  };

  const clearMissTimer = () => {
    if (missIdleTimer) clearTimeout(missIdleTimer);
    missIdleTimer = null;
  };

  /**
   * Record a zero-result query as a Most Wanted signal, once.
   *
   * Fire-and-forget: telemetry never slows or fails the thing the visitor is
   * doing. Under three characters is the RPC's own floor, mirrored here so a
   * rejected call never costs a request.
   */
  const commitMiss = (term: string, trigger: MissTrigger) => {
    const trimmed = term.trim();
    if (trimmed.length < 3) return;
    const key = trimmed.toLowerCase();
    if (committedMisses.value.includes(key)) return;
    committedMisses.value = [...committedMisses.value, key];
    track('omnisearch_miss_committed', { kind: analyseQuery(trimmed).kind, trigger });
    $fetch('/api/search/miss', { method: 'POST', body: { q: trimmed } }).catch(() => {});
  };

  /** The current query is a miss if the last response for it came back empty. */
  const commitCurrentMiss = (trigger: MissTrigger) => {
    clearMissTimer();
    if (loading.value) return;
    const term = query.value.trim();
    if (term.length < 2 || term !== searchedQuery.value) return;
    if (results.value.length > 0) return;
    commitMiss(term, trigger);
  };

  const runSearch = async () => {
    const term = query.value.trim();
    highlighted.value = 0;
    clearMissTimer();
    intent.value = analyseQuery(term);

    if (term.length < 2) {
      results.value = [];
      counts.value = {};
      searchedQuery.value = '';
      loading.value = false;
      return;
    }

    // Monotonic token instead of AbortController: responses can arrive out of
    // order while typing, and the only thing that matters is that a stale one
    // never overwrites a fresher one.
    const token = ++requestToken;
    loading.value = true;

    try {
      const response = await $fetch<SearchResponse>('/api/search', { query: { q: term } });
      if (token !== requestToken) return;
      results.value = response.results;
      counts.value = response.counts;
      intent.value = response.intent;
      searchedQuery.value = term;
      if (response.results.length === 0) {
        missIdleTimer = setTimeout(() => commitCurrentMiss('idle'), MISS_IDLE_MS);
      }
    } catch {
      if (token !== requestToken) return;
      results.value = [];
      counts.value = {};
      // A failed search is not a miss: nothing was looked up.
      searchedQuery.value = '';
    } finally {
      if (token === requestToken) loading.value = false;
    }
  };

  const debouncedSearch = useDebounceFn(runSearch, 180);

  const open = (initialQuery = '') => {
    loadRecent();
    if (initialQuery) query.value = initialQuery;
    isOpen.value = true;
    track('omnisearch_opened', { has_query: Boolean(query.value) });
    if (query.value.trim().length >= 2) runSearch();
  };

  const close = () => {
    commitCurrentMiss('close');
    isOpen.value = false;
  };

  /**
   * A video result is an outbound link to YouTube — there is no on-site video
   * page — so it opens in a new tab rather than through the router, and is
   * tracked as outbound like the chat's video cards.
   */
  const goTo = (result: SearchResult) => {
    rememberSearch(query.value);
    const position = flatResults.value.findIndex((item) => item.surface === result.surface && item.id === result.id);
    track('omnisearch_result_selected', {
      surface: result.surface,
      url: result.url,
      kind: intent.value.kind,
      position,
    });
    close();
    if (result.surface === 'videos') {
      trackOutbound({ destination: result.url, label: result.title, group: 'omnisearch_video' });
      if (typeof window !== 'undefined') window.open(result.url, '_blank', 'noopener');
      return;
    }
    router.push(result.url);
  };

  const viewAllResults = () => {
    const term = query.value.trim();
    if (!term) return;
    rememberSearch(term);
    track('omnisearch_view_all', { query: term, results: totalResults.value });
    close();
    router.push({ path: '/search', query: { q: term } });
  };

  const moveHighlight = (delta: number) => {
    const total = flatResults.value.length;
    if (total === 0) return;
    highlighted.value = (highlighted.value + delta + total) % total;
  };

  const selectHighlighted = () => {
    const result = flatResults.value[highlighted.value];
    if (result) {
      goTo(result);
      return;
    }
    commitCurrentMiss('enter');
    viewAllResults();
  };

  return {
    isOpen,
    query,
    results,
    counts,
    intent,
    groups,
    flatResults,
    totalResults,
    loading,
    highlighted,
    recent,
    open,
    close,
    runSearch,
    debouncedSearch,
    goTo,
    viewAllResults,
    moveHighlight,
    selectHighlighted,
    rememberSearch,
    loadRecent,
    commitMiss,
  };
};
