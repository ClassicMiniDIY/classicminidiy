/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports its deps via relative specifiers
// (../../../../utils/userAuth, ../../../../utils/supabase) which Vitest resolves
// to the same absolute modules as the `~~/server/utils/*` ids below; vi.mock
// matches by resolved id. There is no rate limit, sanitize, or notification
// machinery in this route — auth + service client are the only collaborators.
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

const handler = (await import('~~/server/api/exchange/comments/[id]/flag.patch')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'flagger-1', email: 'flagger@example.com' };
const COMMENT_ID = 'comment-123';

// What the fetch select(...).single() returns. Note: the route fetches a comment
// authored by someone OTHER than the flagger so the own-comment guard passes.
const OTHER_COMMENT = { id: COMMENT_ID, user_id: 'author-9', is_flagged: false };

/** Minimal h3 event — all request accessors are globally mocked and ignore it. */
function evt(): any {
  return {};
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Wire a fresh chainable supabase client.
 *  - `fetch` controls the result of the comment-verification `.single()`.
 *  - `update` controls the result of the awaited `from().update().eq()` chain.
 *
 * The update chain has no terminal `.single()`/`.maybeSingle()` — the route
 * awaits the builder directly (its thenable). So to surface an update error we
 * override the builder's `then` to resolve with the supplied update result. The
 * fetch path runs FIRST (its own `.single()`), so the overridden `then` only
 * affects the later update await.
 */
function wire(opts: {
  fetch?: { data: any; error: any };
  update?: { data: any; error: any };
} = {}) {
  mockSupabase = createMockSupabaseClient();
  const fetchResult = opts.fetch ?? { data: { ...OTHER_COMMENT }, error: null };
  const updateResult = opts.update ?? { data: null, error: null };

  (mockSupabase._mockSingle as any).mockResolvedValueOnce(fetchResult);
  // The awaited update chain resolves through the builder's thenable.
  (mockSupabase._queryBuilder as any).then = (resolve: any) => resolve(updateResult);

  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  (getRouterParam as any).mockReturnValue(COMMENT_ID);
  wire();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('server/api/exchange/comments/[id]/flag.patch', () => {
  // =========================================================================
  //  Happy path
  // =========================================================================
  it('flags another user\'s comment and returns success', async () => {
    const result = await handler(evt());

    expect(result).toEqual({
      success: true,
      message: 'Comment has been flagged for review',
    });
  });

  it('updates is_flagged=true and moderation_status="pending" on the right comment', async () => {
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('listing_comments');
    const updateArg = (mockSupabase._mockUpdate as any).mock.calls[0][0];
    expect(updateArg).toEqual({
      is_flagged: true,
      moderation_status: 'pending',
    });
    // The update is scoped to the comment id.
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', COMMENT_ID);
  });

  it('verifies the comment exists before updating (fetch select id,user_id,is_flagged eq id single)', async () => {
    await handler(evt());

    const verifySelect = (mockSupabase._mockSelect as any).mock.calls[0][0] as string;
    expect(verifySelect).toContain('id');
    expect(verifySelect).toContain('user_id');
    expect(verifySelect).toContain('is_flagged');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', COMMENT_ID);
    expect(mockSupabase._mockSingle).toHaveBeenCalled();
  });

  it('acquires the service client and resolves the router param "id"', async () => {
    await handler(evt());
    expect(getServiceClient).toHaveBeenCalledTimes(1);
    expect(getRouterParam).toHaveBeenCalledWith(expect.anything(), 'id');
  });

  // =========================================================================
  //  Auth (propagated from requireUserClient)
  // =========================================================================
  it('propagates auth failure (401) from requireUserClient and never touches the DB', async () => {
    (requireUserClient as any).mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Validation — missing comment id (400)
  // =========================================================================
  it('throws 400 when the router param "id" is missing', async () => {
    (getRouterParam as any).mockReturnValue(undefined);

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Comment ID is required',
    });
    // No fetch/update attempted.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('throws 400 when the router param "id" is an empty string', async () => {
    (getRouterParam as any).mockReturnValue('');

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Not found (404)
  // =========================================================================
  it('throws 404 when the comment does not exist (null data)', async () => {
    wire({ fetch: { data: null, error: null } });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 404,
      message: 'Comment not found',
    });
    // Must not attempt an update on a non-existent comment.
    expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
  });

  it('throws 404 when the fetch returns an error', async () => {
    wire({ fetch: { data: null, error: { message: 'no rows' } } });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Own-comment guard (400)
  // =========================================================================
  it('throws 400 when a user tries to flag their OWN comment', async () => {
    wire({ fetch: { data: { ...OTHER_COMMENT, user_id: USER.id }, error: null } });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'You cannot flag your own comments',
    });
    // Guard must trip before any update.
    expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Flag toggle behavior — already-flagged comment is re-flagged idempotently
  // =========================================================================
  it('still succeeds (and re-asserts is_flagged) when the comment is already flagged', async () => {
    // The route unconditionally sets is_flagged=true + pending; there is no
    // "unflag" toggle. A comment already flagged stays flagged.
    wire({ fetch: { data: { ...OTHER_COMMENT, is_flagged: true }, error: null } });

    const result = await handler(evt());
    expect(result.success).toBe(true);
    const updateArg = (mockSupabase._mockUpdate as any).mock.calls[0][0];
    expect(updateArg.is_flagged).toBe(true);
    expect(updateArg.moderation_status).toBe('pending');
  });

  // =========================================================================
  //  Update failure (500)
  // =========================================================================
  it('throws 500 with the db message when the update returns an error', async () => {
    wire({ update: { data: null, error: { message: 'update boom' } } });

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      message: 'update boom',
    });
  });

  // =========================================================================
  //  Error wrapping — unexpected (non-statusCode) errors become 500
  // =========================================================================
  it('wraps an unexpected fetch rejection as 500', async () => {
    mockSupabase = createMockSupabaseClient();
    (mockSupabase._mockSingle as any).mockReset();
    (mockSupabase._mockSingle as any).mockRejectedValue(new Error('connection reset'));
    (getServiceClient as any).mockReturnValue(mockSupabase);

    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 500,
      message: 'connection reset',
    });
  });

  it('preserves a thrown statusCode (does not coerce a 404 into 500 in the catch)', async () => {
    // The catch block re-throws with error.statusCode || 500; a 404 from the
    // not-found branch must survive the wrapper intact.
    wire({ fetch: { data: null, error: null } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });
});
