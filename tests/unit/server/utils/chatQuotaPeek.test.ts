/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// peekChatQuota — the search palette's read of the chat allowance.
//
// The property under test is that a PEEK NEVER SPENDS: it reads the counters
// `consumeChatQuota` writes, mints nothing, increments nothing, and reports
// "unknown" rather than a number it cannot vouch for.
// ---------------------------------------------------------------------------

let cookieValue: string | undefined;
let storageThrows = false;
let usageRows: { data: unknown; error: unknown } = { data: [], error: null };

const storage = {
  items: new Map<string, unknown>(),
  getItem: vi.fn(async (key: string) => {
    if (storageThrows) throw new Error('kv down');
    return storage.items.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: unknown) => {
    storage.items.set(key, value);
  }),
};

const rpc = vi.fn();
const usageQuery = { select: vi.fn(), eq: vi.fn(), gte: vi.fn() };
usageQuery.select.mockReturnValue(usageQuery);
usageQuery.eq.mockReturnValue(usageQuery);
usageQuery.gte.mockImplementation(async () => usageRows);
const from = vi.fn(() => usageQuery);

vi.stubGlobal(
  'useStorage',
  vi.fn(() => storage)
);
vi.stubGlobal(
  'getCookie',
  vi.fn(() => cookieValue)
);
vi.stubGlobal('setCookie', vi.fn());

vi.mock('~~/server/utils/supabase', () => ({ getServiceClient: vi.fn(() => ({ rpc, from })) }));
vi.mock('~~/server/utils/runtimeConfig', () => ({
  serverRuntimeConfig: vi.fn(() => ({ OG_IMAGE_SECRET: 'test-salt' })),
}));
let ipValue = 'unknown';
vi.mock('~~/server/utils/clientIp', () => ({ clientIp: vi.fn(() => ipValue) }));

const { peekChatQuota, consumeChatQuota } = await import('~~/server/utils/chatQuota');
const { setChatAuth } = await import('~~/server/utils/chatTiers');
const { CHAT_QUOTAS } = await import('~~/shared/utils/chatTiers');

function eventFor(tier: 'anonymous' | 'free' | 'member', userId?: string) {
  const event: any = { context: {} };
  setChatAuth(event, { tier, userId });
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storage.items.clear();
  storageThrows = false;
  cookieValue = 'anonsession0000000000000000abcd';
  usageRows = { data: [], error: null };
});

describe('anonymous', () => {
  it('reads the daily count for the session cookie without writing', async () => {
    storage.items.set(`chat-anon:c:${cookieValue}`, 7);
    const peek = await peekChatQuota(eventFor('anonymous'));
    expect(peek).toEqual({ tier: 'anonymous', used: 7, limit: CHAT_QUOTAS.anonymous.perDay });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(globalThis.setCookie).not.toHaveBeenCalled();
  });

  it('is at zero with no session cookie and no usable IP, and mints none', async () => {
    cookieValue = undefined;
    ipValue = 'unknown';
    const peek = await peekChatQuota(eventFor('anonymous'));
    expect(peek.used).toBe(0);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(globalThis.setCookie).not.toHaveBeenCalled();
  });

  it('reads the same IP bucket the spend uses when the browser kept no cookie', async () => {
    // A browser that drops Set-Cookie is counted on its salted IP by
    // consumeChatQuota. The peek must look there too, or it offers the bot to
    // someone the chat route is about to refuse.
    cookieValue = undefined;
    ipValue = '203.0.113.9';
    const spend: any = { context: {}, waitUntil: vi.fn() };
    setChatAuth(spend, { tier: 'anonymous' });
    await consumeChatQuota(spend);
    await consumeChatQuota(spend);
    const [bucket] = [...storage.items.keys()];
    expect(bucket).toMatch(/^chat-anon:i:/);

    const peek = await peekChatQuota(eventFor('anonymous'));
    expect(peek.used).toBe(2);
    expect(globalThis.setCookie).toHaveBeenCalledTimes(2); // the spends minted, the peek did not
  });

  it('reports unknown when the counter cannot be read', async () => {
    storageThrows = true;
    const peek = await peekChatQuota(eventFor('anonymous'));
    expect(peek.used).toBeNull();
    expect(peek.limit).toBe(CHAT_QUOTAS.anonymous.perDay);
  });
});

describe('signed in', () => {
  it('sums the month from chat_usage_daily rather than consuming through the RPC', async () => {
    usageRows = { data: [{ messages: 4 }, { messages: 9 }], error: null };
    const peek = await peekChatQuota(eventFor('member', 'user-1'));
    expect(peek).toEqual({ tier: 'member', used: 13, limit: CHAT_QUOTAS.member.perMonth });
    expect(from).toHaveBeenCalledWith('chat_usage_daily');
    expect(usageQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(usageQuery.gte).toHaveBeenCalledWith('day', expect.stringMatching(/^\d{4}-\d{2}-01$/));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports unknown on a read error and on a missing user id', async () => {
    usageRows = { data: null, error: { message: 'boom' } };
    expect((await peekChatQuota(eventFor('free', 'user-1'))).used).toBeNull();
    expect((await peekChatQuota(eventFor('free'))).used).toBeNull();
  });

  it('uses the tier limit for free and member alike', async () => {
    expect((await peekChatQuota(eventFor('free', 'u'))).limit).toBe(CHAT_QUOTAS.free.perMonth);
    expect((await peekChatQuota(eventFor('member', 'u'))).limit).toBe(CHAT_QUOTAS.member.perMonth);
  });
});
