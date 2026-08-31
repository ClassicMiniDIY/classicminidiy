/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// server/utils/chatQuota.ts
//
// Two properties matter beyond the arithmetic:
//
//   1. Exhausting a quota is a 429, NEVER a 401. /api/chat must stay usable by
//      everyone; a 401 would break the surface's reason to exist.
//   2. Every failure path ALLOWS the request. A counter that cannot be read
//      must degrade the ceiling, not the assistant.
// ---------------------------------------------------------------------------

let rpcResult: any = { data: [{ allowed: true, used: 1, monthly_limit: 30 }], error: null };
let rpcThrows = false;
let cookieValue: string | undefined;
let storageThrows = false;
let clientIpValue: string | undefined = '203.0.113.9';

const storage = {
  items: new Map<string, unknown>(),
  getItem: vi.fn(async (k: string) => {
    if (storageThrows) throw new Error('kv down');
    return storage.items.get(k) ?? null;
  }),
  setItem: vi.fn(async (k: string, v: unknown) => {
    if (storageThrows) throw new Error('kv down');
    storage.items.set(k, v);
  }),
};

const rpc = vi.fn(async () => {
  if (rpcThrows) throw new Error('pg down');
  return rpcResult;
});

vi.stubGlobal(
  'useStorage',
  vi.fn(() => storage)
);
vi.stubGlobal(
  'getCookie',
  vi.fn(() => cookieValue)
);
vi.stubGlobal('setCookie', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.message);
  Object.assign(e, opts);
  return e;
});

vi.mock('~/server/utils/supabase', () => ({ getServiceClient: vi.fn(() => ({ rpc })) }));
vi.mock('~/server/utils/runtimeConfig', () => ({
  serverRuntimeConfig: vi.fn(() => ({ OG_IMAGE_SECRET: 'test-salt' })),
}));

const { consumeChatQuota, quotaExhaustedError, recordChatTokens } = await import('~~/server/utils/chatQuota');
const { setChatAuth } = await import('~~/server/utils/chatTiers');
const { CHAT_QUOTAS } = await import('~~/shared/utils/chatTiers');

function eventFor(tier: 'anonymous' | 'free' | 'member', userId?: string) {
  const event: any = { context: {}, waitUntil: vi.fn() };
  setChatAuth(event, { tier, userId });
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.items.clear();
  rpcResult = { data: [{ allowed: true, used: 1, monthly_limit: 30 }], error: null };
  rpcThrows = false;
  storageThrows = false;
  cookieValue = 'anonsession0000000000000000abcd';
  clientIpValue = '203.0.113.9';
});

describe('anonymous quota', () => {
  it('counts in KV against the session cookie, never in Postgres', async () => {
    const event = eventFor('anonymous');
    const verdict = await consumeChatQuota(event);
    expect(verdict.allowed).toBe(true);
    expect(verdict.used).toBe(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses once the daily ceiling is passed', async () => {
    const limit = CHAT_QUOTAS.anonymous.perDay!;
    const event = eventFor('anonymous');
    for (let i = 0; i < limit; i++) {
      expect((await consumeChatQuota(event)).allowed).toBe(true);
    }
    expect((await consumeChatQuota(event)).allowed).toBe(false);
  });

  it('mints a session cookie when none is present', async () => {
    cookieValue = undefined;
    await consumeChatQuota(eventFor('anonymous'));
    expect((globalThis as any).setCookie).toHaveBeenCalledOnce();
    const opts = (globalThis as any).setCookie.mock.calls[0]![3];
    // httpOnly so a page script cannot read or forge the counter's key.
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true });
  });

  it('rejects a malformed cookie rather than keying the counter on it', async () => {
    cookieValue = '../../etc/passwd';
    await consumeChatQuota(eventFor('anonymous'));
    expect((globalThis as any).setCookie).toHaveBeenCalledOnce();
  });

  it('still accumulates for a client that never returns the cookie', async () => {
    // THE bypass this bound exists to close. A curl loop with no cookie jar
    // would otherwise mint a fresh allowance on every request, making the whole
    // gate decorative — dropping Set-Cookie would be the cheapest way past it.
    cookieValue = undefined;
    const limit = CHAT_QUOTAS.anonymous.perDay!;
    for (let i = 0; i < limit; i++) {
      expect((await consumeChatQuota(eventFor('anonymous'))).allowed).toBe(true);
    }
    expect((await consumeChatQuota(eventFor('anonymous'))).allowed).toBe(false);
  });

  it('never puts a raw IP in the counter key', async () => {
    cookieValue = undefined;
    await consumeChatQuota(eventFor('anonymous'));
    const key = storage.setItem.mock.calls[0]![0] as string;
    expect(key).not.toContain('203.0.113.9');
  });

  it('does not count a refused call, nor refresh its window', async () => {
    // Counting refusals would let someone already over the ceiling inflate
    // their own total, and refreshing the TTL on every retry would turn a 24h
    // bound into a permanent lockout for anyone who kept clicking.
    const limit = CHAT_QUOTAS.anonymous.perDay!;
    const event = eventFor('anonymous');
    for (let i = 0; i < limit; i++) await consumeChatQuota(event);
    const writesBefore = storage.setItem.mock.calls.length;

    const refused = await consumeChatQuota(event);
    expect(refused.allowed).toBe(false);
    expect(refused.used).toBe(limit);
    expect(storage.setItem.mock.calls.length).toBe(writesBefore);
  });

  it('resets rather than locks out when the stored value is unusable', async () => {
    // A non-numeric entry would make Number() give NaN, and `NaN <= limit` is
    // false — refusing the caller forever while every retry rewrote NaN.
    storage.items.set('chat-anon:c:anonsession0000000000000000abcd', 'not-a-number');
    const verdict = await consumeChatQuota(eventFor('anonymous'));
    expect(verdict.allowed).toBe(true);
    expect(verdict.used).toBe(1);
  });

  it('flags a bypassed ceiling as degraded', async () => {
    storageThrows = true;
    expect(await consumeChatQuota(eventFor('anonymous'))).toMatchObject({ allowed: true, degraded: true });
  });

  it('allows the request when KV is unavailable', async () => {
    storageThrows = true;
    expect((await consumeChatQuota(eventFor('anonymous'))).allowed).toBe(true);
  });
});

describe('signed-in quota', () => {
  it('consumes through the atomic RPC', async () => {
    const event = eventFor('member', 'user-1');
    const verdict = await consumeChatQuota(event);
    expect(rpc).toHaveBeenCalledWith('consume_chat_quota', {
      p_user_id: 'user-1',
      p_monthly_limit: CHAT_QUOTAS.member.perMonth,
    });
    expect(verdict.allowed).toBe(true);
  });

  it('passes the FREE limit for a free account', async () => {
    await consumeChatQuota(eventFor('free', 'user-2'));
    expect(rpc).toHaveBeenCalledWith('consume_chat_quota', {
      p_user_id: 'user-2',
      p_monthly_limit: CHAT_QUOTAS.free.perMonth,
    });
  });

  it('gives members a higher ceiling than free accounts', () => {
    expect(CHAT_QUOTAS.member.perMonth!).toBeGreaterThan(CHAT_QUOTAS.free.perMonth!);
  });

  it('refuses when the RPC says the ceiling is reached', async () => {
    rpcResult = { data: [{ allowed: false, used: 30, monthly_limit: 30 }], error: null };
    expect((await consumeChatQuota(eventFor('free', 'user-1'))).allowed).toBe(false);
  });

  it('allows the request when the RPC errors', async () => {
    rpcResult = { data: null, error: { message: 'pg exploded' } };
    expect(await consumeChatQuota(eventFor('free', 'user-1'))).toMatchObject({ allowed: true, degraded: true });
  });

  it('allows the request when the RPC throws', async () => {
    rpcThrows = true;
    expect((await consumeChatQuota(eventFor('free', 'user-1'))).allowed).toBe(true);
  });
});

describe('the exhausted response', () => {
  it('is a 429, never a 401', async () => {
    // The invariant: /api/chat may not answer 401. A quota is not a login wall.
    const err: any = quotaExhaustedError(eventFor('free', 'user-1'), { allowed: false, used: 30, limit: 30 });
    expect(err.statusCode).toBe(429);
  });

  it('points a non-member at membership', () => {
    const err: any = quotaExhaustedError(eventFor('anonymous'), { allowed: false });
    expect(err.message).toMatch(/membership/i);
    expect(err.data.upgradeUrl).toMatch(/\/membership$/);
  });

  it('tells a member when their allowance resets instead of selling to them', () => {
    const err: any = quotaExhaustedError(eventFor('member', 'user-1'), { allowed: false });
    expect(err.message).toMatch(/next month/i);
    expect(err.message).not.toMatch(/Sustaining Members get/);
  });
});

describe('token recording', () => {
  it('attributes tokens to a signed-in account', () => {
    const event = eventFor('member', 'user-1');
    recordChatTokens(event, 1200, 300);
    expect(rpc).toHaveBeenCalledWith('record_chat_tokens', {
      p_user_id: 'user-1',
      p_input_tokens: 1200,
      p_output_tokens: 300,
    });
    // Backgrounded — analytics must never delay the response.
    expect(event.waitUntil).toHaveBeenCalledOnce();
  });

  it('records nothing for an anonymous caller', () => {
    recordChatTokens(eventFor('anonymous'), 1200, 300);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('skips a run that reported no tokens', () => {
    recordChatTokens(eventFor('member', 'user-1'), 0, 0);
    expect(rpc).not.toHaveBeenCalled();
  });
});
