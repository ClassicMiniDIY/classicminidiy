/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// GET /api/community/discuss — "Discuss this" links to one forum topic per
// knowledgebase page (docs/plans/2026-10-05-community-discuss-links.md).
// The forum is a mocked fetch; nothing reaches the network.
// ---------------------------------------------------------------------------

const FORUM = 'https://community.example.com';
const SITE = 'https://www.classicminidiy.com';
const TORQUE_SEARCH = `${FORUM}/search?q=${encodeURIComponent('Classic Mini torque specifications')}`;
const TORQUE_TOPIC = `${FORUM}/t/classic-mini-torque-specifications/42`;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15';

const cacheStore = new Map<string, unknown>();
vi.mock('~~/server/utils/cache', () => ({
  getCached: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
  setCache: vi.fn(async (key: string, value: unknown) => {
    cacheStore.set(key, value);
  }),
}));

const runtimeConfig = vi.fn();
const fetchMock = vi.fn();
let query: Record<string, unknown> = {};
let headers: Record<string, string | undefined> = {};

vi.stubGlobal('useRuntimeConfig', runtimeConfig);
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  cacheStore.clear();
  _resetRateLimitStore();
  query = { page: 'technical-torque' };
  headers = { 'user-agent': BROWSER_UA, 'cf-connecting-ip': '198.51.100.1' };
  runtimeConfig.mockReturnValue(configured());
  fetchMock.mockRejectedValue(new Error('unexpected fetch'));
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
  });

  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['an unnamed crawler', 'SomeCrawler/1.0 (+https://example.com/crawl)'],
    ['no user agent', undefined],
  ])('a crawler: %s', async (_label, ua) => {
    headers['user-agent'] = ua;
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('over the per-IP limit', async () => {
    fetchMock.mockImplementation(async () => redirectResponse('/t/classic-mini-torque-specifications/42.json'));
    for (let i = 0; i < 20; i++) {
      cacheStore.clear();
      expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
    }
    cacheStore.clear();
    fetchMock.mockClear();
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

  it('accepts a followed redirect (topic JSON)', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 42, slug: 'classic-mini-torque-specifications' }));
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
  });

  it('is cached: the second click makes no forum call', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(`${FORUM}/t/classic-mini-torque-specifications/42.json`));
    await handler(evt());
    fetchMock.mockClear();
    expect((await handler(evt())).location).toBe(TORQUE_TOPIC);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never follows a lookup redirect off the forum origin', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse('https://evil.example/t/x/1.json'));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
  });
});

describe('a missing topic', () => {
  it('is created with server-side title, URL, category and external_id', async () => {
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
      title: 'Classic Mini torque specifications',
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
    expect(body.title).toBe('Classic Mini torque specifications');
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

  it('falls back to search when the 422 has no topic behind it (for example a duplicate title)', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ errors: ['Title has already been used'] }, 422))
      .mockResolvedValueOnce(notFound());
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
  });

  it('falls back to search when the post goes to the review queue', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ action: 'enqueued', pending_post: { id: 1 } }));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
    expect(cacheStore.size).toBe(0);
  });
});

describe('forum failures never surface as an error page', () => {
  it.each([
    ['the forum is down', () => Promise.reject(new TypeError('fetch failed'))],
    ['the lookup answers 500', () => Promise.resolve(new Response('oops', { status: 500 }))],
    ['the lookup answers 403 (bad key)', () => Promise.resolve(new Response('{}', { status: 403 }))],
    ['the forum rate-limits us', () => Promise.resolve(new Response('{}', { status: 429 }))],
  ])('%s', async (_label, impl) => {
    fetchMock.mockImplementation(impl);
    expect(await handler(evt())).toEqual({ location: TORQUE_SEARCH, status: 302 });
    expect(cacheStore.size).toBe(0);
  });

  it('a failed create', async () => {
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect((await handler(evt())).location).toBe(TORQUE_SEARCH);
  });

  it('never logs the API key', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    await handler(evt());
    const logged = (console.error as any).mock.calls.flat().join(' ');
    expect(logged).toContain('technical-torque');
    expect(logged).not.toContain('test-api-key');
  });
});
