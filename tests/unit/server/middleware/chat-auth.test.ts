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
  (globalThis as any).getRequestURL.mockReturnValue(new URL('https://example.com/api/chat'));
});

describe('chat-auth', () => {
  it('ignores routes other than /api/chat', async () => {
    (globalThis as any).getRequestURL.mockReturnValue(new URL('https://example.com/api/search'));
    const event = await run();
    expect(getChatAuth(event)).toBeUndefined();
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
    it('caches a resolved tier and reuses it without a second RPC', async () => {
      await run();
      expect(storage.setItem).toHaveBeenCalledOnce();
      const before = storage.setItem.mock.calls.length;
      const event = await run();
      expect(getChatAuth(event)).toEqual({ tier: 'member', userId: 'user-1' });
      expect(storage.setItem.mock.calls.length).toBe(before);
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
