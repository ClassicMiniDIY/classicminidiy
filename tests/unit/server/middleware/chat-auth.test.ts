/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// server/middleware/chat-auth.ts
//
// The property under test is the FAIL DIRECTION, which is the deliberate
// opposite of mcp-auth's. That gate protects a paid API, so uncertainty means
// deny. This one fronts a public assistant whose whole reason to exist is
// working without a login, so every uncertainty must resolve DOWNWARD to a
// working tier. A regression here would not throw — it would quietly 503 the
// chat during a Supabase blip, or hold a paying member at the free quota.
// ---------------------------------------------------------------------------

let extractedToken: string | undefined;
let getUserResult: any = { data: { user: { id: 'user-1' } }, error: null };
let rpcResult: any = { data: true, error: null };
let getUserThrows = false;
let isBanned = false;

const storage = {
  items: new Map<string, unknown>(),
  getItem: vi.fn(async (k: string) => storage.items.get(k) ?? null),
  setItem: vi.fn(async (k: string, v: unknown) => {
    storage.items.set(k, v);
  }),
};

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal(
  'getRequestURL',
  vi.fn(() => new URL('https://example.com/api/chat'))
);
vi.stubGlobal(
  'useStorage',
  vi.fn(() => storage)
);

vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => {
    if (getUserThrows) throw new Error('supabase unreachable');
    return {
      auth: { getUser: vi.fn(async () => getUserResult) },
      rpc: vi.fn(async () => rpcResult),
    };
  }),
}));
vi.mock('~/server/utils/userAuth', () => ({
  extractAccessToken: vi.fn(() => extractedToken),
  isUserBanned: vi.fn(async () => isBanned),
}));

const handler = (await import('~~/server/middleware/chat-auth')).default;
const { getChatAuth } = await import('~~/server/utils/chatTiers');

function run() {
  const event: any = { context: {} };
  return handler(event).then(() => event);
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.items.clear();
  extractedToken = 'token-abc';
  getUserResult = { data: { user: { id: 'user-1' } }, error: null };
  rpcResult = { data: true, error: null };
  getUserThrows = false;
  isBanned = false;
  (globalThis as any).getRequestURL.mockReturnValue(new URL('https://example.com/api/chat'));
});

describe('chat-auth', () => {
  it('ignores routes other than /api/chat', async () => {
    (globalThis as any).getRequestURL.mockReturnValue(new URL('https://example.com/api/search'));
    const event = await run();
    expect(getChatAuth(event)).toBeUndefined();
  });

  it('matches the chat route EXACTLY, not by prefix', async () => {
    // A prefix guard would silently apply chat tiering and the chat quota to a
    // future /api/chat-export, visible only as unexplained 429s.
    (globalThis as any).getRequestURL.mockReturnValue(new URL('https://example.com/api/chat-export'));
    const event = await run();
    expect(getChatAuth(event)).toBeUndefined();
  });

  it('drops a banned account to the anonymous tier', async () => {
    // A valid access token keeps working until it expires even after the ban,
    // so without this a banned scammer keeps the member allowance on a route
    // that spends real money.
    isBanned = true;
    const event = await run();
    expect(getChatAuth(event)).toEqual({ tier: 'anonymous' });
  });

  it('resolves an active membership to the member tier', async () => {
    const event = await run();
    expect(getChatAuth(event)).toEqual({ tier: 'member', userId: 'user-1' });
  });

  it('resolves a signed-in non-member to the free tier', async () => {
    rpcResult = { data: false, error: null };
    const event = await run();
    expect(getChatAuth(event)).toEqual({ tier: 'free', userId: 'user-1' });
  });

  describe('failing OPEN', () => {
    it('treats a missing token as anonymous without touching the database', async () => {
      extractedToken = undefined;
      const event = await run();
      expect(getChatAuth(event)).toEqual({ tier: 'anonymous' });
      expect(storage.getItem).not.toHaveBeenCalled();
    });

    it('treats an unverifiable token as anonymous, not as an error', async () => {
      getUserResult = { data: { user: null }, error: { message: 'jwt expired' } };
      const event = await run();
      expect(getChatAuth(event)).toEqual({ tier: 'anonymous' });
    });

    it('degrades to anonymous when Supabase is unreachable, rather than throwing', async () => {
      // The whole point: an outage must not take the assistant down. mcp-auth
      // answers 503 here; this one must not.
      getUserThrows = true;
      const event = await run();
      expect(getChatAuth(event)).toEqual({ tier: 'anonymous' });
    });

    it('degrades a member to free when the membership RPC errors', async () => {
      // The account is proven; only the perk is in question, so the floor is
      // 'free' rather than 'anonymous'.
      rpcResult = { data: null, error: { message: 'rpc exploded' } };
      const event = await run();
      expect(getChatAuth(event)).toEqual({ tier: 'free', userId: 'user-1' });
    });

    it('never throws, whatever happens', async () => {
      getUserThrows = true;
      await expect(run()).resolves.toBeTruthy();
    });
  });

  describe('caching', () => {
    it('serves a cache hit without calling getUser at all', async () => {
      // The cache is keyed on a hash of the TOKEN and checked before getUser,
      // so a repeat request inside the TTL costs no Supabase round trip. Keying
      // on the user id meant the expensive call ran every time and the cache
      // only ever saved the cheap RPC.
      await run();
      expect(storage.setItem).toHaveBeenCalledOnce();
      const cacheKey = storage.setItem.mock.calls[0]![0] as string;
      // The plaintext token must never appear in a storage key.
      expect(cacheKey).not.toContain('token-abc');

      getUserThrows = true; // any getUser call would now throw
      const event = await run();
      expect(getChatAuth(event)).toEqual({ tier: 'member', userId: 'user-1' });
    });

    it('does NOT cache a degraded resolution', async () => {
      // Caching { tier: 'free' } for a member during a transient RPC hiccup
      // would hold them at the lower quota for the full TTL.
      rpcResult = { data: null, error: { message: 'transient' } };
      await run();
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });
});
