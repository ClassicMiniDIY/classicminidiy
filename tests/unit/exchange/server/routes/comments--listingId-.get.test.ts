/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports getServiceClient via the relative path
// '../../../utils/supabase', which Vitest resolves to the same absolute module
// as the '~~/server/utils/supabase' alias mocked below.
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SELECT = '~~/server/api/exchange/comments/[listingId].get';

/** Import the handler fresh (mocks are hoisted, so this is the mocked version). */
async function importHandler() {
  return (await import(SELECT)).default;
}

/**
 * Drive the terminal result of the comments query. The route awaits the query
 * builder directly (no `.single()`), so the builder's thenable `.then` is what
 * resolves `{ data, error }`. Override it for the current mock client.
 */
function resolveComments(result: { data?: any; error?: any }) {
  (mockSupabase._queryBuilder as any).then = vi.fn((resolve: any) =>
    resolve({ data: result.data ?? null, error: result.error ?? null })
  );
}

function setRouterParam(value: any) {
  (getRouterParam as any).mockImplementation((_e: any, name: string) =>
    name === 'listingId' ? value : undefined
  );
}

function setQuery(query: Record<string, any>) {
  (getQuery as any).mockReturnValue(query);
}

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  // Sensible defaults: a valid listingId, no special query params.
  setRouterParam('listing-123');
  setQuery({});
  resolveComments({ data: [], error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// A small fixture of approved comments: 2 roots, 1 reply to the first root.
function commentFixture() {
  return [
    {
      id: 'c1',
      listing_id: 'listing-123',
      external_listing_id: null,
      user_id: 'u1',
      parent_id: null,
      content: 'Is this still available?',
      is_question: true,
      is_seller_response: false,
      is_flagged: false,
      moderation_status: 'approved',
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      user: { id: 'u1', display_name: 'Alice', avatar_url: 'https://x/a.png' },
    },
    {
      id: 'r1',
      listing_id: 'listing-123',
      external_listing_id: null,
      user_id: 'seller-1',
      parent_id: 'c1',
      content: 'Yes it is.',
      is_question: false,
      is_seller_response: true,
      is_flagged: false,
      moderation_status: 'approved',
      created_at: '2026-06-01T01:00:00Z',
      updated_at: '2026-06-01T01:00:00Z',
      user: { id: 'seller-1', display_name: 'Seller', avatar_url: null },
    },
    {
      id: 'c2',
      listing_id: 'listing-123',
      external_listing_id: null,
      user_id: 'u2',
      parent_id: null,
      content: 'Will you ship to the UK?',
      is_question: true,
      is_seller_response: false,
      is_flagged: false,
      moderation_status: 'approved',
      created_at: '2026-06-01T02:00:00Z',
      updated_at: '2026-06-01T02:00:00Z',
      user: { id: 'u2', display_name: 'Bob', avatar_url: null },
    },
  ];
}

// ===========================================================================
describe('GET /api/exchange/comments/[listingId]', () => {
  // ---- validation -------------------------------------------------------
  it('throws 400 when listingId is missing', async () => {
    setRouterParam(undefined);
    const handler = await importHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Listing ID is required',
    });
  });

  it('throws 400 when listingId is an empty string', async () => {
    setRouterParam('');
    const handler = await importHandler();
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  // ---- happy path: tree building ----------------------------------------
  it('returns approved comments organized into a parent/reply tree', async () => {
    resolveComments({ data: commentFixture(), error: null });
    const handler = await importHandler();

    const res = await handler({} as any);

    // Two root comments; the reply is nested, not a root.
    expect(res.total).toBe(2);
    expect(res.comments).toHaveLength(2);
    expect(res.comments.map((c: any) => c.id)).toEqual(['c1', 'c2']);

    // First root carries its reply.
    expect(res.comments[0].replies).toHaveLength(1);
    expect(res.comments[0].replies[0].id).toBe('r1');
    // Second root has no replies but still gets an empty array.
    expect(res.comments[1].replies).toEqual([]);

    expect(res.hasMore).toBe(false);
  });

  it('filters by listing_id (not external_listing_id) for internal listings', async () => {
    resolveComments({ data: [], error: null });
    const handler = await importHandler();
    await handler({} as any);

    expect(mockSupabase.from).toHaveBeenCalledWith('listing_comments');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('moderation_status', 'approved');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('listing_id', 'listing-123');
    expect(mockSupabase._queryBuilder.eq).not.toHaveBeenCalledWith('external_listing_id', expect.anything());
    expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('filters by external_listing_id when type=external', async () => {
    setQuery({ type: 'external' });
    resolveComments({ data: [], error: null });
    const handler = await importHandler();
    await handler({} as any);

    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('external_listing_id', 'listing-123');
    expect(mockSupabase._queryBuilder.eq).not.toHaveBeenCalledWith('listing_id', 'listing-123');
  });

  // ---- security invariant: embedded profile select excludes email -------
  it('does NOT select the email column in the embedded profile (security)', async () => {
    resolveComments({ data: [], error: null });
    const handler = await importHandler();
    await handler({} as any);

    const selectArg = (mockSupabase._mockSelect as any).mock.calls[0][0] as string;
    // The embedded profile must expose id/display_name/avatar_url only.
    expect(selectArg).toMatch(/user:profiles/);
    expect(selectArg).toMatch(/display_name/);
    expect(selectArg).toMatch(/avatar_url/);
    // No PII: the email column must never appear in the select string.
    expect(selectArg).not.toMatch(/\bemail\b/);
  });

  // ---- empty list -------------------------------------------------------
  it('returns an empty payload when there are no comments', async () => {
    resolveComments({ data: [], error: null });
    const handler = await importHandler();
    const res = await handler({} as any);
    expect(res).toEqual({ comments: [], total: 0, hasMore: false });
  });

  it('tolerates a null data result (treats it as empty)', async () => {
    resolveComments({ data: null, error: null });
    const handler = await importHandler();
    const res = await handler({} as any);
    expect(res).toEqual({ comments: [], total: 0, hasMore: false });
  });

  // ---- pagination -------------------------------------------------------
  it('paginates root comments via limit/offset and reports hasMore', async () => {
    // 5 root comments, no replies.
    const roots = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      parent_id: null,
      content: `comment ${i}`,
      moderation_status: 'approved',
      created_at: `2026-06-0${i + 1}T00:00:00Z`,
      user: { id: `u${i}`, display_name: `User ${i}`, avatar_url: null },
    }));
    setQuery({ limit: '2', offset: '0' });
    resolveComments({ data: roots, error: null });
    const handler = await importHandler();

    const res = await handler({} as any);
    expect(res.total).toBe(5);
    expect(res.comments).toHaveLength(2);
    expect(res.comments.map((c: any) => c.id)).toEqual(['c0', 'c1']);
    expect(res.hasMore).toBe(true); // 0 + 2 < 5
  });

  it('returns the last page with hasMore=false', async () => {
    const roots = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      parent_id: null,
      moderation_status: 'approved',
      created_at: `2026-06-0${i + 1}T00:00:00Z`,
      user: { id: `u${i}`, display_name: `User ${i}`, avatar_url: null },
    }));
    setQuery({ limit: '2', offset: '4' });
    resolveComments({ data: roots, error: null });
    const handler = await importHandler();

    const res = await handler({} as any);
    expect(res.comments.map((c: any) => c.id)).toEqual(['c4']);
    expect(res.hasMore).toBe(false); // 4 + 2 = 6 >= 5
  });

  it('clamps limit to a maximum of 100', async () => {
    // 101 root comments; with limit=999 clamped to 100, only 100 returned.
    const roots = Array.from({ length: 101 }, (_, i) => ({
      id: `c${i}`,
      parent_id: null,
      moderation_status: 'approved',
      created_at: '2026-06-01T00:00:00Z',
      user: { id: `u${i}`, display_name: `User ${i}`, avatar_url: null },
    }));
    setQuery({ limit: '999', offset: '0' });
    resolveComments({ data: roots, error: null });
    const handler = await importHandler();

    const res = await handler({} as any);
    expect(res.comments).toHaveLength(100);
    expect(res.total).toBe(101);
    expect(res.hasMore).toBe(true); // 0 + 100 < 101
  });

  it('defaults limit to 20 and offset to 0 for non-numeric query params', async () => {
    const roots = Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`,
      parent_id: null,
      moderation_status: 'approved',
      created_at: '2026-06-01T00:00:00Z',
      user: { id: `u${i}`, display_name: `User ${i}`, avatar_url: null },
    }));
    setQuery({ limit: 'abc', offset: 'xyz' });
    resolveComments({ data: roots, error: null });
    const handler = await importHandler();

    const res = await handler({} as any);
    expect(res.comments).toHaveLength(20); // default limit
    expect(res.total).toBe(25);
    expect(res.hasMore).toBe(true);
  });

  // ---- orphan reply (parent missing/unapproved) -------------------------
  it('drops replies whose parent is absent from the result set', async () => {
    // A reply pointing at a parent that is not in the returned data.
    resolveComments({
      data: [
        {
          id: 'orphan',
          parent_id: 'missing-parent',
          moderation_status: 'approved',
          created_at: '2026-06-01T00:00:00Z',
          user: { id: 'u9', display_name: 'Ghost', avatar_url: null },
        },
      ],
      error: null,
    });
    const handler = await importHandler();

    const res = await handler({} as any);
    // It is neither a root nor attachable to a parent → vanishes from output.
    expect(res.total).toBe(0);
    expect(res.comments).toEqual([]);
  });

  // ---- error paths ------------------------------------------------------
  it('throws 500 when the supabase query returns an error', async () => {
    resolveComments({ data: null, error: { message: 'db exploded' } });
    const handler = await importHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 500,
      message: 'db exploded',
    });
  });

  it('re-throws a 400 from the missing-id branch with its statusCode intact', async () => {
    // The catch block re-wraps but preserves error.statusCode (400, not 500).
    setRouterParam(undefined);
    const handler = await importHandler();
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 500 with a fallback message when getServiceClient throws', async () => {
    const mod = await import('~~/server/utils/supabase');
    (mod.getServiceClient as any).mockImplementationOnce(() => {
      throw new Error('no service key');
    });
    const handler = await importHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 500,
      message: 'no service key',
    });
  });
});
