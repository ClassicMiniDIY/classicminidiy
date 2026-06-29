/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports auth + service deps via relative specifiers
// (../../../../utils/userAuth, ../../../../utils/supabase) which Vitest resolves
// to the same absolute modules as the `~~/server/utils/*` ids below; vi.mock
// matches by resolved id.
//
// This route has NO body, NO notifications, NO rate-limit middleware — it only
// reads the router param `id`, checks admin/ownership, and hard-deletes the row.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';

const handler = (await import('~~/server/api/exchange/comments/[id]/delete.delete')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'user-1', email: 'user@example.com' };
const COMMENT = { id: 'comment-1', user_id: USER.id };

/** Minimal h3 event; all request accessors are globally mocked and ignore it. */
function evt(): any {
  return { context: {} };
}

/** Set the `:id` router param the route reads via getRouterParam(event, 'id'). */
function setCommentId(id: string | undefined) {
  (getRouterParam as any).mockImplementation((_e: any, name: string) => (name === 'id' ? id : undefined));
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Wire a fresh chainable supabase client. The route's `.single()` is called
 * twice, in order:
 *   1. profiles select('is_admin').eq('id', user.id).single()  -> profile
 *   2. listing_comments select('id, user_id').eq('id', id).single() -> comment
 * The delete() resolves through the builder's default `then` ({data:[],error:null}).
 */
function wire(profile: { data: any; error: any }, comment: { data: any; error: any }) {
  mockSupabase = createMockSupabaseClient();
  (mockSupabase._mockSingle as any).mockReset();
  (mockSupabase._mockSingle as any).mockResolvedValueOnce(profile).mockResolvedValueOnce(comment);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  setCommentId('comment-1');
  // Default happy path: non-admin owner deletes their own comment.
  wire({ data: { is_admin: false }, error: null }, { data: { ...COMMENT }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('server/api/exchange/comments/[id]/delete.delete', () => {
  // =========================================================================
  //  Happy path — owner
  // =========================================================================
  it('deletes the comment when the requester is the owner and returns success', async () => {
    const result = await handler(evt());

    expect(result).toEqual({ success: true, message: 'Comment deleted successfully' });
    expect(getServiceClient).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('listing_comments');
    expect(mockSupabase._mockDelete).toHaveBeenCalledTimes(1);
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'comment-1');
  });

  it('looks up the profile admin flag keyed by the authenticated user id', async () => {
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    const profileSelect = (mockSupabase._mockSelect as any).mock.calls.find((c: any[]) => c[0] === 'is_admin');
    expect(profileSelect).toBeTruthy();
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', USER.id);
  });

  it('fetches the comment ownership row (id, user_id) filtered by the comment id', async () => {
    await handler(evt());

    const commentSelect = (mockSupabase._mockSelect as any).mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('user_id')
    )?.[0] as string;
    expect(commentSelect).toBe('id, user_id');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'comment-1');
  });

  // =========================================================================
  //  Happy path — admin (not owner)
  // =========================================================================
  it('allows an admin to delete a comment they do not own', async () => {
    wire({ data: { is_admin: true }, error: null }, { data: { id: 'comment-1', user_id: 'someone-else' }, error: null });

    const result = await handler(evt());
    expect(result).toEqual({ success: true, message: 'Comment deleted successfully' });
    expect(mockSupabase._mockDelete).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  //  Validation — missing id (400)
  // =========================================================================
  it('throws 400 when the comment id router param is missing', async () => {
    setCommentId(undefined);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, message: 'Comment ID is required' });
    // The id guard runs before any DB access, so nothing is queried or deleted.
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Not found (404)
  // =========================================================================
  it('throws 404 when the comment does not exist (null data)', async () => {
    wire({ data: { is_admin: false }, error: null }, { data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, message: 'Comment not found' });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 404 when the comment lookup errors', async () => {
    wire({ data: { is_admin: false }, error: null }, { data: null, error: { message: 'no rows' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, message: 'Comment not found' });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Forbidden (403) — not owner, not admin
  // =========================================================================
  it('throws 403 when the requester is neither owner nor admin', async () => {
    wire({ data: { is_admin: false }, error: null }, { data: { id: 'comment-1', user_id: 'someone-else' }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 403,
      message: 'You do not have permission to delete this comment',
    });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('throws 403 when the profile row is missing (no admin flag) and requester is not owner', async () => {
    // profile null -> profile?.is_admin === true is false -> non-admin path.
    wire({ data: null, error: null }, { data: { id: 'comment-1', user_id: 'someone-else' }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  it('treats is_admin of a non-true truthy value (e.g. 1) as NOT admin (strict === true)', async () => {
    // INVARIANT: admin check is `profile?.is_admin === true`, so a non-boolean
    // truthy must NOT grant deletion of someone else's comment.
    wire({ data: { is_admin: 1 }, error: null }, { data: { id: 'comment-1', user_id: 'someone-else' }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSupabase._mockDelete).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Delete failure (500)
  // =========================================================================
  it('throws 500 with the db message when the delete returns an error', async () => {
    wire({ data: { is_admin: false }, error: null }, { data: { ...COMMENT }, error: null });
    // The route awaits `supabase.from('listing_comments').delete().eq('id', id)`.
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
  it('wraps an unexpected (non-statusCode) thrown error as 500', async () => {
    wire({ data: { is_admin: false }, error: null }, { data: { ...COMMENT }, error: null });
    // Make the first single() (profile lookup) throw a bare error.
    (mockSupabase._mockSingle as any).mockReset();
    (mockSupabase._mockSingle as any).mockRejectedValue(new Error('connection reset'));

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500, message: 'connection reset' });
  });

  it('preserves the original statusCode when re-throwing in the catch (404 stays 404)', async () => {
    // INVARIANT: the catch block uses `error.statusCode || 500`, so a thrown
    // 404 must not be flattened to 500.
    wire({ data: { is_admin: false }, error: null }, { data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });
});
