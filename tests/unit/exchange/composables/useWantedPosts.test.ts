import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed } from 'vue';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// ---------------------------------------------------------------------------
// Composable under test: useWantedPosts
//
// Dependencies (resolved as Nuxt auto-imports off globalThis):
//  - useSupabase           (driven via createMockSupabaseClient handles)
//  - useAuth               (lazy: getUser() reads user.value inside each method)
//  - useToast              (real CMDIY composable — must be stubbed)
//  - useErrorHandler       (real composable — stubbed so we can assert handleError)
//  - usePostHog            (capital H — vitest.setup stubs a no-op; we override)
//
// Reads (fetch*) use direct Supabase queries; mutations that go through server
// endpoints (create/update/delete) call $fetch and require an access token from
// supabase.auth.getSession(). markFulfilled/renewWantedPost mutate via Supabase.
//
// CMDIY-specific differences from the TME reference:
//  - Server endpoints are namespaced under /api/exchange/wanted/...
//  - Posthog is usePostHog (capital H), not usePosthog
//  - The shared query builder lacks gte/lte/or — added here as chainable spies
// ---------------------------------------------------------------------------

const createMockWantedPost = (overrides: Record<string, any> = {}) => ({
  id: 'wp-123',
  user_id: 'test-user-id',
  title: 'Looking for 1275cc A-Series Engine',
  description: 'Need a complete 1275cc engine for my 1967 Cooper S rebuild.',
  category: 'engine',
  parts_subcategory: null,
  condition_preference: 'good',
  budget_min: 1000,
  budget_max: 3000,
  currency: 'USD',
  city: 'Austin',
  state_province: 'TX',
  country: 'US',
  status: 'active',
  moderation_status: 'approved',
  moderation_issues: null,
  expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  profiles: {
    id: 'test-user-id',
    display_name: 'Mini Enthusiast',
    username: 'mini_enthusiast',
    avatar_url: null,
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockHandleError: ReturnType<typeof vi.fn>;
let mockCapture: ReturnType<typeof vi.fn>;
let mockFetch: ReturnType<typeof vi.fn>;

// Drive a query builder that resolves to a list result (thenable). Used by
// fetchWantedPosts (terminated by .range()) and fetchUserWantedPosts
// (terminated by .order()) — both await the builder itself.
const resolveListWith = (result: { data: any; error: any; count?: any }) => {
  mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve(result));
};

// Override useAuth per test for anon vs authed scenarios.
const stubAuth = (userValue: any) => {
  const user = ref(userValue);
  vi.stubGlobal('useAuth', () => ({
    user,
    loading: ref(false),
    isAuthenticated: computed(() => !!user.value),
  }));
};

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  // The shared builder lacks gte/lte/or that fetchWantedPosts chains; add them
  // as chainable spies (returning the builder) without touching mockSupabase.ts.
  mockSupabase._queryBuilder.gte = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.lte = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.or = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.ilike = vi.fn().mockReturnValue(mockSupabase._queryBuilder);

  mockToast = { add: vi.fn() };
  mockHandleError = vi.fn();
  mockCapture = vi.fn();
  mockFetch = vi.fn();

  // setupGlobalMocks stubs useAuth + useSupabase; override useSupabase with our
  // handle-rich client. Default to an authenticated user.
  setupGlobalMocks({ user: createMockUser(), supabase: mockSupabase });
  stubAuth(createMockUser());

  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('useErrorHandler', () => ({ handleError: mockHandleError }));
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  vi.stubGlobal('$fetch', mockFetch);
});

afterEach(() => {
  cleanupGlobalMocks();
});

const load = async () => {
  const { useWantedPosts } = await import('~/app/composables/useWantedPosts');
  return useWantedPosts;
};

describe('useWantedPosts', () => {
  // =========================================================================
  // Initial state
  // =========================================================================
  describe('initial state', () => {
    it('initializes wantedPosts as an empty array', async () => {
      const useWantedPosts = await load();
      expect(useWantedPosts().wantedPosts.value).toEqual([]);
    });

    it('initializes currentPost as null', async () => {
      const useWantedPosts = await load();
      expect(useWantedPosts().currentPost.value).toBeNull();
    });

    it('initializes loading as false', async () => {
      const useWantedPosts = await load();
      expect(useWantedPosts().loading.value).toBe(false);
    });

    it('initializes totalCount as 0', async () => {
      const useWantedPosts = await load();
      expect(useWantedPosts().totalCount.value).toBe(0);
    });

    it('exposes all expected methods', async () => {
      const useWantedPosts = await load();
      const result = useWantedPosts();
      expect(typeof result.fetchWantedPosts).toBe('function');
      expect(typeof result.fetchWantedPost).toBe('function');
      expect(typeof result.fetchUserWantedPosts).toBe('function');
      expect(typeof result.createWantedPost).toBe('function');
      expect(typeof result.updateWantedPost).toBe('function');
      expect(typeof result.deleteWantedPost).toBe('function');
      expect(typeof result.markFulfilled).toBe('function');
      expect(typeof result.renewWantedPost).toBe('function');
    });
  });

  // =========================================================================
  // fetchWantedPosts
  // =========================================================================
  describe('fetchWantedPosts', () => {
    it('fetches active + approved posts with the profile join and default filters', async () => {
      const posts = [createMockWantedPost(), createMockWantedPost({ id: 'wp-456' })];
      resolveListWith({ data: posts, error: null, count: 2 });

      const useWantedPosts = await load();
      const { fetchWantedPosts, wantedPosts, totalCount } = useWantedPosts();
      const result = await fetchWantedPosts();

      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(
        '*, profiles:public_profiles!wanted_posts_user_id_fkey(id, display_name, username, avatar_url)',
        { count: 'exact' }
      );
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('moderation_status', 'approved');
      expect(result).toEqual(posts);
      expect(wantedPosts.value).toEqual(posts);
      expect(totalCount.value).toBe(2);
    });

    it('applies an OR search filter across title and description', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ search: 'Cooper' });
      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith('title.ilike.%Cooper%,description.ilike.%Cooper%');
    });

    it('applies a category filter', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ category: 'vehicle' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('category', 'vehicle');
    });

    it('applies a condition preference filter', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ conditionPreference: 'excellent' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('condition_preference', 'excellent');
    });

    it('applies budget minimum as gte on budget_max', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ budgetMin: 500 });
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('budget_max', 500);
    });

    it('applies budget maximum as lte on budget_min', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ budgetMax: 5000 });
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('budget_min', 5000);
    });

    it('treats budgetMin of 0 as a real filter (uses !== undefined guard)', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ budgetMin: 0, budgetMax: 0 });
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('budget_max', 0);
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('budget_min', 0);
    });

    it('applies a country filter via ilike with wildcards', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ country: 'US' });
      expect(mockSupabase._queryBuilder.ilike).toHaveBeenCalledWith('country', '%US%');
    });

    it('sorts by newest (created_at descending) by default', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts();
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('sorts by oldest (created_at ascending)', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ sortBy: 'oldest' });
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('sorts by budget_high (budget_max descending, nulls last)', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ sortBy: 'budget_high' });
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('budget_max', {
        ascending: false,
        nullsFirst: false,
      });
    });

    it('sorts by budget_low (budget_min ascending, nulls last)', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ sortBy: 'budget_low' });
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('budget_min', {
        ascending: true,
        nullsFirst: false,
      });
    });

    it('applies pagination range for an explicit page/perPage', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({ page: 3, perPage: 10 });
      // from = (3-1)*10 = 20, to = 20+10-1 = 29
      expect(mockSupabase._queryBuilder.range).toHaveBeenCalledWith(20, 29);
    });

    it('applies default pagination (page 1, perPage 20 -> range 0..19)', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts();
      expect(mockSupabase._queryBuilder.range).toHaveBeenCalledWith(0, 19);
    });

    it('toggles loading true during the fetch and false afterward', async () => {
      let loadingDuringFetch = false;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => {
        loadingDuringFetch = loadingRef.value;
        return resolve({ data: [], error: null, count: 0 });
      });

      const useWantedPosts = await load();
      const { fetchWantedPosts, loading: loadingRef } = useWantedPosts();

      expect(loadingRef.value).toBe(false);
      await fetchWantedPosts();
      expect(loadingDuringFetch).toBe(true);
      expect(loadingRef.value).toBe(false);
    });

    it('returns an empty array and calls handleError on a Supabase error', async () => {
      resolveListWith({ data: null, error: new Error('Database error'), count: null });
      const useWantedPosts = await load();
      const result = await useWantedPosts().fetchWantedPosts();
      expect(result).toEqual([]);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to load wanted posts' });
    });

    it('resets loading to false when an error occurs', async () => {
      resolveListWith({ data: null, error: new Error('Database error'), count: null });
      const useWantedPosts = await load();
      const { fetchWantedPosts, loading } = useWantedPosts();
      await fetchWantedPosts();
      expect(loading.value).toBe(false);
    });

    it('coerces a null count to 0', async () => {
      resolveListWith({ data: [createMockWantedPost()], error: null, count: null });
      const useWantedPosts = await load();
      const { fetchWantedPosts, totalCount } = useWantedPosts();
      await fetchWantedPosts();
      expect(totalCount.value).toBe(0);
    });

    it('coerces null data to an empty array', async () => {
      resolveListWith({ data: null, error: null, count: 0 });
      const useWantedPosts = await load();
      const { fetchWantedPosts, wantedPosts } = useWantedPosts();
      await fetchWantedPosts();
      expect(wantedPosts.value).toEqual([]);
    });

    it('applies multiple filters together', async () => {
      resolveListWith({ data: [], error: null, count: 0 });
      const useWantedPosts = await load();
      await useWantedPosts().fetchWantedPosts({
        search: 'engine',
        category: 'parts',
        conditionPreference: 'good',
        budgetMin: 100,
        budgetMax: 2000,
        country: 'UK',
        sortBy: 'budget_high',
        page: 2,
        perPage: 10,
      });

      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith('title.ilike.%engine%,description.ilike.%engine%');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('category', 'parts');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('condition_preference', 'good');
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('budget_max', 100);
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('budget_min', 2000);
      expect(mockSupabase._queryBuilder.ilike).toHaveBeenCalledWith('country', '%UK%');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('budget_max', {
        ascending: false,
        nullsFirst: false,
      });
      // from = (2-1)*10 = 10, to = 10+10-1 = 19
      expect(mockSupabase._queryBuilder.range).toHaveBeenCalledWith(10, 19);
    });
  });

  // =========================================================================
  // fetchWantedPost (single)
  // =========================================================================
  describe('fetchWantedPost', () => {
    it('fetches a single post by id with the profile join and sets currentPost', async () => {
      const post = createMockWantedPost();
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: post, error: null });

      const useWantedPosts = await load();
      const { fetchWantedPost, currentPost } = useWantedPosts();
      const result = await fetchWantedPost('wp-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(
        '*, profiles:public_profiles!wanted_posts_user_id_fkey(id, display_name, username, avatar_url)'
      );
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wp-123');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(post);
      expect(currentPost.value).toEqual(post);
    });

    it('resets loading to false after a successful fetch', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockWantedPost(), error: null });
      const useWantedPosts = await load();
      const { fetchWantedPost, loading } = useWantedPosts();
      expect(loading.value).toBe(false);
      await fetchWantedPost('wp-123');
      expect(loading.value).toBe(false);
    });

    it('returns null and calls handleError on failure', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Post not found') });
      const useWantedPosts = await load();
      const result = await useWantedPosts().fetchWantedPost('nonexistent-id');
      expect(result).toBeNull();
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to load wanted post' });
    });

    it('resets loading to false after an error', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Database error') });
      const useWantedPosts = await load();
      const { fetchWantedPost, loading } = useWantedPosts();
      await fetchWantedPost('wp-123');
      expect(loading.value).toBe(false);
    });
  });

  // =========================================================================
  // fetchUserWantedPosts
  // =========================================================================
  describe('fetchUserWantedPosts', () => {
    it('fetches all posts for the current authenticated user (no status filter)', async () => {
      const posts = [createMockWantedPost(), createMockWantedPost({ id: 'wp-456', status: 'fulfilled' })];
      resolveListWith({ data: posts, error: null });

      const useWantedPosts = await load();
      const { fetchUserWantedPosts, wantedPosts } = useWantedPosts();
      const result = await fetchUserWantedPosts();

      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(
        '*, profiles:public_profiles!wanted_posts_user_id_fkey(id, display_name, username, avatar_url)'
      );
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      // Does NOT constrain status / moderation_status (user sees all their posts)
      expect(mockSupabase._queryBuilder.eq).not.toHaveBeenCalledWith('status', 'active');
      expect(mockSupabase._queryBuilder.eq).not.toHaveBeenCalledWith('moderation_status', 'approved');
      expect(result).toEqual(posts);
      expect(wantedPosts.value).toEqual(posts);
    });

    it('uses an explicit userId when provided', async () => {
      resolveListWith({ data: [], error: null });
      const useWantedPosts = await load();
      await useWantedPosts().fetchUserWantedPosts('other-user-456');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'other-user-456');
    });

    it('returns an empty array and calls handleError when no user is available', async () => {
      stubAuth(null);
      const useWantedPosts = await load();
      const result = await useWantedPosts().fetchUserWantedPosts();
      expect(result).toEqual([]);
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User not authenticated' }),
        { toastTitle: 'Failed to load your wanted posts' }
      );
    });

    it('falls back to the authed user id when none passed even if anon-style call', async () => {
      // userId arg omitted -> resolves from getUser(); authed by default
      resolveListWith({ data: [], error: null });
      const useWantedPosts = await load();
      await useWantedPosts().fetchUserWantedPosts();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });

    it('returns an empty array and calls handleError on a database error', async () => {
      resolveListWith({ data: null, error: new Error('Database error') });
      const useWantedPosts = await load();
      const result = await useWantedPosts().fetchUserWantedPosts();
      expect(result).toEqual([]);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), {
        toastTitle: 'Failed to load your wanted posts',
      });
    });

    it('resets loading to false after completion', async () => {
      resolveListWith({ data: [], error: null });
      const useWantedPosts = await load();
      const { fetchUserWantedPosts, loading } = useWantedPosts();
      await fetchUserWantedPosts();
      expect(loading.value).toBe(false);
    });

    it('coerces null data to an empty array', async () => {
      resolveListWith({ data: null, error: null });
      const useWantedPosts = await load();
      const { fetchUserWantedPosts, wantedPosts } = useWantedPosts();
      await fetchUserWantedPosts();
      expect(wantedPosts.value).toEqual([]);
    });
  });

  // =========================================================================
  // createWantedPost
  // =========================================================================
  describe('createWantedPost', () => {
    const newPostData = {
      title: 'Looking for Mini Doors',
      description: 'Need a pair of doors for my 1965 Mini.',
      category: 'parts',
      partsSubcategory: 'body_panels',
      conditionPreference: 'good',
      budgetMin: 200,
      budgetMax: 800,
      currency: 'USD',
      city: 'Portland',
      stateProvince: 'OR',
      country: 'US',
    };

    it('POSTs to /api/exchange/wanted/create with a bearer token and returns the post', async () => {
      const createdPost = createMockWantedPost({
        title: newPostData.title,
        category: 'parts',
        parts_subcategory: 'body_panels',
      });
      mockFetch.mockResolvedValueOnce({ success: true, post: createdPost, flagged: false });

      const useWantedPosts = await load();
      const result = await useWantedPosts().createWantedPost(newPostData);

      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/wanted/create', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-access-token' },
        body: {
          title: newPostData.title,
          description: newPostData.description,
          category: newPostData.category,
          partsSubcategory: newPostData.partsSubcategory,
          conditionPreference: newPostData.conditionPreference,
          budgetMin: newPostData.budgetMin,
          budgetMax: newPostData.budgetMax,
          currency: newPostData.currency,
          city: newPostData.city,
          stateProvince: newPostData.stateProvince,
          country: newPostData.country,
        },
      });
      expect(result).toEqual(createdPost);
    });

    it('shows a success toast when the post is not flagged', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, post: createMockWantedPost(), flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().createWantedPost(newPostData);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Wanted Post Created',
        description: 'Your wanted post is now live!',
        color: 'success',
      });
    });

    it('shows a warning toast when the post is flagged for moderation', async () => {
      const flaggedPost = createMockWantedPost({ moderation_status: 'flagged', status: 'flagged' });
      mockFetch.mockResolvedValueOnce({ success: true, post: flaggedPost, flagged: true });
      const useWantedPosts = await load();
      await useWantedPosts().createWantedPost(newPostData);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Post Created',
        description: 'Your wanted post was created but flagged for review due to content moderation.',
        color: 'warning',
      });
    });

    it('captures wanted_post_created with budget and location flags', async () => {
      const createdPost = createMockWantedPost({
        id: 'wp-new',
        category: 'parts',
        budget_min: 200,
        budget_max: 800,
        city: 'Portland',
        country: 'US',
      });
      mockFetch.mockResolvedValueOnce({ success: true, post: createdPost, flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().createWantedPost(newPostData);
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_created', {
        wanted_post_id: 'wp-new',
        category: 'parts',
        has_budget: true,
        has_location: true,
      });
    });

    it('marks has_budget and has_location false when budget and location are absent', async () => {
      const createdPost = createMockWantedPost({
        budget_min: null,
        budget_max: null,
        city: null,
        country: null,
      });
      mockFetch.mockResolvedValueOnce({ success: true, post: createdPost, flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().createWantedPost({
        title: 'Test',
        description: 'Test desc',
        category: 'vehicle',
      });
      expect(mockCapture).toHaveBeenCalledWith(
        'wanted_post_created',
        expect.objectContaining({ has_budget: false, has_location: false })
      );
    });

    it('marks has_budget true when only budget_max is set', async () => {
      const createdPost = createMockWantedPost({ budget_min: null, budget_max: 500, city: null, country: null });
      mockFetch.mockResolvedValueOnce({ success: true, post: createdPost, flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().createWantedPost(newPostData);
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_created', expect.objectContaining({ has_budget: true }));
    });

    it('marks has_location true when only city is set', async () => {
      const createdPost = createMockWantedPost({ budget_min: null, budget_max: null, city: 'Leeds', country: null });
      mockFetch.mockResolvedValueOnce({ success: true, post: createdPost, flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().createWantedPost(newPostData);
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_created', expect.objectContaining({ has_location: true }));
    });

    it('returns null and warns when the user is not authenticated (no $fetch)', async () => {
      stubAuth(null);
      const useWantedPosts = await load();
      const result = await useWantedPosts().createWantedPost(newPostData);
      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to create a wanted post',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null and warns (no $fetch) when the session has no access token', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      const useWantedPosts = await load();
      const result = await useWantedPosts().createWantedPost(newPostData);
      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Session Expired',
        description: 'Please sign in again to create a wanted post',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null and calls handleError on an API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Server error'));
      const useWantedPosts = await load();
      const result = await useWantedPosts().createWantedPost(newPostData);
      expect(result).toBeNull();
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to create wanted post' });
    });
  });

  // =========================================================================
  // updateWantedPost
  // =========================================================================
  describe('updateWantedPost', () => {
    const updateData = {
      title: 'Updated: Looking for 1275cc Engine',
      description: 'Updated description with more details.',
    };

    it('PUTs to /api/exchange/wanted/:id with a bearer token and returns the post', async () => {
      const updatedPost = createMockWantedPost({ title: updateData.title });
      mockFetch.mockResolvedValueOnce({ success: true, post: updatedPost, flagged: false });

      const useWantedPosts = await load();
      const result = await useWantedPosts().updateWantedPost('wp-123', updateData);

      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/wanted/wp-123', {
        method: 'PUT',
        headers: { Authorization: 'Bearer mock-access-token' },
        body: {
          title: updateData.title,
          description: updateData.description,
          category: undefined,
          partsSubcategory: undefined,
          conditionPreference: undefined,
          budgetMin: undefined,
          budgetMax: undefined,
          currency: undefined,
          city: undefined,
          stateProvince: undefined,
          country: undefined,
        },
      });
      expect(result).toEqual(updatedPost);
    });

    it('shows a success toast when not flagged', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, post: createMockWantedPost(), flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().updateWantedPost('wp-123', updateData);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Wanted Post Updated',
        description: 'Your changes have been saved.',
        color: 'success',
      });
    });

    it('shows a warning toast when the update is flagged', async () => {
      const updatedPost = createMockWantedPost({ moderation_status: 'flagged' });
      mockFetch.mockResolvedValueOnce({ success: true, post: updatedPost, flagged: true });
      const useWantedPosts = await load();
      await useWantedPosts().updateWantedPost('wp-123', updateData);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Post Updated',
        description: 'Your wanted post was updated but flagged for review due to content moderation.',
        color: 'warning',
      });
    });

    it('replaces the matching entry in the local wantedPosts array', async () => {
      const original = createMockWantedPost({ id: 'wp-123', title: 'Original Title' });
      const updated = createMockWantedPost({ id: 'wp-123', title: 'Updated Title' });
      mockFetch.mockResolvedValueOnce({ success: true, post: updated, flagged: false });

      const useWantedPosts = await load();
      const { updateWantedPost, wantedPosts } = useWantedPosts();
      wantedPosts.value = [original as any];
      await updateWantedPost('wp-123', { title: 'Updated Title' });
      expect(wantedPosts.value[0]).toEqual(updated);
    });

    it('updates currentPost when it matches the updated post', async () => {
      const original = createMockWantedPost({ id: 'wp-123', title: 'Original Title' });
      const updated = createMockWantedPost({ id: 'wp-123', title: 'Updated Title' });
      mockFetch.mockResolvedValueOnce({ success: true, post: updated, flagged: false });

      const useWantedPosts = await load();
      const { updateWantedPost, currentPost } = useWantedPosts();
      currentPost.value = original as any;
      await updateWantedPost('wp-123', { title: 'Updated Title' });
      expect(currentPost.value).toEqual(updated);
    });

    it('leaves currentPost untouched when it does not match', async () => {
      const different = createMockWantedPost({ id: 'wp-999', title: 'Different Post' });
      const updated = createMockWantedPost({ id: 'wp-123', title: 'Updated Title' });
      mockFetch.mockResolvedValueOnce({ success: true, post: updated, flagged: false });

      const useWantedPosts = await load();
      const { updateWantedPost, currentPost } = useWantedPosts();
      currentPost.value = different as any;
      await updateWantedPost('wp-123', { title: 'Updated Title' });
      expect(currentPost.value).toEqual(different);
    });

    it('captures wanted_post_edited on success', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, post: createMockWantedPost(), flagged: false });
      const useWantedPosts = await load();
      await useWantedPosts().updateWantedPost('wp-123', updateData);
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_edited', { wanted_post_id: 'wp-123' });
    });

    it('returns null and warns when the user is not authenticated', async () => {
      stubAuth(null);
      const useWantedPosts = await load();
      const result = await useWantedPosts().updateWantedPost('wp-123', updateData);
      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to update your wanted post',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null and warns when the session has no access token', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      const useWantedPosts = await load();
      const result = await useWantedPosts().updateWantedPost('wp-123', updateData);
      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Session Expired',
        description: 'Please sign in again to update your wanted post',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null and calls handleError on an API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Update failed'));
      const useWantedPosts = await load();
      const result = await useWantedPosts().updateWantedPost('wp-123', updateData);
      expect(result).toBeNull();
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to update wanted post' });
    });
  });

  // =========================================================================
  // deleteWantedPost
  // =========================================================================
  describe('deleteWantedPost', () => {
    it('DELETEs /api/exchange/wanted/:id with a bearer token and returns true', async () => {
      mockFetch.mockResolvedValueOnce({ success: true });
      const useWantedPosts = await load();
      const result = await useWantedPosts().deleteWantedPost('wp-123');
      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/wanted/wp-123', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-access-token' },
      });
      expect(result).toBe(true);
    });

    it('removes the deleted post from the local array', async () => {
      mockFetch.mockResolvedValueOnce({ success: true });
      const useWantedPosts = await load();
      const { deleteWantedPost, wantedPosts } = useWantedPosts();
      wantedPosts.value = [
        createMockWantedPost({ id: 'wp-123' }) as any,
        createMockWantedPost({ id: 'wp-456' }) as any,
      ];
      await deleteWantedPost('wp-123');
      expect(wantedPosts.value.length).toBe(1);
      expect(wantedPosts.value[0].id).toBe('wp-456');
    });

    it('clears currentPost when it matches the deleted post', async () => {
      mockFetch.mockResolvedValueOnce({ success: true });
      const useWantedPosts = await load();
      const { deleteWantedPost, currentPost } = useWantedPosts();
      currentPost.value = createMockWantedPost({ id: 'wp-123' }) as any;
      await deleteWantedPost('wp-123');
      expect(currentPost.value).toBeNull();
    });

    it('leaves currentPost untouched when it does not match', async () => {
      mockFetch.mockResolvedValueOnce({ success: true });
      const useWantedPosts = await load();
      const { deleteWantedPost, currentPost } = useWantedPosts();
      const other = createMockWantedPost({ id: 'wp-999' });
      currentPost.value = other as any;
      await deleteWantedPost('wp-123');
      expect(currentPost.value).toEqual(other);
    });

    it('shows an info toast on success', async () => {
      mockFetch.mockResolvedValueOnce({ success: true });
      const useWantedPosts = await load();
      await useWantedPosts().deleteWantedPost('wp-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Wanted Post Deleted',
        description: 'Your wanted post has been removed.',
        color: 'info',
      });
    });

    it('captures wanted_post_deleted on success', async () => {
      mockFetch.mockResolvedValueOnce({ success: true });
      const useWantedPosts = await load();
      await useWantedPosts().deleteWantedPost('wp-123');
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_deleted', { wanted_post_id: 'wp-123' });
    });

    it('returns false and warns when the user is not authenticated', async () => {
      stubAuth(null);
      const useWantedPosts = await load();
      const result = await useWantedPosts().deleteWantedPost('wp-123');
      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to delete your wanted post',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns false and warns when the session has no access token', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      const useWantedPosts = await load();
      const result = await useWantedPosts().deleteWantedPost('wp-123');
      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Session Expired',
        description: 'Please sign in again to delete your wanted post',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns false and calls handleError on an API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Delete failed'));
      const useWantedPosts = await load();
      const result = await useWantedPosts().deleteWantedPost('wp-123');
      expect(result).toBe(false);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to delete wanted post' });
    });
  });

  // =========================================================================
  // markFulfilled
  // =========================================================================
  describe('markFulfilled', () => {
    it('updates status to fulfilled via Supabase scoped to id + user_id and returns true', async () => {
      const fulfilled = createMockWantedPost({ status: 'fulfilled' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: fulfilled, error: null });

      const useWantedPosts = await load();
      const result = await useWantedPosts().markFulfilled('wp-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ status: 'fulfilled' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wp-123');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(result).toBe(true);
    });

    it('replaces the matching entry in the local array', async () => {
      const fulfilled = createMockWantedPost({ id: 'wp-123', status: 'fulfilled' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: fulfilled, error: null });

      const useWantedPosts = await load();
      const { markFulfilled, wantedPosts } = useWantedPosts();
      wantedPosts.value = [createMockWantedPost({ id: 'wp-123' }) as any];
      await markFulfilled('wp-123');
      expect(wantedPosts.value[0]).toEqual(fulfilled);
    });

    it('updates currentPost when it matches', async () => {
      const fulfilled = createMockWantedPost({ id: 'wp-123', status: 'fulfilled' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: fulfilled, error: null });

      const useWantedPosts = await load();
      const { markFulfilled, currentPost } = useWantedPosts();
      currentPost.value = createMockWantedPost({ id: 'wp-123' }) as any;
      await markFulfilled('wp-123');
      expect(currentPost.value).toEqual(fulfilled);
    });

    it('shows a success toast', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockWantedPost({ status: 'fulfilled' }), error: null });
      const useWantedPosts = await load();
      await useWantedPosts().markFulfilled('wp-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Marked as Fulfilled',
        description: 'Glad you found what you were looking for!',
        color: 'success',
      });
    });

    it('captures wanted_post_fulfilled on success', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockWantedPost({ status: 'fulfilled' }), error: null });
      const useWantedPosts = await load();
      await useWantedPosts().markFulfilled('wp-123');
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_fulfilled', { wanted_post_id: 'wp-123' });
    });

    it('returns false and warns when the user is not authenticated', async () => {
      stubAuth(null);
      const useWantedPosts = await load();
      const result = await useWantedPosts().markFulfilled('wp-123');
      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to update your wanted post',
        color: 'warning',
      });
    });

    it('returns false and calls handleError on a database error', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Update failed') });
      const useWantedPosts = await load();
      const result = await useWantedPosts().markFulfilled('wp-123');
      expect(result).toBe(false);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to mark as fulfilled' });
    });
  });

  // =========================================================================
  // renewWantedPost
  // =========================================================================
  describe('renewWantedPost', () => {
    it('sets status active and expires_at ~90 days out, scoped to id + user_id', async () => {
      const renewed = createMockWantedPost({ status: 'active' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: renewed, error: null });

      const now = new Date('2026-02-17T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const useWantedPosts = await load();
      const result = await useWantedPosts().renewWantedPost('wp-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      const expiresAt = new Date(updateArg.expires_at);
      const expected = new Date(now);
      expected.setDate(expected.getDate() + 90);
      expect(Math.abs(expiresAt.getTime() - expected.getTime())).toBeLessThan(1000);

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wp-123');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it('replaces the matching entry in the local array', async () => {
      const renewed = createMockWantedPost({ id: 'wp-123', status: 'active' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: renewed, error: null });

      const useWantedPosts = await load();
      const { renewWantedPost, wantedPosts } = useWantedPosts();
      wantedPosts.value = [createMockWantedPost({ id: 'wp-123', status: 'expired' }) as any];
      await renewWantedPost('wp-123');
      expect(wantedPosts.value[0]).toEqual(renewed);
    });

    it('updates currentPost when it matches', async () => {
      const renewed = createMockWantedPost({ id: 'wp-123', status: 'active' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: renewed, error: null });

      const useWantedPosts = await load();
      const { renewWantedPost, currentPost } = useWantedPosts();
      currentPost.value = createMockWantedPost({ id: 'wp-123', status: 'expired' }) as any;
      await renewWantedPost('wp-123');
      expect(currentPost.value).toEqual(renewed);
    });

    it('shows a success toast', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockWantedPost({ status: 'active' }), error: null });
      const useWantedPosts = await load();
      await useWantedPosts().renewWantedPost('wp-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Wanted Post Renewed',
        description: 'Your wanted post has been renewed for another 90 days.',
        color: 'success',
      });
    });

    it('captures wanted_post_renewed on success', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockWantedPost({ status: 'active' }), error: null });
      const useWantedPosts = await load();
      await useWantedPosts().renewWantedPost('wp-123');
      expect(mockCapture).toHaveBeenCalledWith('wanted_post_renewed', { wanted_post_id: 'wp-123' });
    });

    it('returns false and warns when the user is not authenticated', async () => {
      stubAuth(null);
      const useWantedPosts = await load();
      const result = await useWantedPosts().renewWantedPost('wp-123');
      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to renew your wanted post',
        color: 'warning',
      });
    });

    it('returns false and calls handleError on a database error', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Update failed') });
      const useWantedPosts = await load();
      const result = await useWantedPosts().renewWantedPost('wp-123');
      expect(result).toBe(false);
      expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { toastTitle: 'Failed to renew wanted post' });
    });
  });
});
