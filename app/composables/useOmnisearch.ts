import { useDebounceFn } from '@vueuse/core';
import type { SearchResponse, SearchResult } from '../../server/api/search/index.get';

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
};

export const surfaceLabel = (surface: string) => SURFACE_LABELS[surface] ?? surface;

export const useOmnisearch = () => {
  const isOpen = useState('omnisearch:open', () => false);
  const query = useState('omnisearch:query', () => '');
  const results = useState<SearchResult[]>('omnisearch:results', () => []);
  const counts = useState<Record<string, number>>('omnisearch:counts', () => ({}));
  const loading = useState('omnisearch:loading', () => false);
  const highlighted = useState('omnisearch:highlighted', () => 0);
  const recent = useState<string[]>('omnisearch:recent', () => []);

  const router = useRouter();
  const { track } = useAnalytics();

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

  let requestToken = 0;

  const runSearch = async () => {
    const term = query.value.trim();
    highlighted.value = 0;

    if (term.length < 2) {
      results.value = [];
      counts.value = {};
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
    } catch {
      if (token !== requestToken) return;
      results.value = [];
      counts.value = {};
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
    isOpen.value = false;
  };

  const goTo = (result: SearchResult) => {
    rememberSearch(query.value);
    track('omnisearch_result_selected', { surface: result.surface, url: result.url });
    close();
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
    if (result) goTo(result);
    else viewAllResults();
  };

  return {
    isOpen,
    query,
    results,
    counts,
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
  };
};
