/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// GET /api/community/discuss/topic — the topic id for the comment embed
// (docs/plans/2026-10-05-community-discuss-links.md, "Comment embeds").
// It only reads the KV mapping; it must never call the forum.
// ---------------------------------------------------------------------------

const kv = new Map<string, unknown>();
const storage = {
  getItem: vi.fn(async (id: string) => kv.get(id) ?? null),
  setItem: vi.fn(),
};
const fetchMock = vi.fn();
let query: Record<string, unknown> = {};
const setHeader = vi.fn();

vi.stubGlobal('useStorage', () => storage);
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('getQuery', () => query);
vi.stubGlobal('getHeader', (_e: unknown, name: string) => (name === 'cf-connecting-ip' ? '198.51.100.9' : undefined));
vi.stubGlobal('getRequestIP', () => undefined);
vi.stubGlobal('setHeader', setHeader);

const { _resetRateLimitStore } = await import('~~/server/utils/rateLimit');
const handler = (await import('~~/server/api/community/discuss/topic.get')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  kv.clear();
  _resetRateLimitStore();
  query = { page: 'technical-torque' };
});

describe('GET /api/community/discuss/topic', () => {
  it('a KV hit returns the topic id from the cached URL', async () => {
    kv.set('community-discuss:technical-torque', { url: 'https://community.example.com/t/discussion-torque/118' });
    expect(await handler(evt())).toEqual({ topicId: 118 });
    expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'public, max-age=300');
  });

  it.each([
    ['a miss', undefined],
    ['a cached failure', { failed: true }],
    ['a malformed entry', { url: 'https://community.example.com/latest' }],
    ['a garbage value', 'oops'],
  ])('%s returns null', async (_label, value) => {
    if (value !== undefined) kv.set('community-discuss:technical-torque', value);
    expect(await handler(evt())).toEqual({ topicId: null });
  });

  it('an unknown key returns null without reading KV', async () => {
    query = { page: '__proto__' };
    expect(await handler(evt())).toEqual({ topicId: null });
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('an unreadable store returns null', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('KV down'));
    expect(await handler(evt())).toEqual({ topicId: null });
  });

  it('never calls the forum and never writes', async () => {
    kv.set('community-discuss:technical-torque', { url: 'https://community.example.com/t/x/118' });
    await handler(evt());
    query = { page: 'archive-colors' };
    await handler(evt());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('over the per-IP limit returns null without reading KV', async () => {
    for (let i = 0; i < 60; i++) await handler(evt());
    storage.getItem.mockClear();
    expect(await handler(evt())).toEqual({ topicId: null });
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
