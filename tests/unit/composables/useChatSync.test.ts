// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// app/composables/useChatSync.ts
//
// The contract is that it degrades QUIETLY. localStorage is the working copy
// and this is a sync target, so an expired session, a 403 or a Supabase blip
// must cost sync and never the conversation. If an error ever escaped here it
// would surface as a broken chat for members during exactly the outage the
// fail-soft design exists to survive — so every path below is pinned.
// ---------------------------------------------------------------------------

let token: string | null = 'token-abc';
let fetchImpl: any = vi.fn(async () => ({ threads: [] }));

vi.stubGlobal('useSupabase', () => ({
  auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) },
}));
vi.stubGlobal('$fetch', (...args: any[]) => fetchImpl(...args));

const { useChatSync } = await import('~/app/composables/useChatSync');

const err = (statusCode: number) => {
  const e: any = new Error('nope');
  e.statusCode = statusCode;
  return e;
};

beforeEach(() => {
  vi.clearAllMocks();
  token = 'token-abc';
  fetchImpl = vi.fn(async () => ({ threads: [] }));
});

describe('authentication', () => {
  it('does nothing and reports failure when there is no session', async () => {
    token = null;
    const sync = useChatSync();
    expect(await sync.pull()).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the access token explicitly', async () => {
    // The Supabase session lives in localStorage, not a cookie, so every
    // /api/** call that needs the user must carry a Bearer header itself.
    const sync = useChatSync();
    await sync.pull();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token-abc');
  });

  it('sets keepalive so a push during unload still leaves the browser', async () => {
    const sync = useChatSync();
    await sync.push('t1', 'A', []);
    expect(fetchImpl.mock.calls[0][1].keepalive).toBe(true);
  });
});

describe('failing soft', () => {
  it('swallows a server error and records it', async () => {
    fetchImpl = vi.fn(async () => {
      throw err(502);
    });
    const sync = useChatSync();
    await expect(sync.pull()).resolves.toBe(false);
    expect(sync.lastError.value).toBeTruthy();
  });

  it('treats a 403 as "not a member", not as a fault', async () => {
    // A non-member simply lacks the benefit; recording it as an error would
    // put a scary state in front of someone who has done nothing wrong.
    fetchImpl = vi.fn(async () => {
      throw err(403);
    });
    const sync = useChatSync();
    await expect(sync.pull()).resolves.toBe(false);
    expect(sync.lastError.value).toBeNull();
  });

  it('never throws, whatever a call does', async () => {
    fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const sync = useChatSync();
    await expect(sync.push('t1', 'A', [])).resolves.toBeUndefined();
    await expect(sync.remove('t1')).resolves.toBeUndefined();
    await expect(sync.clear()).resolves.toBeUndefined();
    await expect(sync.pullThread('t1')).resolves.toBeNull();
  });
});

describe('backfill', () => {
  const local = (id: string) => ({ threadId: id, title: id, messages: [{ role: 'user' } as any] });

  it('uploads only conversations the server does not have', async () => {
    // The point of the whole thing: a member who was already using the chat
    // must not open a second device and find nothing.
    const saved = (id: string) => ({ threadId: id, title: id, messageCount: 1, createdAt: 'a', updatedAt: 'b' });
    fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ threads: [saved('known')] })
      .mockResolvedValue(saved('new-1'));

    const sync = useChatSync();
    await sync.pull();
    const uploaded = await sync.backfill([local('known'), local('new-1')]);

    expect(uploaded).toBe(1);
    const pushed = fetchImpl.mock.calls.slice(1).map((c: any[]) => c[0]);
    expect(pushed).toEqual(['/api/chat/threads/new-1']);
  });

  it('skips a conversation with no messages', async () => {
    const sync = useChatSync();
    await sync.pull();
    expect(await sync.backfill([{ threadId: 'empty', title: '', messages: [] }])).toBe(0);
  });

  it('stops at the first failure rather than hammering a refusing server', async () => {
    fetchImpl = vi.fn().mockResolvedValueOnce({ threads: [] }).mockRejectedValue(err(502));
    const sync = useChatSync();
    await sync.pull();
    expect(await sync.backfill([local('a'), local('b'), local('c')])).toBe(0);
    // One attempt, not three.
    expect(fetchImpl.mock.calls.length).toBe(2);
  });
});

describe('the local mirror', () => {
  it('caps at the same twenty the server and the trigger enforce', async () => {
    // Otherwise the dialog lists conversations the server has already trimmed,
    // and opening one 404s — an expired conversation reading as a broken one.
    const saved = (id: string) => ({ threadId: id, title: id, messageCount: 1, createdAt: 'a', updatedAt: 'b' });
    fetchImpl = vi.fn(async (path: string) => saved(path.split('/').pop()!));
    const sync = useChatSync();
    for (let i = 0; i < 25; i++) await sync.push(`t${i}`, 'x', []);
    expect(sync.remote.value.length).toBe(20);
  });

  it('drops a removed conversation from the list', async () => {
    const saved = { threadId: 't1', title: 'A', messageCount: 1, createdAt: 'a', updatedAt: 'b' };
    fetchImpl = vi.fn(async () => saved);
    const sync = useChatSync();
    await sync.push('t1', 'A', []);
    expect(sync.remote.value).toHaveLength(1);
    await sync.remove('t1');
    expect(sync.remote.value).toHaveLength(0);
  });
});
