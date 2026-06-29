import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { ExternalListing } from '~/app/composables/useExternalListings';

// ---------------------------------------------------------------------------
// Shared mocks. The CMDIY useExternalListings composable depends on:
//   useSupabase, useToast, usePostHog, useAuth (lazy via getUser()),
//   useState ($global) and $fetch ($global).
// vitest.setup globally stubs usePostHog/useState/$fetch, but useToast is NOT
// stubbed there and we want controllable handles for toast + capture, so we
// stub those explicitly here. useAuth is stubbed per-test (anon vs. signed-in).
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;
let mockFetch: ReturnType<typeof vi.fn>;

const createMockExternalListing = (overrides: Partial<ExternalListing> = {}): ExternalListing => ({
  id: 'find-123',
  source_url: 'https://bringatrailer.com/listing/1973-mini-cooper-s',
  source_site: 'bat',
  title: '1973 Mini Cooper S',
  slug: '1973-mini-cooper-s-abc123',
  description: 'Beautiful classic Mini',
  og_image_url: 'https://example.com/image.jpg',
  og_description: 'A BaT listing',
  year: 1973,
  model: 'Mini Cooper S',
  price: 25000,
  price_label: 'Sold for $25,000',
  auction_end_time: null,
  category: 'vehicle',
  tags: ['cooper', 'restored'],
  status: 'approved',
  submitted_by: 'test-user-id',
  admin_notes: null,
  editor_commentary: null,
  is_editors_pick: false,
  like_count: 5,
  comment_count: 2,
  metadata_fetched_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  profiles: { display_name: 'Test User', username: 'testuser', avatar_url: null },
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();
  mockFetch = vi.fn().mockResolvedValue({});

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  vi.stubGlobal('$fetch', mockFetch);

  // Deterministic slug suffix (composable prefers crypto.randomUUID).
  vi.stubGlobal('crypto', { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });

  // Fresh shared useState store per test.
  if ((global as any).__resetNuxtState) {
    (global as any).__resetNuxtState();
  }

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
});

const loadComposable = async () => {
  const { useExternalListings } = await import('~/app/composables/useExternalListings');
  return useExternalListings;
};

describe('useExternalListings', () => {
  // -------------------------------------------------------------------------
  // surface / initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('exposes all expected members with sane defaults', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const useExternalListings = await loadComposable();
      const api = useExternalListings();

      expect(api.finds.value).toEqual([]);
      expect(api.currentFind.value).toBeNull();
      expect(api.loading.value).toBe(false);
      expect(api.submitting.value).toBe(false);
      expect(api.totalCount.value).toBe(0);
      expect(api.likedIds.value).toEqual([]);
      expect(api.watchlistedIds.value).toEqual([]);

      expect(typeof api.fetchFinds).toBe('function');
      expect(typeof api.fetchFind).toBe('function');
      expect(typeof api.submitFind).toBe('function');
      expect(typeof api.toggleLike).toBe('function');
      expect(typeof api.isLiked).toBe('function');
      expect(typeof api.toggleWatchlist).toBe('function');
      expect(typeof api.isWatchlisted).toBe('function');
      expect(typeof api.loadUserInteractions).toBe('function');
      expect(typeof api.deleteFind).toBe('function');
    });

    it('shares state across instances via useState', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const useExternalListings = await loadComposable();
      const a = useExternalListings();
      const b = useExternalListings();

      a.likedIds.value = ['find-x'];
      expect(b.likedIds.value).toEqual(['find-x']);
      expect(b.isLiked('find-x')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // fetchFinds
  // -------------------------------------------------------------------------
  describe('fetchFinds', () => {
    it('queries approved listings ordered by published_at by default', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const finds = [createMockExternalListing(), createMockExternalListing({ id: 'find-456' })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: finds, error: null, count: 2 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds, finds: findsState, totalCount } = useExternalListings();

      await fetchFinds();

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(expect.stringContaining('public_profiles'), {
        count: 'exact',
      });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('published_at', { ascending: false });
      expect(findsState.value).toEqual(finds);
      expect(totalCount.value).toBe(2);
    });

    it('orders by like_count desc for most_liked sort', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds({ sort: 'most_liked' });

      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('like_count', { ascending: false });
    });

    it('orders by auction_end_time asc (nulls last) for ending_soon sort', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds({ sort: 'ending_soon' });

      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('auction_end_time', {
        ascending: true,
        nullsFirst: false,
      });
    });

    it('applies the sourceSite filter', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds({ sourceSite: 'bat' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('source_site', 'bat');
    });

    it('applies the category filter', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds({ category: 'engine' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('category', 'engine');
    });

    it('applies the tags filter with contains', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.contains = vi.fn().mockReturnThis();
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds({ tags: ['cooper', 'restored'] });

      expect(mockSupabase._queryBuilder.contains).toHaveBeenCalledWith('tags', ['cooper', 'restored']);
    });

    it('does not apply contains for an empty tags array', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const containsSpy = vi.fn().mockReturnThis();
      mockSupabase._queryBuilder.contains = containsSpy;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds({ tags: [] });

      expect(containsSpy).not.toHaveBeenCalled();
    });

    it('paginates with the correct range for an explicit page/limit', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const rangeSpy = vi.fn().mockReturnThis();
      mockSupabase._queryBuilder.range = rangeSpy;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      // page 2, limit 10 -> start = (2-1)*10 = 10, end = 10+10-1 = 19
      await fetchFinds({ page: 2, limit: 10 });

      expect(rangeSpy).toHaveBeenCalledWith(10, 19);
    });

    it('defaults to range(0, 19) when no pagination is given', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const rangeSpy = vi.fn().mockReturnThis();
      mockSupabase._queryBuilder.range = rangeSpy;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await fetchFinds();

      expect(rangeSpy).toHaveBeenCalledWith(0, 19);
    });

    it('coerces null data and null count to empty/zero', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null, count: null }));

      const useExternalListings = await loadComposable();
      const { fetchFinds, finds, totalCount } = useExternalListings();

      finds.value = [createMockExternalListing()];
      totalCount.value = 99;

      await fetchFinds();

      expect(finds.value).toEqual([]);
      expect(totalCount.value).toBe(0);
    });

    it('shows an error toast and logs on query failure (without throwing)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const dbError = new Error('Database error');
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: dbError, count: null }));

      const useExternalListings = await loadComposable();
      const { fetchFinds } = useExternalListings();

      await expect(fetchFinds()).resolves.toBeUndefined();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load finds',
        color: 'error',
      });
      expect(console.error).toHaveBeenCalled();
    });

    it('resets loading to false after success', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListings = await loadComposable();
      const { fetchFinds, loading } = useExternalListings();

      expect(loading.value).toBe(false);
      await fetchFinds();
      expect(loading.value).toBe(false);
    });

    it('resets loading to false after error', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: new Error('boom'), count: null })
      );

      const useExternalListings = await loadComposable();
      const { fetchFinds, loading } = useExternalListings();

      await fetchFinds();
      expect(loading.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // fetchFind (single by slug)
  // -------------------------------------------------------------------------
  describe('fetchFind', () => {
    it('queries by slug with single() and sets currentFind', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const find = createMockExternalListing({ id: 'find-789', slug: 'some-slug-xyz' });
      mockSupabase._mockSingle.mockResolvedValue({ data: find, error: null });

      const useExternalListings = await loadComposable();
      const { fetchFind, currentFind } = useExternalListings();

      const result = await fetchFind('some-slug-xyz');

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('slug', 'some-slug-xyz');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(find);
      expect(currentFind.value).toEqual(find);
    });

    it('returns null, shows error toast, and leaves currentFind on failure', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const useExternalListings = await loadComposable();
      const { fetchFind, currentFind } = useExternalListings();

      const result = await fetchFind('missing-slug');

      expect(result).toBeNull();
      expect(currentFind.value).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load find',
        color: 'error',
      });
    });

    it('resets loading to false after completion', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({ data: createMockExternalListing(), error: null });

      const useExternalListings = await loadComposable();
      const { fetchFind, loading } = useExternalListings();

      await fetchFind('s');
      expect(loading.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // submitFind
  // -------------------------------------------------------------------------
  describe('submitFind', () => {
    it('returns null and warns when anonymous (no insert)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      const result = await submitFind({ url: 'https://example.com', title: 'Test' });

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to submit a find',
        color: 'warning',
      });
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    });

    it('detects source site, generates a slug, and inserts a pending row', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const inserted = createMockExternalListing({ status: 'pending' });
      mockSupabase._mockSingle.mockResolvedValue({ data: inserted, error: null });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      const result = await submitFind({
        url: 'https://bringatrailer.com/listing/1973-mini-cooper-s',
        title: '1973 Mini Cooper S',
        description: 'Great car',
        category: 'vehicle',
        tags: ['cooper'],
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_url: 'https://bringatrailer.com/listing/1973-mini-cooper-s',
          source_site: 'bat',
          title: '1973 Mini Cooper S',
          status: 'pending',
          submitted_by: 'test-user-id',
          description: 'Great car',
          category: 'vehicle',
          tags: ['cooper'],
        })
      );
      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.slug).toMatch(/^1973-mini-cooper-s-/);
      expect(result).toEqual(inserted);
    });

    it('maps an unrecognized host to source_site "other"', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({ data: createMockExternalListing(), error: null });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      await submitFind({ url: 'https://some-random-site.example/x', title: 'Mystery part' });

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ source_site: 'other' })
      );
    });

    it('stamps metadata_fetched_at when og data is provided', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({ data: createMockExternalListing(), error: null });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      await submitFind({
        url: 'https://bringatrailer.com/x',
        title: 'With OG',
        og_image_url: 'https://img.example/og.jpg',
      });

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.metadata_fetched_at).toEqual(expect.any(String));
    });

    it('leaves metadata_fetched_at null when no og data is provided', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({ data: createMockExternalListing(), error: null });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      await submitFind({ url: 'https://bringatrailer.com/x', title: 'No OG' });

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.metadata_fetched_at).toBeNull();
    });

    it('shows a success toast on submission', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({
        data: createMockExternalListing({ status: 'pending' }),
        error: null,
      });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      await submitFind({ url: 'https://bringatrailer.com/listing/test', title: 'Test Mini' });

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Find Submitted',
        description: 'Your find has been submitted for review. An admin will review it shortly.',
        color: 'success',
      });
    });

    it('captures the find_submitted analytics event', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({
        data: createMockExternalListing({ status: 'pending' }),
        error: null,
      });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      await submitFind({
        url: 'https://bringatrailer.com/listing/test',
        title: 'Test Mini',
        category: 'vehicle',
      });

      expect(mockCapture).toHaveBeenCalledWith('find_submitted', {
        source_site: 'bat',
        category: 'vehicle',
        url: 'https://bringatrailer.com/listing/test',
      });
    });

    it('fires the admin notify proxy with the session bearer token', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const inserted = createMockExternalListing({ id: 'find-notify', status: 'pending' });
      mockSupabase._mockSingle.mockResolvedValue({ data: inserted, error: null });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      await submitFind({ url: 'https://bringatrailer.com/listing/test', title: 'Notify Mini' });

      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/external-listings/notify-submit', {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-access-token' },
        body: { findId: 'find-notify' },
      });
    });

    it('still succeeds when the notify proxy throws (fire-and-forget)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const inserted = createMockExternalListing({ status: 'pending' });
      mockSupabase._mockSingle.mockResolvedValue({ data: inserted, error: null });
      mockFetch.mockReturnValueOnce({ catch: (cb: any) => cb(new Error('notify down')) });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      const result = await submitFind({ url: 'https://bringatrailer.com/x', title: 'Resilient' });

      expect(result).toEqual(inserted);
    });

    it('retries with source_site "other" on a 23514 CHECK-constraint violation', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const inserted = createMockExternalListing({ source_site: 'other', status: 'pending' });
      mockSupabase._mockSingle
        .mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'check_violation' } })
        .mockResolvedValueOnce({ data: inserted, error: null });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      // copart is detected from host but may not be in the DB enum -> retry.
      const result = await submitFind({ url: 'https://www.copart.com/lot/123', title: 'Copart Mini' });

      expect(mockSupabase._mockInsert).toHaveBeenCalledTimes(2);
      expect(mockSupabase._mockInsert.mock.calls[0][0].source_site).toBe('copart');
      expect(mockSupabase._mockInsert.mock.calls[1][0].source_site).toBe('other');
      expect(result).toEqual(inserted);
    });

    it('handles a duplicate URL (23505) with a warning toast and null result', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      const result = await submitFind({
        url: 'https://bringatrailer.com/listing/duplicate',
        title: 'Duplicate',
      });

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Duplicate URL',
        description: 'This URL has already been submitted.',
        color: 'warning',
      });
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('handles a generic insert error with a generic error toast and null result', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({
        data: null,
        error: { code: '500', message: 'server error' },
      });

      const useExternalListings = await loadComposable();
      const { submitFind } = useExternalListings();

      const result = await submitFind({ url: 'https://bringatrailer.com/x', title: 'Boom' });

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to submit find',
        color: 'error',
      });
    });

    it('resets submitting to false after completion', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._mockSingle.mockResolvedValue({ data: createMockExternalListing(), error: null });

      const useExternalListings = await loadComposable();
      const { submitFind, submitting } = useExternalListings();

      expect(submitting.value).toBe(false);
      await submitFind({ url: 'https://bringatrailer.com/listing/test', title: 'Test' });
      expect(submitting.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // toggleLike
  // -------------------------------------------------------------------------
  describe('toggleLike', () => {
    it('warns and does nothing when anonymous', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useExternalListings = await loadComposable();
      const { toggleLike } = useExternalListings();

      await toggleLike('find-123');

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to like finds',
        color: 'warning',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('optimistically likes, inserts the like row, and bumps like_count', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListings = await loadComposable();
      const { toggleLike, likedIds, finds } = useExternalListings();

      finds.value = [createMockExternalListing({ id: 'find-123', like_count: 5 })];

      await toggleLike('find-123');

      expect(likedIds.value).toContain('find-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('external_listing_likes');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        external_listing_id: 'find-123',
        user_id: 'test-user-id',
      });
      expect(finds.value[0].like_count).toBe(6);
      expect(mockCapture).toHaveBeenCalledWith('find_liked', { id: 'find-123', source_site: 'bat' });
    });

    it('also bumps like_count on currentFind when it matches', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListings = await loadComposable();
      const { toggleLike, currentFind } = useExternalListings();

      currentFind.value = createMockExternalListing({ id: 'find-cur', like_count: 1 });

      await toggleLike('find-cur');

      expect(currentFind.value?.like_count).toBe(2);
    });

    it('optimistically unlikes when already liked and deletes the like row', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      // delete().eq('external_listing_id').eq('user_id') -> terminal second eq
      const secondEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._queryBuilder.delete = vi.fn().mockReturnValue({ eq: firstEq });

      const useExternalListings = await loadComposable();
      const { toggleLike, likedIds, finds } = useExternalListings();

      finds.value = [createMockExternalListing({ id: 'find-123', like_count: 5 })];
      likedIds.value = ['find-123'];

      await toggleLike('find-123');

      expect(likedIds.value).not.toContain('find-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('external_listing_likes');
      expect(mockSupabase._queryBuilder.delete).toHaveBeenCalled();
      expect(firstEq).toHaveBeenCalledWith('external_listing_id', 'find-123');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(finds.value[0].like_count).toBe(4);
      expect(mockCapture).toHaveBeenCalledWith('find_unliked', { id: 'find-123', source_site: 'bat' });
    });

    it('rolls back the optimistic like on an insert error', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { code: '500', message: 'server error' } })
      );

      const useExternalListings = await loadComposable();
      const { toggleLike, likedIds, finds } = useExternalListings();

      finds.value = [createMockExternalListing({ id: 'find-123', like_count: 5 })];

      await toggleLike('find-123');

      expect(likedIds.value).not.toContain('find-123');
      expect(finds.value[0].like_count).toBe(5);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to like find',
        color: 'error',
      });
    });

    it('swallows a duplicate like (23505) without rolling back or erroring', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
      );

      const useExternalListings = await loadComposable();
      const { toggleLike, likedIds, finds } = useExternalListings();

      finds.value = [createMockExternalListing({ id: 'find-123', like_count: 5 })];

      await toggleLike('find-123');

      // optimistic state is kept (no rollback) and no error toast fires
      expect(likedIds.value).toContain('find-123');
      expect(mockToast.add).not.toHaveBeenCalled();
    });

    it('rolls back the optimistic unlike on a delete error', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const secondEq = vi.fn().mockResolvedValue({ data: null, error: new Error('delete failed') });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._queryBuilder.delete = vi.fn().mockReturnValue({ eq: firstEq });

      const useExternalListings = await loadComposable();
      const { toggleLike, likedIds, finds } = useExternalListings();

      finds.value = [createMockExternalListing({ id: 'find-123', like_count: 5 })];
      likedIds.value = ['find-123'];

      await toggleLike('find-123');

      expect(likedIds.value).toContain('find-123');
      expect(finds.value[0].like_count).toBe(5);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to unlike find',
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // isLiked
  // -------------------------------------------------------------------------
  describe('isLiked', () => {
    it('returns true when the id is in likedIds', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const useExternalListings = await loadComposable();
      const { isLiked, likedIds } = useExternalListings();

      likedIds.value = ['find-123', 'find-456'];

      expect(isLiked('find-123')).toBe(true);
      expect(isLiked('find-456')).toBe(true);
    });

    it('returns false when the id is absent', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const useExternalListings = await loadComposable();
      const { isLiked, likedIds } = useExternalListings();

      likedIds.value = ['find-123'];

      expect(isLiked('find-999')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // toggleWatchlist
  // -------------------------------------------------------------------------
  describe('toggleWatchlist', () => {
    it('warns and does nothing when anonymous', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useExternalListings = await loadComposable();
      const { toggleWatchlist } = useExternalListings();

      await toggleWatchlist('find-123');

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to save finds',
        color: 'warning',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('inserts a watchlist row and shows a success toast when not yet watchlisted', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListings = await loadComposable();
      const { toggleWatchlist, watchlistedIds } = useExternalListings();

      await toggleWatchlist('find-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listing_watchlist');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        external_listing_id: 'find-123',
      });
      expect(watchlistedIds.value).toContain('find-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Saved',
        description: 'Find added to your watchlist',
        color: 'success',
      });
    });

    it('treats a duplicate (23505) insert as "already saved" without adding twice', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
      );

      const useExternalListings = await loadComposable();
      const { toggleWatchlist, watchlistedIds } = useExternalListings();

      await toggleWatchlist('find-123');

      expect(watchlistedIds.value).not.toContain('find-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Already Saved',
        description: 'This find is already in your watchlist',
        color: 'info',
      });
    });

    it('shows an error toast and does not add on a generic insert error', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { code: '500', message: 'server error' } })
      );

      const useExternalListings = await loadComposable();
      const { toggleWatchlist, watchlistedIds } = useExternalListings();

      await toggleWatchlist('find-123');

      expect(watchlistedIds.value).not.toContain('find-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to add to watchlist',
        color: 'error',
      });
    });

    it('deletes the watchlist row and shows an info toast when already watchlisted', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const secondEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._queryBuilder.delete = vi.fn().mockReturnValue({ eq: firstEq });

      const useExternalListings = await loadComposable();
      const { toggleWatchlist, watchlistedIds } = useExternalListings();

      watchlistedIds.value = ['find-123'];

      await toggleWatchlist('find-123');

      expect(mockSupabase._queryBuilder.delete).toHaveBeenCalled();
      expect(firstEq).toHaveBeenCalledWith('external_listing_id', 'find-123');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(watchlistedIds.value).not.toContain('find-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Removed',
        description: 'Find removed from your watchlist',
        color: 'info',
      });
    });

    it('shows an error toast and keeps state on a delete error', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      const secondEq = vi.fn().mockResolvedValue({ data: null, error: new Error('delete failed') });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._queryBuilder.delete = vi.fn().mockReturnValue({ eq: firstEq });

      const useExternalListings = await loadComposable();
      const { toggleWatchlist, watchlistedIds } = useExternalListings();

      watchlistedIds.value = ['find-123'];

      await toggleWatchlist('find-123');

      expect(watchlistedIds.value).toContain('find-123');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to remove from watchlist',
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // isWatchlisted
  // -------------------------------------------------------------------------
  describe('isWatchlisted', () => {
    it('returns true when the id is in watchlistedIds', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const useExternalListings = await loadComposable();
      const { isWatchlisted, watchlistedIds } = useExternalListings();

      watchlistedIds.value = ['find-1'];

      expect(isWatchlisted('find-1')).toBe(true);
    });

    it('returns false when the id is absent', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const useExternalListings = await loadComposable();
      const { isWatchlisted } = useExternalListings();

      expect(isWatchlisted('find-1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // loadUserInteractions
  // -------------------------------------------------------------------------
  describe('loadUserInteractions', () => {
    it('clears both id sets when anonymous (no Supabase call)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useExternalListings = await loadComposable();
      const { loadUserInteractions, likedIds, watchlistedIds } = useExternalListings();

      likedIds.value = ['find-1'];
      watchlistedIds.value = ['find-1'];

      await loadUserInteractions();

      expect(likedIds.value).toEqual([]);
      expect(watchlistedIds.value).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('populates likedIds and watchlistedIds from the two queries', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      // Both parallel queries resolve through the shared then handler.
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [{ external_listing_id: 'find-1' }, { external_listing_id: 'find-2' }], error: null })
      );

      const useExternalListings = await loadComposable();
      const { loadUserInteractions, likedIds, watchlistedIds } = useExternalListings();

      await loadUserInteractions();

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listing_likes');
      expect(mockSupabase.from).toHaveBeenCalledWith('external_listing_watchlist');
      expect(likedIds.value).toEqual(['find-1', 'find-2']);
      expect(watchlistedIds.value).toEqual(['find-1', 'find-2']);
    });

    it('logs and leaves state unchanged when a query errors', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: new Error('Query failed') })
      );

      const useExternalListings = await loadComposable();
      const { loadUserInteractions, likedIds } = useExternalListings();

      likedIds.value = ['kept'];

      await loadUserInteractions();

      expect(likedIds.value).toEqual(['kept']);
      expect(console.error).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // deleteFind
  // -------------------------------------------------------------------------
  describe('deleteFind', () => {
    it('returns false and warns when anonymous (no fetch)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useExternalListings = await loadComposable();
      const { deleteFind } = useExternalListings();

      const result = await deleteFind('find-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to delete finds',
        color: 'warning',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('DELETEs via the proxy with the bearer token, prunes local state, returns true', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockFetch.mockResolvedValueOnce({ success: true });

      const useExternalListings = await loadComposable();
      const { deleteFind, finds } = useExternalListings();

      finds.value = [
        createMockExternalListing({ id: 'find-123' }),
        createMockExternalListing({ id: 'find-456' }),
      ];

      const result = await deleteFind('find-123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/external-listings/find-123', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-access-token' },
      });
      expect(finds.value.map((f) => f.id)).toEqual(['find-456']);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Deleted',
        description: 'Your find has been deleted',
        color: 'info',
      });
    });

    it('returns false and shows an error toast on a failed delete', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));
      mockFetch.mockRejectedValueOnce(new Error('Delete failed'));

      const useExternalListings = await loadComposable();
      const { deleteFind, finds } = useExternalListings();

      finds.value = [createMockExternalListing({ id: 'find-123' })];

      const result = await deleteFind('find-123');

      expect(result).toBe(false);
      expect(finds.value.map((f) => f.id)).toEqual(['find-123']);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to delete find',
        color: 'error',
      });
    });
  });
});
