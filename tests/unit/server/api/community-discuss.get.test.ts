/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// GET /api/community/discuss — "Discuss this" links to one forum topic per
// knowledgebase page (docs/plans/2026-10-05-community-discuss-links.md).
// The forum is a mocked fetch and the KV-backed `cache` storage is an
// in-memory map; nothing reaches the network.
// ---------------------------------------------------------------------------

const FORUM = 'https://community.example.com';
const SITE = 'https://www.classicminidiy.com';
const TORQUE_SEARCH = `${FORUM}/search?q=${encodeURIComponent('Classic Mini torque specifications')}`;
const TORQUE_TOPIC = `${FORUM}/t/classic-mini-torque-specifications/42`;
const CACHE_ID = 'community-discuss:technical-torque';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15';

/** KV stand-in: value + the ttl it was written with. */
const kv = new Map<string, { value: unknown; ttl?: number }>();
const storage = {
  getItem: vi.fn(async (id: string) => kv.get(id)?.value ?? null),
  setItem: vi.fn(async (id: string, value: unknown, opts?: { ttl?: number }) => {
    kv.set(id, { value, ttl: opts?.ttl });
  }),
};

const runtimeConfig = vi.fn();
const fetchMock = vi.fn();
let query: Record<string, unknown> = {};
let headers: Record<string, string | undefined> = {};

vi.stubGlobal('useRuntimeConfig', runtimeConfig);
vi.stubGlobal('useStorage', () => storage);
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('getQuery', () => query);
vi.stubGlobal('getHeader', (_event: unknown, name: string) => headers[name.toLowerCase()]);
vi.stubGlobal('getRequestIP', () => undefined);
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal('sendRedirect', (_event: unknown, location: string, status: number) => ({ location, status }));

const { _resetRateLimitStore } = await import('~~/server/utils/rateLimit');
const handler = (await import('~~/server/api/community/discuss.get')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

function configured(overrides: Record<string, unknown> = {}) {
  return {
    DISCOURSE_API_KEY: 'test-api-key',
    DISCOURSE_API_USERNAME: 'system',
    DISCOURSE_DISCUSS_CATEGORY_ID: '5',
    public: { discourseUrl: FORUM, siteUrl: SITE },
    ...overrides,
  };
}

function redirectResponse(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}
const notFound = () => new Response('{"errors":["not found"]}', { status: 404 });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const loggedText = () => (console.error as any).mock.calls.flat().join(' ');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  kv.clear();
  _resetRateLimitStore();
  query = { page: 'technical-torque' };
  headers = { 'user-agent': BROWSER_UA, 'cf-connecting-ip': '198.51.100.1' };
  runtimeConfig.mockReturnValue(configured());
  fetchMock.mockRejectedValue(new Error('unexpected fetch'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('page resolution', () => {
  it('sends an unknown key to the forum home and calls nothing', async () => {
    query = { page: 'admin' };
    expect(await handler(evt())).toEqual({ location: `${FORUM}/`, status: 302 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores inherited object keys and arrays', async () => {
    for (const page of ['constructor', '__proto__', ['technical-torque']]) {
      query = { page };
      expect((await handler(evt())).location).toBe(`${FORUM}/`);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the default forum when discourseUrl is not https', async () => {
    runtimeConfig.mockReturnValue(configured({ public: { discourseUrl: 'http://evil.example', siteUrl: SITE } }));
    query = { page: 'nope' };
    expect((await handler(evt())).location).toBe('https://community.classicminidiy.com/');
  });
});

describe('inert and guarded paths go to the forum search', () => {
  it.each([
    ['no API key', { DISCOURSE_API_KEY: '' }],
    ['no API username', { DISCOURSE_API_USERNAME: '' }],
    ['no category', { DISCOURSE_DISCUSS_CATEGORY_ID: '' }],
    ['a non-numeric category', { DISCOURSE_DISCUSS_CATEGORY_ID: 'tech-help' }],
  ])('%s', async (_label, overrides) => {
    runtimeConfig.mockReturnValue(configured(overrides));
    expect(await handler(evt())).toEqual({ location: TORQUE_SEARCH, status: 302 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['an unnamed crawler', 'SomeCrawler/1.0 (+https://example.com/crawl)'],
    ['a bare "bot" token', 'Mozilla/5.0 (compatible; Example bot)'],
    ['no user agent', undefined],
  ])('a crawler: %s', async (_label, ua) => {
    headers['user-agent'] = ua;
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a CUBOT phone is not a crawler', async () => {
    headers['user-agent'] =
      'Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
    fetchMock.mockResolvedValueOnce(redirectResponse('/t/classic-mini-torque-specifications/42.json'));
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
  });

  it('over the per-IP limit', async () => {
    fetchMock.mockImplementation(async () => redirectResponse('/t/classic-mini-torque-specifications/42.json'));
    for (let i = 0; i < 20; i++) {
      kv.clear();
      expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
    }
    kv.clear();
    fetchMock.mockClear();
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an unreadable cache sends the user to search and never calls the forum', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('KV unavailable'));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('an existing topic', () => {
  it('is found by external_id with the API headers and redirected to without .json', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse('/t/classic-mini-torque-specifications/42.json'));

    expect(await handler(evt())).toEqual({ location: TORQUE_TOPIC, status: 302 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${FORUM}/t/external_id/cmdiy-technical-torque.json`);
    expect(init.headers['Api-Key']).toBe('test-api-key');
    expect(init.headers['Api-Username']).toBe('system');
    expect(init.redirect).toBe('manual');
  });

  it('accepts an http:// Location (lost X-Forwarded-Proto) and rebuilds it on https', async () => {
    fetchMock.mockResolvedValueOnce(
      redirectResponse('http://community.example.com/t/classic-mini-torque-specifications/42.json')
    );
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
  });

  it('accepts a followed redirect (topic JSON)', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 42, slug: 'classic-mini-torque-specifications' }));
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
  });

  it('is kept in the shared cache for a year: the next click makes no forum call', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(`${FORUM}/t/classic-mini-torque-specifications/42.json`));
    await handler(evt());
    expect(kv.get(CACHE_ID)).toEqual({ value: { url: TORQUE_TOPIC }, ttl: 365 * 24 * 60 * 60 });

    fetchMock.mockClear();
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows a lookup redirect to another host', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse('https://evil.example/t/x/1.json'));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
  });
});

describe('a missing topic', () => {
  it('is created with a prefixed server-side title, URL, category and external_id', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ id: 900, topic_id: 42, topic_slug: 'classic-mini-torque-specifications' }));

    expect(await handler(evt())).toEqual({ location: TORQUE_TOPIC, status: 302 });

    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`${FORUM}/posts.json`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      title: 'Discussion: Classic Mini torque specifications',
      category: 5,
      embed_url: `${SITE}/technical/torque`,
      external_id: 'cmdiy-technical-torque',
    });
    expect(body.raw).toContain(`${SITE}/technical/torque`);
    expect(body.raw.length).toBeGreaterThanOrEqual(20);
  });

  it('ignores any title or url in the query string', async () => {
    query = { page: 'technical-torque', title: 'Buy cheap pills', url: 'https://spam.example' };
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ topic_id: 42, topic_slug: 'classic-mini-torque-specifications' }));
    await handler(evt());
    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body.title).toBe('Discussion: Classic Mini torque specifications');
    expect(JSON.stringify(body)).not.toContain('spam.example');
  });

  it('looks up again after a 422 (a parallel request created it)', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ errors: ['External ID has already been taken'] }, 422))
      .mockResolvedValueOnce(redirectResponse('/t/classic-mini-torque-specifications/42.json'));
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('a permanent 422 logs the forum reasons, caches the failure for 10 minutes and stops calling', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ errors: ['Title has already been used'] }, 422))
      .mockResolvedValueOnce(notFound());

    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(loggedText()).toContain('Title has already been used');
    expect(loggedText()).not.toContain('test-api-key');
    expect(kv.get(CACHE_ID)).toEqual({ value: { failed: true }, ttl: 600 });

    fetchMock.mockClear();
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to search when the post goes to the review queue, and caches that', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ action: 'enqueued', pending_post: { id: 1 } }));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(kv.get(CACHE_ID)?.value).toEqual({ failed: true });
  });
});

describe('forum failures never surface as an error page', () => {
  it.each([
    ['the forum is down', () => Promise.reject(new TypeError('fetch failed'))],
    ['the lookup answers 500', () => Promise.resolve(new Response('oops', { status: 500 }))],
    ['the lookup answers 403 (bad key)', () => Promise.resolve(new Response('{}', { status: 403 }))],
    ['the forum rate-limits us', () => Promise.resolve(new Response('{}', { status: 429 }))],
  ])('%s: search, and the failure is cached for 10 minutes', async (_label, impl) => {
    fetchMock.mockImplementation(impl);
    expect(await handler(evt())).toEqual({ location: TORQUE_SEARCH, status: 302 });
    expect(kv.get(CACHE_ID)).toEqual({ value: { failed: true }, ttl: 600 });

    fetchMock.mockClear();
    await handler(evt());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a failed create', async () => {
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
  });

  it('a cache write failure still redirects', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('KV write failed'));
    fetchMock.mockResolvedValueOnce(redirectResponse('/t/classic-mini-torque-specifications/42.json'));
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
  });

  it('stops after the total time budget and makes no further call', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.now();
    fetchMock.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 8_500);
      return notFound();
    });
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain('budget');
  });

  it('never logs the API key', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    await handler(evt());
    expect(loggedText()).toContain('technical-torque');
    expect(loggedText()).not.toContain('test-api-key');
  });
});
