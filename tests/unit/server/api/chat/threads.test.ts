/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// server/api/chat/threads/**
//
// These routes FAIL CLOSED, which is the deliberate opposite of /api/chat.
// That one is a public assistant and a 401 from it would break the surface's
// reason to exist; these read and write an account's saved conversations, so an
// unresolvable caller must be refused rather than degraded. The tests below
// pin that difference, and the membership gate, because both are the kind of
// thing a later reader could "make consistent" with the neighbouring gate and
// quietly open up.
//
// RLS is verified separately, against the real database: a second account sees
// 0 rows and deletes 0. No mock can prove that.
// ---------------------------------------------------------------------------

let isMember: any = true;
let rpcError: any = null;
let authThrows = false;

const query: any = {
  rows: [] as any[],
  error: null as any,
};

function builder() {
  const b: any = {
    select: () => b,
    order: () => b,
    limit: () => Promise.resolve({ data: query.rows, error: query.error }),
    eq: () => b,
    maybeSingle: () => Promise.resolve({ data: query.rows[0] ?? null, error: query.error }),
    single: () => Promise.resolve({ data: query.rows[0] ?? null, error: query.error }),
    upsert: () => b,
    delete: () => b,
    then: (ok: any, err?: any) => Promise.resolve({ data: query.rows, error: query.error }).then(ok, err),
  };
  return b;
}

const userClient = { from: vi.fn(() => builder()) };

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal(
  'getRouterParam',
  vi.fn(() => 'aaaaaaaa-0000-4000-8000-000000000001')
);
vi.stubGlobal(
  'readBody',
  vi.fn(async () => ({ title: 'A chat', messages: [{ role: 'user' }] }))
);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  Object.assign(e, opts);
  return e;
});

vi.mock('~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(async () => {
    if (authThrows) {
      const e: any = new Error('Authentication required');
      e.statusCode = 401;
      throw e;
    }
    return { user: { id: 'user-1' }, supabase: userClient };
  }),
}));
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => ({ rpc: vi.fn(async () => ({ data: isMember, error: rpcError })) })),
}));

const list = (await import('~~/server/api/chat/threads/index.get')).default;
const put = (await import('~~/server/api/chat/threads/[id].put')).default;
const clear = (await import('~~/server/api/chat/threads/index.delete')).default;

const event = () => ({ context: {} }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  isMember = true;
  rpcError = null;
  authThrows = false;
  query.rows = [];
  query.error = null;
  // Reset BOTH stubbed globals. Leaving them is a setup-asymmetry trap: the
  // non-UUID test below sets getRouterParam to a bad path, and without this
  // every later test in the file rejects on the id before reaching what it
  // meant to assert.
  (globalThis as any).getRouterParam.mockReturnValue('aaaaaaaa-0000-4000-8000-000000000001');
  (globalThis as any).readBody.mockResolvedValue({ title: 'A chat', messages: [{ role: 'user' }] });
  userClient.from.mockImplementation(() => builder());
});

describe('access', () => {
  it('refuses an unauthenticated caller', async () => {
    authThrows = true;
    await expect(list(event())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('refuses a signed-in NON-member with 403, not 401', async () => {
    // 403 is the honest answer: they are who they say, they just do not have
    // the benefit. A 401 would send the client into a sign-in loop.
    isMember = false;
    await expect(list(event())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('answers 503 when membership cannot be checked, rather than 403', async () => {
    // Silently telling a paying member "you have no synced history" during an
    // RPC blip looks exactly like their conversations being gone, which is far
    // worse than an error their client can retry.
    rpcError = { message: 'rpc down' };
    await expect(list(event())).rejects.toMatchObject({ statusCode: 503 });
  });

  it('allows a member', async () => {
    query.rows = [];
    await expect(list(event())).resolves.toEqual({ threads: [] });
  });
});

describe('list', () => {
  it('never returns transcripts', async () => {
    // Twenty transcripts is easily over a megabyte; the dialog only needs
    // titles and counts, and a transcript is fetched when one is opened.
    query.rows = [
      { id: 't1', title: 'A', message_count: 4, created_at: 'x', updated_at: 'y', messages: [{ role: 'user' }] },
    ];
    const result: any = await list(event());
    expect(result.threads[0]).not.toHaveProperty('messages');
    expect(result.threads[0]).toMatchObject({ threadId: 't1', title: 'A', messageCount: 4 });
  });
});

describe('upsert', () => {
  it('rejects a non-UUID id', async () => {
    // The id becomes a primary key. RLS stops cross-account writes; this stops
    // a malformed key.
    (globalThis as any).getRouterParam.mockReturnValue('../../etc/passwd');
    await expect(put(event())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a body whose messages are not an array', async () => {
    (globalThis as any).readBody.mockResolvedValue({ title: 'x', messages: 'nope' });
    await expect(put(event())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses a transcript past the message ceiling', async () => {
    (globalThis as any).readBody.mockResolvedValue({
      messages: Array.from({ length: 201 }, () => ({ role: 'user' })),
    });
    await expect(put(event())).rejects.toMatchObject({ statusCode: 413 });
  });

  it('refuses a transcript past the byte ceiling', async () => {
    // A payload far past anything the chat produces is a broken or hostile
    // client, and these rows are arbitrary user text in a shared table.
    (globalThis as any).readBody.mockResolvedValue({
      messages: [{ role: 'user', text: 'x'.repeat(600_000) }],
    });
    await expect(put(event())).rejects.toMatchObject({ statusCode: 413 });
  });

  it('truncates an over-long title rather than refusing the write', async () => {
    query.rows = [{ id: 't1', title: 'x', message_count: 1, created_at: 'a', updated_at: 'b' }];
    (globalThis as any).readBody.mockResolvedValue({ title: 'y'.repeat(500), messages: [{ role: 'user' }] });
    await expect(put(event())).resolves.toBeTruthy();
  });
});

describe('clear', () => {
  it('scopes the delete to the caller even though RLS already does', async () => {
    // A DELETE with no predicate is one policy change away from a very bad day.
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    userClient.from.mockReturnValue({ delete: () => ({ eq }) } as any);
    await clear(event());
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
