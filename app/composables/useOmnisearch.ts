import { useDebounceFn } from '@vueuse/core';
import {
  analyseQuery,
  type DirectAnswer,
  type SearchIntent,
  type SearchResponse,
  type SearchResult,
} from '~~/shared/utils/searchIntent';

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

/** The shape `GET /api/chat/quota` returns; mirrored here so `app/` never imports from `server/`. */
export interface ChatQuotaPeek {
  tier: 'anonymous' | 'free' | 'member';
  used: number | null;
  limit: number;
}

/**
 * What the Ask row does, from the quota peek.
 *
 * `unknown` (peek pending or failed) reads as `available`: the chat route
 * still enforces the real ceiling, and a row that refuses on a guess would
 * hide the bot from someone who could use it.
 */
export type AskState = 'available' | 'anon-limit' | 'free-limit' | 'member-limit';

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
  /** Direct answers for the current query, at most two. Rendered before any group. */
  const answers = useState<DirectAnswer[]>('omnisearch:answers', () => []);
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
   * The chat allowance, read once per palette open, never blocking a render.
   * Client-only state: the tier depends on the Supabase session in
   * localStorage, so this is null during SSR and on the first client paint,
   * and the Ask row renders its "available" copy until it arrives.
   */
  const quota = useState<ChatQuotaPeek | null>('omnisearch:quota', () => null);

  const askState = computed<AskState>(() => {
    const peek = quota.value;
    if (!peek || peek.used === null || peek.used < peek.limit) return 'available';
    if (peek.tier === 'anonymous') return 'anon-limit';
    if (peek.tier === 'free') return 'free-limit';
    return 'member-limit';
  });

  const loadQuota = async () => {
    if (typeof window === 'undefined') return;
    try {
      // Constructed here, on the client, on demand — not in every
      // useOmnisearch() call, which runs during SSR of every page for the
      // header, the hero and the results page and would build a client each.
      const { data } = await useSupabase().auth.getSession();
      const accessToken = data.session?.access_token;
      quota.value = await $fetch<ChatQuotaPeek>('/api/chat/quota', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
    } catch {
      // Unknown reads as available; the chat route holds the real ceiling.
      quota.value = null;
    }
  };

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
   *
   * Direct answers sit ABOVE this list in the keyboard order: `highlighted`
   * counts answers first (0..answers.length-1), then these results. The
   * offset is what lets the answer cards be arrow-key rows without being
   * `SearchResult`s.
   */
  const flatResults = computed(() => groups.value.flatMap((group) => group.results));
  const answerOffset = computed(() => answers.value.length);
  const rowCount = computed(() => answerOffset.value + flatResults.value.length);

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
    if (results.value.length > 0 || answers.value.length > 0) return;
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
      answers.value = [];
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
      const previousAnswerKeys = new Set(answers.value.map((answer) => `${answer.kind}:${answer.url}`));
      answers.value = response.answers ?? [];
      searchedQuery.value = term;
      // Once per distinct card, not once per debounce: "flywheel torque" shows
      // the same torque card from "flywheel" onward, and eight `shown` events
      // for one look would deflate every shown-to-selected ratio by typing speed.
      for (const answer of answers.value) {
        if (!previousAnswerKeys.has(`${answer.kind}:${answer.url}`)) {
          track('omnisearch_answer_shown', { kind: answer.kind });
        }
      }
      if (response.results.length === 0 && answers.value.length === 0) {
        missIdleTimer = setTimeout(() => commitCurrentMiss('idle'), MISS_IDLE_MS);
      }
    } catch {
      if (token !== requestToken) return;
      results.value = [];
      counts.value = {};
      answers.value = [];
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
    // After the open, never before it: the peek is one request the visitor
    // does not wait on.
    void loadQuota();
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

  /**
   * The Ask row: hand the query to the bot, or to the step that unlocks it.
   *
   * `/chat?message=` is the same handoff the retired homepage chat box used;
   * `source=omnisearch` lets `chat_message_sent` be split by origin. A spent
   * anonymous allowance goes to sign-in with the chat as the return path; a
   * spent free allowance goes to the membership page; a spent member
   * allowance has nowhere to go and the row says so.
   */
  const askBot = (rawTerm: string = query.value, { inline = false } = {}): boolean => {
    const term = rawTerm.trim();
    if (term.length < 2) return false;
    const state = askState.value;
    // The page passes its own term; the intent is recomputed from it rather
    // than read from the palette's state, which may belong to another query.
    const termIntent = term === query.value.trim() ? intent.value : analyseQuery(term);
    track('omnisearch_ask_selected', {
      kind: termIntent.kind,
      position: termIntent.askPosition,
      quota_state: state,
      results: totalResults.value,
      inline,
    });
    if (state === 'member-limit') return false;
    rememberSearch(term);
    close();
    if (state === 'anon-limit') {
      router.push({
        path: '/login',
        query: { redirect: `/chat?message=${encodeURIComponent(term)}&source=omnisearch` },
      });
      return false;
    }
    if (state === 'free-limit') {
      router.push('/membership');
      return false;
    }
    // `inline`: the caller (the /search page) answers in place. True tells it
    // the quota allowed the ask; the spent states above already navigated to
    // their offer instead.
    if (inline) return true;
    router.push({ path: '/chat', query: { message: term, source: 'omnisearch' } });
    return false;
  };

  /** An answer card's "open": the page that holds the thing, tracked by kind. */
  const goToAnswer = (answer: DirectAnswer) => {
    rememberSearch(query.value);
    track('omnisearch_answer_selected', { kind: answer.kind });
    close();
    router.push(answer.url);
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
    const total = rowCount.value;
    if (total === 0) return;
    highlighted.value = (highlighted.value + delta + total) % total;
  };

  const selectHighlighted = () => {
    const answer = answers.value[highlighted.value];
    if (answer) {
      goToAnswer(answer);
      return;
    }
    const result = flatResults.value[highlighted.value - answerOffset.value];
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
    answers,
    answerOffset,
    quota,
    askState,
    loadQuota,
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
    goToAnswer,
    askBot,
    viewAllResults,
    moveHighlight,
    selectHighlighted,
    rememberSearch,
    loadRecent,
    commitMiss,
  };
};
