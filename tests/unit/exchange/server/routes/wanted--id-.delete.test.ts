/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports auth + service deps via relative specifiers
// (../../../utils/userAuth, ../../../utils/supabase) which Vitest resolves to
// the same absolute modules as the `~~/server/utils/*` ids below; vi.mock
// matches by resolved id.
//
// The rate-limit util is NOT mocked — we exercise the real middleware (which is
// why we reset its in-memory store in beforeEach). The route only uses
// requireUserClient's `user`; it talks to the DB through getServiceClient(), so
// the auth client itself is irrelevant.
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

const handler = (await import('~~/server/api/exchange/wanted/[id].delete')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'user-1', email: 'owner@example.com' };
const POST = { id: 'wp-1', user_id: USER.id };

/**
 * Minimal h3 event. The rate-limit middleware reads `event.context.user?.id`,
 * so `context` must exist. All request accessors (getRouterParam/getHeader/...)
 * are globally mocked and ignore the event arg.
 */
function evt(): any {
  return { context: {} };
}

/** Set the `:id` router param the route reads via getRouterParam(event, 'id'). */
function setPostId(id: string | undefined) {
  (getRouterParam as any).mockImplementation((_e: any, name: string) => (name === 'id' ? id : undefined));
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Wire a fresh chainable supabase client. The route calls `.single()` twice,
 * in THIS order:
 *   1. wanted_posts.select('id, user_id').eq('id', id).single()   -> post
 *   2. profiles.select('is_admin').eq('id', user.id).single()     -> profile
 * The soft-delete update() resolves through the builder's default `then`
 * ({data:[],error:null}).
 */
function wire(post: { data: any; error: any }, profile: { data: any; error: any }) {
  mockSupabase = createMockSupabaseClient();
  (mockSupabase._mockSingle as any).mockReset();
  (mockSupabase._mockSingle as any).mockResolvedValueOnce(post).mockResolvedValueOnce(profile);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  _resetRateLimitStore();
  vi.clearAllMocks();
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  setPostId('wp-1');
  // The rate-limit middleware keys off x-real-ip (preferred over getRequestIP).
  (getHeader as any).mockImplementation((_e: any, n: string) =>
    n === 'x-real-ip' ? '9.9.9.9' : n === 'authorization' ? 'Bearer tok' : undefined
  );
  // Default happy path: non-admin owner soft-deletes their own post.
  wire({ data: { ...POST }, error: null }, { data: { is_admin: false }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('server/api/exchange/wanted/[id].delete', () => {
  // =========================================================================
  //  Happy path — owner
  // =========================================================================
  describe('happy path (owner)', () => {
    it('soft-deletes the post (status: removed) when the requester is the owner and returns success', async () => {
      const result = await handler(evt());

      expect(result).toEqual({ success: true });
      expect(getServiceClient).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      // INVARIANT: soft delete, never a hard delete — a CASCADE would destroy
      // conversation/message history.
      expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
      expect(mockSupabase._mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ status: 'removed' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wp-1');
    });

    it('fetches the ownership row (id, user_id) filtered by the post id', async () => {
      await handler(evt());

      const postSelect = (mockSupabase._mockSelect as any).mock.calls.find(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('user_id')
      )?.[0] as string;
      expect(postSelect).toBe('id, user_id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wp-1');
    });

    it('looks up the profile admin flag keyed by the authenticated user id', async () => {
      await handler(evt());

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      const profileSelect = (mockSupabase._mockSelect as any).mock.calls.find((c: any[]) => c[0] === 'is_admin');
      expect(profileSelect).toBeTruthy();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', USER.id);
    });

    it('verifies authentication via requireUserClient exactly once', async () => {
      await handler(evt());
      expect(requireUserClient).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  //  Happy path — admin (not owner)
  // =========================================================================
  describe('happy path (admin)', () => {
    it('allows an admin to remove a post they do not own', async () => {
      wire({ data: { id: 'wp-1', user_id: 'someone-else' }, error: null }, { data: { is_admin: true }, error: null });

      const result = await handler(evt());
      expect(result).toEqual({ success: true });
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ status: 'removed' });
    });
  });

  // =========================================================================
  //  Validation — missing id (400)
  // =========================================================================
  describe('missing id', () => {
    it('throws 400 when the post id router param is missing', async () => {
      setPostId(undefined);
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Wanted post ID is required',
      });
    });

    it('does not query or update when the id is missing', async () => {
      setPostId(undefined);
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  //  Not found (404)
  // =========================================================================
  describe('not found', () => {
    it('throws 404 when the post does not exist (null data, no error)', async () => {
      wire({ data: null, error: null }, { data: { is_admin: false }, error: null });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 404,
        message: 'Wanted post not found',
      });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('throws 404 when the post lookup errors', async () => {
      wire({ data: null, error: { message: 'no rows' } }, { data: { is_admin: false }, error: null });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 404,
        message: 'Wanted post not found',
      });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('never looks up the profile when the post is not found (returns before admin check)', async () => {
      wire({ data: null, error: null }, { data: { is_admin: false }, error: null });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
      expect(mockSupabase.from).not.toHaveBeenCalledWith('profiles');
    });
  });

  // =========================================================================
  //  Forbidden (403) — not owner, not admin
  // =========================================================================
  describe('forbidden', () => {
    it('throws 403 when the requester is neither owner nor admin', async () => {
      wire({ data: { id: 'wp-1', user_id: 'someone-else' }, error: null }, { data: { is_admin: false }, error: null });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to delete this wanted post',
      });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('throws 403 when the profile row is missing (no admin flag) and requester is not owner', async () => {
      // profile null -> profile?.is_admin === true is false -> non-admin path.
      wire({ data: { id: 'wp-1', user_id: 'someone-else' }, error: null }, { data: null, error: null });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('treats a non-true truthy is_admin (e.g. 1) as NOT admin (strict === true)', async () => {
      // INVARIANT: admin check is `profile?.is_admin === true`, so a non-boolean
      // truthy must NOT grant removal of someone else's post.
      wire({ data: { id: 'wp-1', user_id: 'someone-else' }, error: null }, { data: { is_admin: 1 }, error: null });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('owner is permitted even when profile lookup yields no admin flag', async () => {
      // Owner short-circuits the OR — isOwner true regardless of profile.
      wire({ data: { ...POST }, error: null }, { data: null, error: null });
      const result = await handler(evt());
      expect(result).toEqual({ success: true });
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ status: 'removed' });
    });
  });

  // =========================================================================
  //  Update failure (500)
  // =========================================================================
  describe('update failure', () => {
    it('throws 500 with the db message when the soft-delete update returns an error', async () => {
      // The route awaits `supabase.from('wanted_posts').update({...}).eq('id', id)`.
      // Override update() (not the shared eq(), which the select chains also use)
      // to return a one-off builder whose eq() resolves to the error.
      (mockSupabase._mockUpdate as any).mockReturnValueOnce({
        eq: vi.fn(() => ({
          then: (resolve: any) => resolve({ data: null, error: { message: 'update blew up' } }),
        })),
      });

      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500, message: 'update blew up' });
    });
  });

  // =========================================================================
  //  Auth propagation (401 / 403 banned)
  // =========================================================================
  describe('auth propagation', () => {
    it('propagates a 401 from requireUserClient before touching the db', async () => {
      (requireUserClient as any).mockRejectedValueOnce(
        Object.assign(new Error('Authentication required'), { statusCode: 401 })
      );
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
      expect(getServiceClient).not.toHaveBeenCalled();
    });

    it('propagates a 403 banned-token error from requireUserClient', async () => {
      (requireUserClient as any).mockRejectedValueOnce(
        Object.assign(new Error('Account suspended'), { statusCode: 403 })
      );
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(getServiceClient).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  //  Error wrapping — catch block
  // =========================================================================
  describe('error wrapping', () => {
    it('wraps an unexpected (non-statusCode) thrown error as 500 "Failed to delete wanted post"', async () => {
      // Make the first single() (post lookup) throw a bare error.
      (mockSupabase._mockSingle as any).mockReset();
      (mockSupabase._mockSingle as any).mockRejectedValue(new Error('connection reset'));

      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to delete wanted post',
      });
    });

    it('preserves the original statusCode when re-throwing in the catch (404 stays 404)', async () => {
      // INVARIANT: the catch re-throws when `error.statusCode` is set, so a
      // thrown 404 must not be flattened to the catch-all 500.
      wire({ data: null, error: null }, { data: { is_admin: false }, error: null });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // =========================================================================
  //  Rate limiting (429) — real middleware
  // =========================================================================
  describe('rate limiting', () => {
    it('throws 429 after the 10th request within the window (moderate preset)', async () => {
      // moderate preset = 10 requests / 60s, keyed by x-real-ip (9.9.9.9).
      // The first 10 succeed; the 11th is rejected by the middleware before any
      // auth/db work.
      for (let i = 0; i < 10; i++) {
        wire({ data: { ...POST }, error: null }, { data: { is_admin: false }, error: null });
        const res = await handler(evt());
        expect(res).toEqual({ success: true });
      }
      // 11th: middleware throws 429. Re-thrown through the catch (statusCode set).
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('does not run auth or the soft-delete when rate limited', async () => {
      for (let i = 0; i < 10; i++) {
        wire({ data: { ...POST }, error: null }, { data: { is_admin: false }, error: null });
        await handler(evt());
      }
      (requireUserClient as any).mockClear();
      (mockSupabase._mockUpdate as any).mockClear();
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
      expect(requireUserClient).not.toHaveBeenCalled();
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });
  });
});
