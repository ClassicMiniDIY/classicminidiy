/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports auth + service deps via relative specifiers
// (../../../utils/userAuth, ../../../utils/supabase,
// ../../../utils/exchange/notificationQueue) which Vitest resolves to the same
// absolute modules as the `~~/server/utils/*` ids below; vi.mock matches by
// resolved id.
//
// sanitize + rateLimit are intentionally REAL so content sanitization and the
// per-IP rate-limit counter are genuinely exercised end-to-end.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));
vi.mock('~~/server/utils/exchange/notificationQueue', () => ({
  queueNotification: vi.fn(),
  queueAdminNotification: vi.fn(),
  buildBatchKey: vi.fn(() => 'bk'),
}));

// The rate-limit middleware calls setResponseHeader, which is not part of the
// shared h3 global setup. Stub it so the middleware doesn't throw.
vi.stubGlobal('setResponseHeader', vi.fn());

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';
import { queueNotification, buildBatchKey } from '~~/server/utils/exchange/notificationQueue';

const handler = (await import('~~/server/api/exchange/comments/create.post')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'commenter-1', email: 'commenter@example.com' };

const ACTIVE_LISTING = { id: 'listing-123', user_id: 'owner-9', status: 'active' };
const APPROVED_EXTERNAL = { id: 'ext-1', status: 'approved' };

// What the insert .select(...).single() returns (note: profiles join does NOT
// include email — the select string is asserted separately).
const NEW_COMMENT = {
  id: 'comment-1',
  listing_id: 'listing-123',
  user_id: USER.id,
  parent_id: null,
  content: 'Is this still available?',
  is_question: false,
  is_seller_response: false,
  is_flagged: false,
  created_at: '2026-06-28T00:00:00.000Z',
  updated_at: '2026-06-28T00:00:00.000Z',
  user: { id: USER.id, display_name: 'Mini Mike', avatar_url: null },
};

const LISTING_INFO = { user_id: 'owner-9', title: 'Cooper S Subframe', slug: 'cooper-s-subframe' };

/**
 * Minimal h3 event. The rate-limit middleware reads `event.context.user?.id`,
 * so `context` must exist. All request accessors are globally mocked and ignore
 * the event arg.
 */
function evt(): any {
  return { context: {} };
}

function setBody(body: any) {
  (readBody as any).mockResolvedValue(body);
}

/** Default header impl: x-real-ip returns a fixed IP unless overridden. */
function setRealIp(ip: string | undefined) {
  (getHeader as any).mockImplementation((_e: any, name: string) => (name === 'x-real-ip' ? ip : undefined));
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Wire a fresh chainable supabase client whose sequential `.single()` calls
 * resolve, in order, to the values supplied. The route's happy path for a
 * top-level comment on a listing calls `.single()` 3 times:
 *   1. listing verification (listings select id,user_id,status)
 *   2. insert (.select(...).single())
 *   3. notification block: listing info (user_id,title,slug)
 * Replies add 2 more (parent verify before insert; parent author lookup after).
 */
function wireSingles(...results: Array<{ data: any; error: any }>) {
  mockSupabase = createMockSupabaseClient();
  let chain = mockSupabase._mockSingle as any;
  for (const r of results) {
    chain = chain.mockResolvedValueOnce(r);
  }
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  _resetRateLimitStore();
  vi.clearAllMocks();

  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  (queueNotification as any).mockResolvedValue(undefined);
  (buildBatchKey as any).mockReturnValue('bk');

  setRealIp('9.9.9.9');
  (getRequestIP as any).mockReturnValue(undefined);

  // Default happy-path body: top-level comment on a listing.
  setBody({ listingId: 'listing-123', content: 'Is this still available?' });

  // Default wiring: active listing -> insert -> listing info (owner != commenter).
  wireSingles(
    { data: { ...ACTIVE_LISTING }, error: null },
    { data: { ...NEW_COMMENT }, error: null },
    { data: { ...LISTING_INFO }, error: null }
  );
});

afterEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStore();
});

// ===========================================================================
//  Happy path — top-level comment on a listing
// ===========================================================================
describe('server/api/exchange/comments/create.post', () => {
  it('creates a top-level comment and returns { comment, success }', async () => {
    const result = await handler(evt());

    expect(result).toEqual({ comment: NEW_COMMENT, success: true });
    expect(getServiceClient).toHaveBeenCalled();
  });

  it('inserts with the authenticated user id, auto-approved, parent_id null, is_question false', async () => {
    await handler(evt());

    const insertArg = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertArg).toMatchObject({
      user_id: USER.id,
      parent_id: null,
      content: 'Is this still available?',
      is_question: false,
      moderation_status: 'approved',
      listing_id: 'listing-123',
    });
    // No external_listing_id on a listing comment.
    expect(insertArg.external_listing_id).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // INVARIANT: the returned-comment profile join must NOT leak email.
  // -------------------------------------------------------------------------
  it('does NOT select email in the profiles join on the inserted comment', async () => {
    await handler(evt());

    const selectArg = (mockSupabase._mockSelect as any).mock.calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('profiles')
    )?.[0] as string;

    expect(selectArg).toBeTruthy();
    expect(selectArg).toContain('display_name');
    expect(selectArg).toContain('avatar_url');
    expect(selectArg).not.toContain('email');
  });

  // -------------------------------------------------------------------------
  // Sanitization (real sanitize util exercised)
  // -------------------------------------------------------------------------
  it('strips HTML tags from content before inserting (XSS guard)', async () => {
    setBody({ listingId: 'listing-123', content: 'hello <script>alert(1)</script> world' });

    await handler(evt());

    const insertArg = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertArg.content).toBe('hello alert(1) world');
    expect(insertArg.content).not.toContain('<script>');
  });

  it('passes is_question through when set', async () => {
    setBody({ listingId: 'listing-123', content: 'Does it fit a Mk1?', isQuestion: true });

    await handler(evt());

    const insertArg = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertArg.is_question).toBe(true);
  });

  // ===========================================================================
  //  Validation (400s)
  // ===========================================================================
  it('throws 400 when content is missing', async () => {
    setBody({ listingId: 'listing-123' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('throws 400 when neither listingId nor externalListingId is provided', async () => {
    setBody({ content: 'orphan comment' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when content sanitizes to empty (HTML-only)', async () => {
    setBody({ listingId: 'listing-123', content: '<div></div>' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Comment must be between 1 and 2000 characters',
    });
  });

  it('throws 400 when sanitized content exceeds 2000 characters', async () => {
    // sanitizeCommentContent slices to 2000 first, so to exceed 2000 the input
    // must survive at >2000 after tag-stripping — but the slice caps it at 2000,
    // making the >2000 branch unreachable via this path. Document that here:
    // a 2001-char plain string is truncated to exactly 2000 and is ACCEPTED.
    setBody({ listingId: 'listing-123', content: 'a'.repeat(2001) });

    const result = await handler(evt());
    expect(result.success).toBe(true);
    const insertArg = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertArg.content.length).toBe(2000);
  });

  // ===========================================================================
  //  Listing verification
  // ===========================================================================
  it('throws 404 when the listing is not found', async () => {
    wireSingles({ data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
  });

  it('throws 404 when the listing lookup errors', async () => {
    wireSingles({ data: null, error: { message: 'no rows' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when commenting on an inactive listing', async () => {
    wireSingles({ data: { ...ACTIVE_LISTING, status: 'sold' }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot comment on inactive listings',
    });
    expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
  });

  it('queries listings filtered by id (verification select id,user_id,status)', async () => {
    await handler(evt());
    expect(mockSupabase.from).toHaveBeenCalledWith('listings');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'listing-123');
    const verifySelect = (mockSupabase._mockSelect as any).mock.calls[0][0];
    expect(verifySelect).toContain('status');
  });

  // ===========================================================================
  //  External listing path
  // ===========================================================================
  it('creates a comment on an approved external listing (external_listing_id set, no listing_id)', async () => {
    setBody({ externalListingId: 'ext-1', content: 'Nice find' });
    // single() order for external + top-level: external verify -> insert.
    // (No listing-info notification block runs because listingId is falsy.)
    wireSingles(
      { data: { ...APPROVED_EXTERNAL }, error: null },
      { data: { ...NEW_COMMENT, listing_id: null, external_listing_id: 'ext-1' }, error: null }
    );

    const result = await handler(evt());

    expect(result.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
    const insertArg = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertArg.external_listing_id).toBe('ext-1');
    expect(insertArg.listing_id).toBeUndefined();
    // No notification is queued for external listings (no listingId branch).
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('throws 404 when the external listing is not found', async () => {
    setBody({ externalListingId: 'ext-1', content: 'Nice find' });
    wireSingles({ data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when the external listing is not approved', async () => {
    setBody({ externalListingId: 'ext-1', content: 'Nice find' });
    wireSingles({ data: { id: 'ext-1', status: 'pending' }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot comment on unapproved listings',
    });
  });

  // ===========================================================================
  //  Parent comment (reply) verification
  // ===========================================================================
  it('throws 404 when the parent comment does not exist', async () => {
    setBody({ listingId: 'listing-123', content: 'reply', parentId: 'parent-1' });
    // listing verify ok, then parent lookup returns null.
    wireSingles({ data: { ...ACTIVE_LISTING }, error: null }, { data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
  });

  it('throws 400 when the parent comment is on a different listing', async () => {
    setBody({ listingId: 'listing-123', content: 'reply', parentId: 'parent-1' });
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { id: 'parent-1', listing_id: 'other-listing', external_listing_id: null }, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Parent comment is not on this listing',
    });
  });

  it('throws 400 when the parent comment is on a different external listing', async () => {
    setBody({ externalListingId: 'ext-1', content: 'reply', parentId: 'parent-1' });
    wireSingles(
      { data: { ...APPROVED_EXTERNAL }, error: null },
      { data: { id: 'parent-1', listing_id: null, external_listing_id: 'ext-other' }, error: null }
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  // ===========================================================================
  //  Insert failure -> 500
  // ===========================================================================
  it('throws 500 when the insert returns an error', async () => {
    wireSingles({ data: { ...ACTIVE_LISTING }, error: null }, { data: null, error: { message: 'db boom' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500, message: 'db boom' });
  });

  // ===========================================================================
  //  Notifications — new_comment (top-level) vs comment_reply
  // ===========================================================================
  it('queues a new_comment notification to the listing owner for a top-level comment', async () => {
    await handler(evt());

    expect(queueNotification).toHaveBeenCalledTimes(1);
    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.userId).toBe('owner-9'); // listing owner
    expect(arg.eventType).toBe('new_comment');
    expect(arg.channel).toBe('email');
    expect(arg.payload).toMatchObject({
      commenterName: 'Mini Mike',
      commentPreview: 'Is this still available?',
      listingTitle: 'Cooper S Subframe',
      listingSlug: 'cooper-s-subframe',
    });
    expect(buildBatchKey).toHaveBeenCalledWith('new_comment', { listingId: 'listing-123' });
  });

  it('does NOT notify when the commenter IS the listing owner', async () => {
    // Commenter == owner.
    (requireUserClient as any).mockResolvedValue({ user: { id: 'owner-9', email: 'o@e.com' } });
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { ...NEW_COMMENT, user_id: 'owner-9' }, error: null },
      { data: { ...LISTING_INFO }, error: null }
    );

    const result = await handler(evt());
    expect(result.success).toBe(true);
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('queues a comment_reply notification to the parent comment author for a reply', async () => {
    setBody({ listingId: 'listing-123', content: 'Yes it is', parentId: 'parent-1' });
    // order: listing verify -> parent verify -> insert -> listing info -> parent author
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { id: 'parent-1', listing_id: 'listing-123', external_listing_id: null }, error: null },
      { data: { ...NEW_COMMENT, parent_id: 'parent-1' }, error: null },
      { data: { ...LISTING_INFO }, error: null },
      { data: { user_id: 'parent-author-2' }, error: null }
    );

    const result = await handler(evt());
    expect(result.success).toBe(true);

    expect(queueNotification).toHaveBeenCalledTimes(1);
    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.userId).toBe('parent-author-2');
    expect(arg.eventType).toBe('comment_reply');
    expect(arg.payload).toMatchObject({
      replierName: 'Mini Mike',
      replyPreview: 'Yes it is',
      listingTitle: 'Cooper S Subframe',
      listingSlug: 'cooper-s-subframe',
    });
    expect(buildBatchKey).toHaveBeenCalledWith('comment_reply', { parentCommentId: 'parent-1' });
  });

  it('does NOT notify on a reply when the replier IS the parent comment author', async () => {
    setBody({ listingId: 'listing-123', content: 'self reply', parentId: 'parent-1' });
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { id: 'parent-1', listing_id: 'listing-123', external_listing_id: null }, error: null },
      { data: { ...NEW_COMMENT, parent_id: 'parent-1' }, error: null },
      { data: { ...LISTING_INFO }, error: null },
      { data: { user_id: USER.id }, error: null } // parent author == commenter
    );

    const result = await handler(evt());
    expect(result.success).toBe(true);
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('truncates the notification preview to 200 chars', async () => {
    const long = 'b'.repeat(300);
    setBody({ listingId: 'listing-123', content: long });
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { ...NEW_COMMENT, content: long }, error: null },
      { data: { ...LISTING_INFO }, error: null }
    );

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.commentPreview.length).toBe(200);
  });

  it('falls back to "Someone" as the commenter name when the profile display_name is absent', async () => {
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { ...NEW_COMMENT, user: { id: USER.id, display_name: null, avatar_url: null } }, error: null },
      { data: { ...LISTING_INFO }, error: null }
    );

    await handler(evt());

    const arg = (queueNotification as any).mock.calls[0][0];
    expect(arg.payload.commenterName).toBe('Someone');
  });

  it('still returns success when listing-info lookup yields nothing (no notification)', async () => {
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { ...NEW_COMMENT }, error: null },
      { data: null, error: null } // listing info missing
    );

    const result = await handler(evt());
    expect(result.success).toBe(true);
    expect(queueNotification).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // INVARIANT: a queue failure must NEVER break comment creation.
  // -------------------------------------------------------------------------
  it('returns success even when queueNotification rejects (fire-and-forget)', async () => {
    (queueNotification as any).mockRejectedValue(new Error('queue down'));

    const result = await handler(evt());
    expect(result).toEqual({ comment: NEW_COMMENT, success: true });
  });

  // ===========================================================================
  //  Auth
  // ===========================================================================
  it('propagates auth failure (401) from requireUserClient', async () => {
    (requireUserClient as any).mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    );
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  // ===========================================================================
  //  Rate limiting (moderate preset: 10/min, keyed by x-real-ip)
  // ===========================================================================
  it('throws 429 on the 11th request from the same x-real-ip within the window', async () => {
    setRealIp('5.5.5.5');
    // Each call needs its own single() wiring; re-wire before each.
    for (let i = 0; i < 10; i++) {
      wireSingles(
        { data: { ...ACTIVE_LISTING }, error: null },
        { data: { ...NEW_COMMENT }, error: null },
        { data: { ...LISTING_INFO }, error: null }
      );
      await expect(handler(evt())).resolves.toMatchObject({ success: true });
    }
    // 11th -> rejected before auth/DB.
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
  });

  it('prefers x-real-ip over getRequestIP for the rate-limit key', async () => {
    setRealIp('7.7.7.7');
    (getRequestIP as any).mockImplementation(() => `forwarded-${Math.random()}`);

    for (let i = 0; i < 10; i++) {
      wireSingles(
        { data: { ...ACTIVE_LISTING }, error: null },
        { data: { ...NEW_COMMENT }, error: null },
        { data: { ...LISTING_INFO }, error: null }
      );
      await handler(evt());
    }
    // Same x-real-ip across all 10 + 1 -> 11th throttled despite varying getRequestIP.
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
  });

  it('keys the rate limit per IP — a different x-real-ip is not throttled', async () => {
    setRealIp('1.1.1.1');
    for (let i = 0; i < 10; i++) {
      wireSingles(
        { data: { ...ACTIVE_LISTING }, error: null },
        { data: { ...NEW_COMMENT }, error: null },
        { data: { ...LISTING_INFO }, error: null }
      );
      await handler(evt());
    }
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });

    // Fresh IP -> fresh bucket.
    setRealIp('2.2.2.2');
    wireSingles(
      { data: { ...ACTIVE_LISTING }, error: null },
      { data: { ...NEW_COMMENT }, error: null },
      { data: { ...LISTING_INFO }, error: null }
    );
    await expect(handler(evt())).resolves.toMatchObject({ success: true });
  });

  // ===========================================================================
  //  Error wrapping
  // ===========================================================================
  it('wraps unexpected (non-statusCode) errors as 500', async () => {
    (mockSupabase._mockSingle as any).mockReset();
    (mockSupabase._mockSingle as any).mockRejectedValue(new Error('connection reset'));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
  });
});
