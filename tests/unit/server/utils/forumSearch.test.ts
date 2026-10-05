// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch } = vi.hoisted(() => {
  const mockFetch = vi.fn();
  (globalThis as any).$fetch = mockFetch;
  return { mockFetch };
});

const {
  FORUM_SEARCH_USER_AGENT,
  forumPostUrl,
  forumSearchConfig,
  normaliseForumCategory,
  normaliseForumQuery,
  parseForumSearch,
  resetForumSearchCache,
  searchForum,
} = await import('~~/server/utils/forumSearch');

const ORIGIN = 'https://community.classicminidiy.com';
const CONFIG = { origin: ORIGIN };

function post(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    username: 'someowner',
    name: 'Some Owner',
    avatar_template: '/letter_avatar_proxy/v4/letter/s/abc/{size}.png',
    created_at: '2026-10-05T14:35:19.955Z',
    like_count: 0,
    blurb: 'Start from the factory needle for the setup closest to yours.',
    post_number: 1,
    topic_id: 115,
    ...overrides,
  };
}

function topic(overrides: Record<string, any> = {}) {
  return {
    id: 115,
    title: 'Which SU needle should I run?',
    fancy_title: 'Which SU needle should I run?',
    slug: 'which-su-needle-should-i-run',
    posts_count: 3,
    reply_count: 0,
    archetype: 'regular',
    category_id: 5,
    has_accepted_answer: false,
    ...overrides,
  };
}

function body(posts: any[], topics: any[], error: string | null = null) {
  return {
    posts,
    topics,
    users: [],
    categories: [],
    tags: [],
    groups: [],
    grouped_search_result: { term: 'needle', error },
  };
}

/** A stand-in for Nitro's cache: memoises by the arguments, never stores a throw. */
function installMemoCache() {
  const store = new Map<string, unknown>();
  (globalThis as any).defineCachedFunction =
    (fn: any) =>
    async (...args: any[]) => {
      const key = JSON.stringify(args);
      if (store.has(key)) return store.get(key);
      const value = await fn(...args);
      store.set(key, value);
      return value;
    };
  resetForumSearchCache();
  return store;
}

beforeEach(() => {
  mockFetch.mockReset();
  installMemoCache();
});

describe('parseForumSearch', () => {
  it('puts threads with an accepted answer first, keeping relevance order inside each group', () => {
    const results = parseForumSearch(
      body(
        [post({ topic_id: 1 }), post({ topic_id: 2 }), post({ topic_id: 3 }), post({ topic_id: 4 })],
        [
          topic({ id: 1, title: 'A', slug: 'a' }),
          topic({ id: 2, title: 'B', slug: 'b', has_accepted_answer: true }),
          topic({ id: 3, title: 'C', slug: 'c' }),
          topic({ id: 4, title: 'D', slug: 'd', has_accepted_answer: true }),
        ]
      ),
      ORIGIN
    );
    expect(results.map((r) => r.title)).toEqual(['B', 'D', 'A', 'C']);
    expect(results.map((r) => r.solved)).toEqual([true, true, false, false]);
  });

  it('keeps one result per thread, the most relevant post', () => {
    // A long build log can match on many posts; it must not fill the list.
    const results = parseForumSearch(
      body(
        [
          post({ topic_id: 73, post_number: 40, blurb: 'first' }),
          post({ topic_id: 73, post_number: 2, blurb: 'second' }),
        ],
        [topic({ id: 73, slug: 'lilibet' })]
      ),
      ORIGIN
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.summary).toBe('first');
    expect(results[0]!.url).toBe(`${ORIGIN}/t/lilibet/73/40`);
  });

  it('links the post, and the topic itself for the first post', () => {
    expect(forumPostUrl(ORIGIN, 'slug', 9, 1)).toBe(`${ORIGIN}/t/slug/9`);
    expect(forumPostUrl(ORIGIN, 'slug', 9, 5)).toBe(`${ORIGIN}/t/slug/9/5`);
  });

  it('hands the model replies, a date and a clean excerpt, and no author', () => {
    const long = `Fish &amp; chips &quot;quoted&quot; ${'x'.repeat(400)}`;
    const [result] = parseForumSearch(body([post({ blurb: long })], [topic({ posts_count: 12 })]), ORIGIN);
    expect(result).toMatchObject({ replies: 11, date: '2026-10-05', solved: false });
    expect(result!.summary.startsWith('Fish & chips "quoted"')).toBe(true);
    expect(result!.summary.endsWith('…')).toBe(true);
    expect(result!.summary.length).toBeLessThanOrEqual(241);
    // The bot cites the thread, not the person.
    expect(JSON.stringify(result)).not.toMatch(/someowner|Some Owner|avatar/);
  });

  it('skips posts whose thread the response did not describe', () => {
    expect(parseForumSearch(body([post({ topic_id: 999 })], [topic()]), ORIGIN)).toEqual([]);
  });

  it('survives a malformed body', () => {
    expect(parseForumSearch(null, ORIGIN)).toEqual([]);
    expect(parseForumSearch({ posts: 'nope', topics: {} }, ORIGIN)).toEqual([]);
  });
});

describe('searchForum', () => {
  it('makes one anonymous request with a clear User-Agent and no API key', async () => {
    mockFetch.mockResolvedValueOnce(body([post()], [topic()]));
    const out = await searchForum(CONFIG, 'SU  Needle', '', 4);

    expect(out.outcome).toBe('ok');
    expect(out.results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe(`${ORIGIN}/search.json`);
    expect(options.query).toEqual({ q: 'su needle' });
    expect(options.headers['User-Agent']).toBe(FORUM_SEARCH_USER_AGENT);
    expect(JSON.stringify(options.headers).toLowerCase()).not.toContain('api-key');
    expect(options.retry).toBe(0);
    expect(options.timeout).toBeLessThanOrEqual(2000);
  });

  it('serves a repeated query from the cache', async () => {
    mockFetch.mockResolvedValue(body([post()], [topic()]));
    await searchForum(CONFIG, 'SU needle', '', 4);
    // Same query, different case and spacing: same normalised key.
    const second = await searchForum(CONFIG, '  su   NEEDLE ', '', 4);
    expect(second.results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('[GET] 429 Too Many Requests'));
    mockFetch.mockResolvedValueOnce(body([post()], [topic()]));

    const first = await searchForum(CONFIG, 'needle', '', 4);
    expect(first).toMatchObject({ outcome: 'unavailable', results: [] });
    expect(first.reason).toMatch(/429/);

    const second = await searchForum(CONFIG, 'needle', '', 4);
    expect(second.outcome).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('treats a timeout as unavailable, never as "no results"', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));
    const out = await searchForum(CONFIG, 'needle', '', 4);
    expect(out.outcome).toBe('unavailable');
  });

  it('treats Discourse load shedding as unavailable', async () => {
    // Discourse answers 200 with empty lists and an error set when overloaded.
    mockFetch.mockResolvedValueOnce(body([], [], 'The site is under extreme load'));
    const out = await searchForum(CONFIG, 'needle', '', 4);
    expect(out.outcome).toBe('unavailable');
  });

  it('scopes to a valid category slug, and ignores anything else', async () => {
    mockFetch.mockResolvedValue(body([], []));
    await searchForum(CONFIG, 'gearbox', 'tech-help', 4);
    expect(mockFetch.mock.calls[0]![1].query).toEqual({ q: 'gearbox category:tech-help' });

    await searchForum(CONFIG, 'gearbox', 'tech help; drop', 4);
    expect(mockFetch.mock.calls[1]![1].query).toEqual({ q: 'gearbox' });
  });

  it('caps the results at the requested limit', async () => {
    const posts = [1, 2, 3, 4, 5].map((id) => post({ topic_id: id }));
    const topics = [1, 2, 3, 4, 5].map((id) => topic({ id, title: `T${id}`, slug: `t${id}` }));
    mockFetch.mockResolvedValueOnce(body(posts, topics));
    const out = await searchForum(CONFIG, 'needle', '', 2);
    expect(out.results).toHaveLength(2);
  });

  it('does not call the forum for a term Discourse would reject', async () => {
    const out = await searchForum(CONFIG, ' a ', '', 4);
    expect(out).toEqual({ outcome: 'ok', results: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('normalisation', () => {
  it('normalises queries for the cache key', () => {
    expect(normaliseForumQuery('  HIF44\n Needle  ')).toBe('hif44 needle');
    expect(normaliseForumQuery('x'.repeat(500))).toHaveLength(120);
  });

  it('accepts only slug-shaped categories', () => {
    expect(normaliseForumCategory('Tech-Help')).toBe('tech-help');
    expect(normaliseForumCategory('')).toBe('');
    expect(normaliseForumCategory('a b')).toBe('');
    expect(normaliseForumCategory('#tech-help')).toBe('');
  });
});

describe('forumSearchConfig', () => {
  it('falls back to the default forum when the key is absent', () => {
    (globalThis as any).useRuntimeConfig = vi.fn(() => ({ public: {} }));
    expect(forumSearchConfig()).toEqual({ origin: ORIGIN });
  });

  it('uses the configured origin', () => {
    (globalThis as any).useRuntimeConfig = vi.fn(() => ({ public: { discourseUrl: 'https://forum.example.org/' } }));
    expect(forumSearchConfig()).toEqual({ origin: 'https://forum.example.org' });
  });

  it('returns null when the key is set but empty or not https', () => {
    (globalThis as any).useRuntimeConfig = vi.fn(() => ({ public: { discourseUrl: '' } }));
    expect(forumSearchConfig()).toBeNull();
    (globalThis as any).useRuntimeConfig = vi.fn(() => ({ public: { discourseUrl: 'http://forum.example.org' } }));
    expect(forumSearchConfig()).toBeNull();
  });
});
