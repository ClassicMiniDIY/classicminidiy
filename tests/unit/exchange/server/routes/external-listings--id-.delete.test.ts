/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetExchangeRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports its deps via relative specifiers
// (../../../utils/userAuth, ../../../utils/supabase) which Vitest resolves to
// the same absolute modules as the `~~/server/utils/*` ids below; vi.mock
// matches by resolved id.
//
// rateLimit is intentionally NOT mocked — the real moderate-preset middleware
// (10/min, keyPrefix 'finds-delete') runs so its gating is genuinely
// exercised. Its store is reset before every test. The middleware keys off
// `event.context.user?.id || ip`, so each test supplies a distinct user/IP and
// stays well under the limit.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));

// The rate-limit middleware calls setResponseHeader, which is not part of the
// shared h3 global setup. Stub it so the middleware doesn't throw.
vi.stubGlobal('setResponseHeader', vi.fn());

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';

const handler = (await import('~~/server/api/exchange/external-listings/[id].delete')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'user-1', email: 'user@example.com' };
const FIND_ID = 'find-1';
/** A pending find owned by USER. */
const OWNED_PENDING = { id: FIND_ID, submitted_by: USER.id, status: 'pending' };

/**
 * Minimal h3 event. The rate-limit middleware reads `event.context.user?.id`,
 * so `context` must exist. All request accessors (getRouterParam/getHeader/...)
 * are globally mocked and ignore the event arg.
 */
function evt(): any {
  return { context: {} };
}

/** Set the `:id` router param the route reads via getRouterParam(event, 'id'). */
function setFindId(id: string | undefined) {
  (getRouterParam as any).mockImplementation((_e: any, name: string) => (name === 'id' ? id : undefined));
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Wire a fresh chainable supabase client. The route's `.single()` is called
 * twice, in order:
 *   1. external_listings.select('id, submitted_by, status').eq('id', id).single() -> find
 *   2. profiles.select('is_admin').eq('id', user.id).single()                     -> profile
 * The delete() resolves through the builder's default `then` ({data:[],error:null}).
 */
function wire(find: { data: any; error: any }, profile: { data: any; error: any }) {
  mockSupabase = createMockSupabaseClient();
  (mockSupabase._mockSingle as any).mockReset();
  (mockSupabase._mockSingle as any).mockResolvedValueOnce(find).mockResolvedValueOnce(profile);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetExchangeRateLimitStore();
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  setFindId(FIND_ID);
  // Default happy path: non-admin owner deletes their own pending find.
  wire({ data: { ...OWNED_PENDING }, error: null }, { data: { is_admin: false }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  _resetExchangeRateLimitStore();
});

describe('server/api/exchange/external-listings/[id].delete', () => {
  // =========================================================================
  //  Happy path — owner of a pending find
  // =========================================================================
  it('hard-deletes the find when the requester owns it and it is pending, returning success', async () => {
    const result = await handler(evt());

    expect(result).toEqual({ success: true });
    expect(getServiceClient).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
    expect(mockSupabase._mockDelete).toHaveBeenCalledTimes(1);
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', FIND_ID);
  });

  it('fetches the find ownership row (id, submitted_by, status) filtered by the find id', async () => {
    await handler(evt());

    const findSelect = (mockSupabase._mockSelect as any).mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('submitted_by')
    )?.[0] as string;
    expect(findSelect).toBe('id, submitted_by, status');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', FIND_ID);
  });

  it('looks up the profile admin flag keyed by the authenticated user id', async () => {
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('profile_private');
    const profileSelect = (mockSupabase._mockSelect as any).mock.calls.find((c: any[]) => c[0] === 'is_admin');
    expect(profileSelect).toBeTruthy();
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', USER.id);
  });

  // =========================================================================
  //  Happy path — admin (not owner, any status)
  // =========================================================================
  it('allows an admin to delete a find they do not own', async () => {
    wire(
      { data: { id: FIND_ID, submitted_by: 'someone-else', status: 'pending' }, error: null },
      { data: { is_admin: true }, error: null }
    );

    const result = await handler(evt());
    expect(result).toEqual({ success: true });
    expect(mockSupabase._mockDelete).toHaveBeenCalledTimes(1);
  });

  it('allows an admin to delete a find that is NOT pending (e.g. approved)', async () => {
    // INVARIANT: the pending-status restriction applies only to owners; admins
    // may delete any find regardless of status.
    wire(
      { data: { id: FIND_ID, submitted_by: 'someone-else', status: 'approved' }, error: null },
      { data: { is_admin: true }, error: null }
    );

    const result = await handler(evt());
    expect(result).toEqual({ success: true });
    expect(mockSupabase._mockDelete).toHaveBeenCalledTimes(1);
  });

  it('allows an admin to delete their OWN approved find (admin path short-circuits)', async () => {
    wire(
      { data: { id: FIND_ID, submitted_by: USER.id, status: 'approved' }, error: null },
      { data: { is_admin: true }, error: null }
    );

    const result = await handler(evt());
    expect(result).toEqual({ success: true });
  });

  // =========================================================================
  //  Validation — missing id (400)
  // =========================================================================
  it('throws 400 when the find id router param is missing', async () => {
    setFindId(undefined);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, message: 'Find ID is required' });
    // The id guard runs before any DB access, so nothing is queried or deleted.
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 400 when the find id router param is an empty string', async () => {
    // `if (!findId)` treats '' as missing.
    setFindId('');
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, message: 'Find ID is required' });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Not found (404)
  // =========================================================================
  it('throws 404 when the find does not exist (null data)', async () => {
    wire({ data: null, error: null }, { data: { is_admin: false }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, message: 'Find not found' });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 404 when the find lookup errors', async () => {
    wire({ data: null, error: { message: 'no rows' } }, { data: { is_admin: false }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, message: 'Find not found' });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('does not query the profiles table when the find is missing (404 short-circuits)', async () => {
    wire({ data: null, error: null }, { data: { is_admin: false }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('profiles');
  });

  // =========================================================================
  //  Forbidden (403) — not owner, not admin
  // =========================================================================
  it('throws 403 when the requester is neither owner nor admin', async () => {
    wire(
      { data: { id: FIND_ID, submitted_by: 'someone-else', status: 'pending' }, error: null },
      { data: { is_admin: false }, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 403,
      message: 'You do not have permission to delete this find',
    });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 403 when the owner tries to delete their own NON-pending find', async () => {
    // INVARIANT: owners may delete only their own PENDING submission. An owner
    // whose find has been approved/published loses delete rights (matches RLS).
    wire(
      { data: { id: FIND_ID, submitted_by: USER.id, status: 'approved' }, error: null },
      { data: { is_admin: false }, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 403 when the owner tries to delete their own rejected find', async () => {
    wire(
      { data: { id: FIND_ID, submitted_by: USER.id, status: 'rejected' }, error: null },
      { data: { is_admin: false }, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 403 when the profile row is missing and the requester is not the owner', async () => {
    // profile null -> profile?.is_admin === true is false -> non-admin path.
    wire(
      { data: { id: FIND_ID, submitted_by: 'someone-else', status: 'pending' }, error: null },
      { data: null, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('treats is_admin of a non-true truthy value (e.g. 1) as NOT admin (strict === true)', async () => {
    // INVARIANT: admin check is `profile?.is_admin === true`, so a non-boolean
    // truthy must NOT grant deletion of someone else's find.
    wire(
      { data: { id: FIND_ID, submitted_by: 'someone-else', status: 'pending' }, error: null },
      { data: { is_admin: 1 }, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Delete failure (500)
  // =========================================================================
  it('throws 500 with the db message when the delete returns an error', async () => {
    wire({ data: { ...OWNED_PENDING }, error: null }, { data: { is_admin: false }, error: null });
    // The route awaits `supabase.from('external_listings').delete().eq('id', id)`.
    // Override delete() (not the shared eq(), which the select chains also use) to
    // return a one-off builder whose eq() resolves to the error.
    (mockSupabase._mockDelete as any).mockReturnValueOnce({
      eq: vi.fn(() => ({
        then: (resolve: any) => resolve({ data: null, error: { message: 'delete blew up' } }),
      })),
    });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500, message: 'delete blew up' });
  });

  // =========================================================================
  //  Auth propagation (401)
  // =========================================================================
  it('propagates auth failure (401) from requireUserClient before touching the db', async () => {
    (requireUserClient as any).mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Error wrapping — unexpected (non-statusCode) errors become 500
  // =========================================================================
  it('wraps an unexpected (non-statusCode) thrown error as generic 500', async () => {
    wire({ data: { ...OWNED_PENDING }, error: null }, { data: { is_admin: false }, error: null });
    // Make the first single() (find lookup) throw a bare error with no statusCode.
    (mockSupabase._mockSingle as any).mockReset();
    (mockSupabase._mockSingle as any).mockRejectedValue(new Error('connection reset'));

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500, message: 'Failed to delete find' });
  });

  it('preserves the original statusCode when re-throwing in the catch (404 stays 404)', async () => {
    // INVARIANT: the catch block re-throws errors that already carry a
    // statusCode, so a thrown 404 must not be flattened to 500.
    wire({ data: null, error: null }, { data: { is_admin: false }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, message: 'Find not found' });
  });

  // =========================================================================
  //  Rate limiting (429) — real middleware
  // =========================================================================
  it('throws 429 once the moderate per-identifier limit (10/min) is exceeded', async () => {
    // The middleware keys off event.context.user?.id (here undefined) || ip.
    // getHeader('x-real-ip') is undefined and getRequestIP returns the global
    // default IP, so all calls share one identifier. The 11th call trips.
    (requireUserClient as any).mockResolvedValue({ user: { ...USER } });

    for (let i = 0; i < 10; i++) {
      wire({ data: { ...OWNED_PENDING }, error: null }, { data: { is_admin: false }, error: null });
      // eslint-disable-next-line no-await-in-loop
      await expect(handler(evt())).resolves.toEqual({ success: true });
    }

    // 11th request within the window is rejected before auth/db work.
    (getServiceClient as any).mockClear();
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  it('prefers the spoof-proof x-real-ip header over getRequestIP for the rate-limit key', async () => {
    // INVARIANT (rateLimit.ts): on Vercel, x-real-ip is set by the edge proxy
    // and is preferred; the client-controllable x-forwarded-for (getRequestIP)
    // is only the fallback. Two distinct x-real-ip values must be limited
    // independently even when getRequestIP returns the same address.
    (getHeader as any).mockImplementation((_e: any, name: string) => (name === 'x-real-ip' ? 'ip-A' : undefined));

    // Exhaust the window for ip-A.
    for (let i = 0; i < 10; i++) {
      wire({ data: { ...OWNED_PENDING }, error: null }, { data: { is_admin: false }, error: null });
      // eslint-disable-next-line no-await-in-loop
      await expect(handler(evt())).resolves.toEqual({ success: true });
    }
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });

    // A different x-real-ip is a fresh bucket and succeeds.
    (getHeader as any).mockImplementation((_e: any, name: string) => (name === 'x-real-ip' ? 'ip-B' : undefined));
    wire({ data: { ...OWNED_PENDING }, error: null }, { data: { is_admin: false }, error: null });
    await expect(handler(evt())).resolves.toEqual({ success: true });
  });
});
