import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';

// useComments depends on:
//  - useToast      (real CMDIY composable — must be stubbed)
//  - useAuth       (stubbed; only `.user` is read)
//  - useSupabase   (stubbed; only `.auth.getSession()` is read for the Bearer token)
//  - usePostHog    (globally stubbed in vitest.setup; re-stubbed here for capture spying)
//  - $fetch        (globally stubbed in vitest.setup)
//  - useState      (globally stubbed in vitest.setup; keyed per statePrefix)
//  - ~/utils/constants  (real — MAX_CONTENT_LENGTH = 2000)

const TEST_ACCESS_TOKEN = 'test-access-token';
const listingId = 'listing-123';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;

const stubAuth = (userValue: any) => {
  vi.stubGlobal('useAuth', () => ({ user: { value: userValue } }));
};

// A minimal comment shaped like the composable's Comment interface, enough for
// the recursive totalComments count.
const makeComment = (overrides: Record<string, any> = {}) => ({
  id: 'c-1',
  listing_id: listingId,
  external_listing_id: null,
  user_id: 'test-user-id',
  parent_id: null,
  content: 'Hello',
  is_question: false,
  is_seller_response: false,
  is_flagged: false,
  moderation_status: 'approved' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user: { id: 'test-user-id', display_name: 'Test User', avatar_url: null, email: 'test@example.com' },
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockSupabase.auth.getSession = vi
    .fn()
    .mockResolvedValue({ data: { session: { access_token: TEST_ACCESS_TOKEN } }, error: null });
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  stubAuth(createMockUser());
  // $fetch globally stubbed in vitest.setup; reset to benign value each test
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ comments: [], hasMore: false }));

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
});

const importComposable = async () => {
  const mod = await import('~/app/composables/useComments');
  return mod.useComments;
};

describe('useComments', () => {
  // ---------------------------------------------------------------------------
  // exposed surface / initial state
  // ---------------------------------------------------------------------------
  describe('exposed surface & initial state', () => {
    it('initializes comments/loading/submitting/hasMore and totalComments, exposes all methods', async () => {
      const useComments = await importComposable();
      const c = useComments(listingId);

      expect(c.comments.value).toEqual([]);
      expect(c.loading.value).toBe(false);
      expect(c.submitting.value).toBe(false);
      expect(c.hasMore.value).toBe(false);
      expect(c.totalComments.value).toBe(0);

      expect(typeof c.fetchComments).toBe('function');
      expect(typeof c.loadMore).toBe('function');
      expect(typeof c.postComment).toBe('function');
      expect(typeof c.flagComment).toBe('function');
      expect(typeof c.deleteComment).toBe('function');
    });

    it('defaults targetType to listing (state shared with explicit listing type)', async () => {
      const useComments = await importComposable();
      const a = useComments(listingId);
      const b = useComments(listingId, 'listing');

      a.comments.value = [makeComment({ id: '1' })];
      expect(b.comments.value).toEqual(a.comments.value);
      expect(b.comments.value.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // totalComments computed
  // ---------------------------------------------------------------------------
  describe('totalComments computed', () => {
    it('counts top-level comments', async () => {
      const useComments = await importComposable();
      const { comments, totalComments } = useComments(listingId);

      comments.value = [makeComment({ id: '1' }), makeComment({ id: '2' }), makeComment({ id: '3' })];

      expect(totalComments.value).toBe(3);
    });

    it('counts nested replies recursively', async () => {
      const useComments = await importComposable();
      const { comments, totalComments } = useComments(listingId);

      comments.value = [
        makeComment({
          id: '1',
          replies: [
            makeComment({ id: '1-1', parent_id: '1' }),
            makeComment({
              id: '1-2',
              parent_id: '1',
              replies: [makeComment({ id: '1-2-1', parent_id: '1-2' })],
            }),
          ],
        }),
        makeComment({ id: '2' }),
      ];

      // 1 (root) + 2 (replies to 1) + 1 (nested reply) + 1 (second root) = 5
      expect(totalComments.value).toBe(5);
    });

    it('handles comments with empty replies array', async () => {
      const useComments = await importComposable();
      const { comments, totalComments } = useComments(listingId);

      comments.value = [makeComment({ id: '1', replies: [] }), makeComment({ id: '2', replies: [] })];

      expect(totalComments.value).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchComments()
  // ---------------------------------------------------------------------------
  describe('fetchComments()', () => {
    it('sets loading true while fetching, false after resolve', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.stubGlobal('$fetch', vi.fn().mockReturnValue(fetchPromise));

      const useComments = await importComposable();
      const { fetchComments, loading } = useComments(listingId);

      const promise = fetchComments();
      expect(loading.value).toBe(true);

      resolvePromise!({ comments: [], hasMore: false });
      await promise;

      expect(loading.value).toBe(false);
    });

    it('fetches from the exchange endpoint with limit/offset and stores comments + hasMore', async () => {
      const mockComments = [makeComment({ id: '1' }), makeComment({ id: '2' })];
      const fetchFn = vi.fn().mockResolvedValue({ comments: mockComments, hasMore: true });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { fetchComments, comments, hasMore } = useComments(listingId);

      await fetchComments();

      expect(fetchFn).toHaveBeenCalledWith(`/api/exchange/comments/${listingId}?limit=20&offset=0`);
      expect(comments.value).toEqual(mockComments);
      expect(hasMore.value).toBe(true);
    });

    it('adds type=external to the query string for external targets', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { fetchComments } = useComments('ext-1', 'external');

      await fetchComments();

      expect(fetchFn).toHaveBeenCalledWith('/api/exchange/comments/ext-1?type=external&limit=20&offset=0');
    });

    it('replaces comments when append is false', async () => {
      const useComments = await importComposable();
      const { fetchComments, comments } = useComments(listingId);

      comments.value = [makeComment({ id: 'old' })];
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ comments: [makeComment({ id: 'new' })], hasMore: false }));

      await fetchComments(false);

      expect(comments.value.map((c: any) => c.id)).toEqual(['new']);
    });

    it('appends comments when append is true', async () => {
      const useComments = await importComposable();
      const { fetchComments, comments } = useComments(listingId);

      comments.value = [makeComment({ id: 'existing' })];
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ comments: [makeComment({ id: 'appended' })], hasMore: false }));

      await fetchComments(true);

      expect(comments.value.map((c: any) => c.id)).toEqual(['existing', 'appended']);
    });

    it('shows an error toast, logs to console, and resets loading on fetch failure', async () => {
      const error = new Error('Network error');
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(error));

      const useComments = await importComposable();
      const { fetchComments, loading } = useComments(listingId);

      await fetchComments();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load comments',
        color: 'error',
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching comments:', error);
      expect(loading.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // loadMore()
  // ---------------------------------------------------------------------------
  describe('loadMore()', () => {
    it('advances offset by PAGE_SIZE and appends the next page', async () => {
      const useComments = await importComposable();
      const { fetchComments, loadMore, comments } = useComments(listingId);

      // First page seeds offset=0 and the comments array.
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({ comments: [makeComment({ id: 'p1' })], hasMore: true })
        .mockResolvedValueOnce({ comments: [makeComment({ id: 'p2' })], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      await fetchComments();
      await loadMore();

      expect(fetchFn).toHaveBeenNthCalledWith(1, `/api/exchange/comments/${listingId}?limit=20&offset=0`);
      expect(fetchFn).toHaveBeenNthCalledWith(2, `/api/exchange/comments/${listingId}?limit=20&offset=20`);
      expect(comments.value.map((c: any) => c.id)).toEqual(['p1', 'p2']);
    });
  });

  // ---------------------------------------------------------------------------
  // postComment()
  // ---------------------------------------------------------------------------
  describe('postComment()', () => {
    it('warns and returns false when not authenticated', async () => {
      stubAuth(null);
      const fetchFn = vi.fn();
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      const result = await postComment('Test comment');

      expect(result).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to post comments',
        color: 'warning',
      });
    });

    it('warns and returns false for empty/whitespace content', async () => {
      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      const result = await postComment('   ');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: 'Comment cannot be empty',
        color: 'warning',
      });
    });

    it('warns and returns false for content exceeding MAX_CONTENT_LENGTH', async () => {
      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      const result = await postComment('a'.repeat(2001));

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: 'Comment must be less than 2000 characters',
        color: 'warning',
      });
    });

    it('sets submitting true while posting, false after', async () => {
      let resolvePromise: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      // create resolves on demand; subsequent fetchComments resolves immediately
      const fetchFn = vi
        .fn()
        .mockImplementationOnce(() => createPromise)
        .mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment, submitting } = useComments(listingId);

      const promise = postComment('Test comment');
      expect(submitting.value).toBe(true);

      resolvePromise!({ success: true });
      await promise;

      expect(submitting.value).toBe(false);
    });

    it('posts to the create endpoint with listingId, Bearer header, trimmed content, parentId & isQuestion', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      await postComment('  Test comment  ', null, false);

      expect(fetchFn).toHaveBeenCalledWith('/api/exchange/comments/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
        body: {
          content: 'Test comment',
          parentId: null,
          isQuestion: false,
          listingId,
        },
      });
    });

    it('sends externalListingId (not listingId) for external targets', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments('ext-1', 'external');

      await postComment('Hi');

      const createCall = fetchFn.mock.calls.find((c) => c[0] === '/api/exchange/comments/create');
      expect(createCall).toBeTruthy();
      expect(createCall![1].body).toMatchObject({ externalListingId: 'ext-1' });
      expect(createCall![1].body).not.toHaveProperty('listingId');
    });

    it('passes parentId for replies and isQuestion flag', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      await postComment('Is this available?', 'parent-id', true);

      const createCall = fetchFn.mock.calls.find((c) => c[0] === '/api/exchange/comments/create');
      expect(createCall![1].body).toMatchObject({ parentId: 'parent-id', isQuestion: true });
    });

    it('omits the Authorization header when there is no session token', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      await postComment('Hi');

      const createCall = fetchFn.mock.calls.find((c) => c[0] === '/api/exchange/comments/create');
      expect(createCall![1].headers).toEqual({});
    });

    it('returns true, refreshes comments, captures analytics & shows success toast on success', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      const result = await postComment('Test comment', null, false);

      expect(result).toBe(true);
      // refreshes via fetchComments
      expect(fetchFn).toHaveBeenCalledWith(`/api/exchange/comments/${listingId}?limit=20&offset=0`);
      expect(mockCapture).toHaveBeenCalledWith('comment_posted', {
        listing_id: listingId,
        is_reply: false,
        content_length: 'Test comment'.length,
        target_type: 'listing',
      });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Your comment has been posted',
        color: 'success',
      });
    });

    it('reports is_reply:true and target_type:external in the success analytics event', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { postComment } = useComments('ext-1', 'external');

      await postComment('reply text', 'parent-1', false);

      expect(mockCapture).toHaveBeenCalledWith('comment_posted', {
        listing_id: 'ext-1',
        is_reply: true,
        content_length: 'reply text'.length,
        target_type: 'external',
      });
    });

    it('on failure: returns false, captures comment_failed, shows custom error, resets submitting', async () => {
      const error = { data: { message: 'Custom error message' } };
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(error));

      const useComments = await importComposable();
      const { postComment, submitting } = useComments(listingId);

      const result = await postComment('Test comment');

      expect(result).toBe(false);
      expect(mockCapture).toHaveBeenCalledWith('comment_failed', {
        listing_id: listingId,
        error_type: 'Custom error message',
        target_type: 'listing',
      });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Custom error message',
        color: 'error',
      });
      expect(submitting.value).toBe(false);
    });

    it('falls back to a generic error message when no custom message is present', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const useComments = await importComposable();
      const { postComment } = useComments(listingId);

      const result = await postComment('Test comment');

      expect(result).toBe(false);
      // capture uses error.message ('Network error') for error_type fallback
      expect(mockCapture).toHaveBeenCalledWith('comment_failed', {
        listing_id: listingId,
        error_type: 'Network error',
        target_type: 'listing',
      });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to post comment',
        color: 'error',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // flagComment()
  // ---------------------------------------------------------------------------
  describe('flagComment()', () => {
    it('warns and returns false when not authenticated', async () => {
      stubAuth(null);
      const fetchFn = vi.fn();
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { flagComment } = useComments(listingId);

      const result = await flagComment('comment-123');

      expect(result).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to flag comments',
        color: 'warning',
      });
    });

    it('PATCHes the flag endpoint with the Bearer header', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { flagComment } = useComments(listingId);

      await flagComment('comment-123');

      expect(fetchFn).toHaveBeenCalledWith('/api/exchange/comments/comment-123/flag', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
    });

    it('returns true, shows info toast, and refreshes comments on success', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { flagComment } = useComments(listingId);

      const result = await flagComment('comment-123');

      expect(result).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Flagged',
        description: 'Comment has been flagged for review',
        color: 'info',
      });
      expect(fetchFn).toHaveBeenCalledWith(`/api/exchange/comments/${listingId}?limit=20&offset=0`);
    });

    it('returns false and shows custom error toast on API failure', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ data: { message: 'Already flagged' } }));

      const useComments = await importComposable();
      const { flagComment } = useComments(listingId);

      const result = await flagComment('comment-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Already flagged',
        color: 'error',
      });
    });

    it('falls back to a generic error message when no custom message', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('boom')));

      const useComments = await importComposable();
      const { flagComment } = useComments(listingId);

      const result = await flagComment('comment-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to flag comment',
        color: 'error',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteComment()
  // ---------------------------------------------------------------------------
  describe('deleteComment()', () => {
    it('returns false silently (no toast) when not authenticated', async () => {
      stubAuth(null);
      const fetchFn = vi.fn();
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { deleteComment } = useComments(listingId);

      const result = await deleteComment('comment-123');

      expect(result).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockToast.add).not.toHaveBeenCalled();
    });

    it('DELETEs the delete endpoint with the Bearer header', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { deleteComment } = useComments(listingId);

      await deleteComment('comment-123');

      expect(fetchFn).toHaveBeenCalledWith('/api/exchange/comments/comment-123/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
    });

    it('returns true, shows info toast, and refreshes comments on success', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ comments: [], hasMore: false });
      vi.stubGlobal('$fetch', fetchFn);

      const useComments = await importComposable();
      const { deleteComment } = useComments(listingId);

      const result = await deleteComment('comment-123');

      expect(result).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Deleted',
        description: 'Comment has been deleted',
        color: 'info',
      });
      expect(fetchFn).toHaveBeenCalledWith(`/api/exchange/comments/${listingId}?limit=20&offset=0`);
    });

    it('returns false and shows custom error toast on API failure', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ data: { message: 'Not authorized to delete' } }));

      const useComments = await importComposable();
      const { deleteComment } = useComments(listingId);

      const result = await deleteComment('comment-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Not authorized to delete',
        color: 'error',
      });
    });

    it('falls back to a generic error message when no custom message', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('boom')));

      const useComments = await importComposable();
      const { deleteComment } = useComments(listingId);

      const result = await deleteComment('comment-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to delete comment',
        color: 'error',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // state isolation by target id + type (statePrefix invariant)
  // ---------------------------------------------------------------------------
  describe('state isolation', () => {
    it('keeps separate state for different listing ids', async () => {
      const useComments = await importComposable();
      const a = useComments('listing-1');
      const b = useComments('listing-2');

      a.comments.value = [makeComment({ id: '1', listing_id: 'listing-1' })];
      b.comments.value = [
        makeComment({ id: '2', listing_id: 'listing-2' }),
        makeComment({ id: '3', listing_id: 'listing-2' }),
      ];

      expect(a.comments.value.length).toBe(1);
      expect(b.comments.value.length).toBe(2);
      expect(a.totalComments.value).toBe(1);
      expect(b.totalComments.value).toBe(2);
    });

    it('keeps separate state for the same id across listing vs external types', async () => {
      const useComments = await importComposable();
      const listing = useComments('same-id', 'listing');
      const external = useComments('same-id', 'external');

      listing.comments.value = [makeComment({ id: 'L' })];
      external.comments.value = [makeComment({ id: 'E1' }), makeComment({ id: 'E2' })];

      expect(listing.comments.value.map((c: any) => c.id)).toEqual(['L']);
      expect(external.comments.value.map((c: any) => c.id)).toEqual(['E1', 'E2']);
    });
  });
});
