import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { WatchlistItem } from '~/app/composables/useWatchlist';

// ---------------------------------------------------------------------------
// Shared mocks. The CMDIY useWatchlist composable depends on:
//   useSupabase, useAuth, useToast, usePostHog, useRoute, useState (computed).
// vitest.setup globally stubs usePostHog/useRoute/useState, but useToast is NOT
// stubbed there, and we need controllable handles for toast + capture, so we
// stub all of the user-driven ones explicitly here.
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;

const ROUTE_PATH = '/exchange/listing/abc';

const createMockWatchlistItem = (overrides: Partial<WatchlistItem> = {}): WatchlistItem => ({
  user_id: 'test-user-id',
  listing_id: 'listing-default',
  created_at: '2026-01-01T00:00:00.000Z',
  listing: {
    id: 'listing-default',
    title: 'Mk1 Cooper S',
    slug: 'mk1-cooper-s',
    price: 25000,
    year: 1965,
    model: 'Cooper S',
    location: 'Surrey',
    tier: 'standard',
    status: 'active',
    photos: [{ storage_path: 'photos/a.jpg', is_primary: true }],
  },
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  vi.stubGlobal('useRoute', () => ({ fullPath: ROUTE_PATH, path: ROUTE_PATH, params: {}, query: {} }));

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

const loadUseWatchlist = async () => {
  const { useWatchlist } = await import('~/app/composables/useWatchlist');
  return useWatchlist;
};

describe('useWatchlist', () => {
  // -------------------------------------------------------------------------
  // surface / initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('initializes with an empty watchlist', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { watchlistItems } = useWatchlist();

      expect(watchlistItems.value).toEqual([]);
    });

    it('exposes watchlistedListingIds as a computed Set', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { watchlistedListingIds } = useWatchlist();

      expect(watchlistedListingIds.value).toBeInstanceOf(Set);
      expect(watchlistedListingIds.value.size).toBe(0);
    });

    it('exposes all expected members', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const api = useWatchlist();

      expect(typeof api.isWatchlisted).toBe('function');
      expect(typeof api.fetchWatchlist).toBe('function');
      expect(typeof api.addToWatchlist).toBe('function');
      expect(typeof api.removeFromWatchlist).toBe('function');
      expect(typeof api.toggleWatchlist).toBe('function');
      expect(typeof api.getWatchlistCount).toBe('function');
      expect(api.watchlistItems).toBeDefined();
      expect(api.watchlistedListingIds).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // isWatchlisted
  // -------------------------------------------------------------------------
  describe('isWatchlisted', () => {
    it('returns false for a listing not in the watchlist', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { isWatchlisted } = useWatchlist();

      expect(isWatchlisted('listing-123')).toBe(false);
    });

    it('returns true for a listing present in the watchlist', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { watchlistItems, isWatchlisted } = useWatchlist();

      watchlistItems.value = [createMockWatchlistItem({ listing_id: 'listing-123' })];

      expect(isWatchlisted('listing-123')).toBe(true);
    });

    it('reacts to changes in the watchlist via the computed Set', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { watchlistItems, isWatchlisted, watchlistedListingIds } = useWatchlist();

      expect(isWatchlisted('listing-456')).toBe(false);

      watchlistItems.value = [createMockWatchlistItem({ listing_id: 'listing-456' })];

      expect(isWatchlisted('listing-456')).toBe(true);
      expect(watchlistedListingIds.value.has('listing-456')).toBe(true);
      expect(watchlistedListingIds.value.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // fetchWatchlist
  // -------------------------------------------------------------------------
  describe('fetchWatchlist', () => {
    it('clears the watchlist and skips Supabase when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { fetchWatchlist, watchlistItems } = useWatchlist();

      watchlistItems.value = [createMockWatchlistItem()];

      await fetchWatchlist();

      expect(watchlistItems.value).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('fetches and stores watchlist items when authenticated', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const items = [
        createMockWatchlistItem({ listing_id: 'listing-1' }),
        createMockWatchlistItem({ listing_id: 'listing-2' }),
      ];
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: items, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { fetchWatchlist, watchlistItems } = useWatchlist();

      await fetchWatchlist();

      expect(mockSupabase.from).toHaveBeenCalledWith('watchlist');
      expect(watchlistItems.value).toEqual(items);
    });

    it('selects the joined listing graph, filters by user id, orders by created_at desc', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });

      const useWatchlist = await loadUseWatchlist();
      const { fetchWatchlist } = useWatchlist();

      await fetchWatchlist();

      const selectArg = mockSupabase._mockSelect.mock.calls[0][0] as string;
      expect(selectArg).toContain('user_id');
      expect(selectArg).toContain('listing_id');
      expect(selectArg).toContain('created_at');
      expect(selectArg).toContain('listing:listings');
      expect(selectArg).toContain('photos:listing_photos');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('coerces null data to an empty array', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: null, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { fetchWatchlist, watchlistItems } = useWatchlist();

      watchlistItems.value = [createMockWatchlistItem()];
      await fetchWatchlist();

      expect(watchlistItems.value).toEqual([]);
    });

    it('shows an error toast and logs on fetch failure (without throwing)', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const dbError = new Error('Database error');
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: null, error: dbError });

      const useWatchlist = await loadUseWatchlist();
      const { fetchWatchlist } = useWatchlist();

      await expect(fetchWatchlist()).resolves.toBeUndefined();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load watchlist',
        color: 'error',
      });
      expect(console.error).toHaveBeenCalledWith('Error fetching watchlist:', dbError);
    });
  });

  // -------------------------------------------------------------------------
  // addToWatchlist
  // -------------------------------------------------------------------------
  describe('addToWatchlist', () => {
    it('warns and returns false when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { addToWatchlist } = useWatchlist();

      const result = await addToWatchlist('listing-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Authentication Required',
        description: 'Please sign in to save listings',
        color: 'warning',
      });
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    });

    it('inserts a row keyed by the current user when authenticated', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });

      const useWatchlist = await loadUseWatchlist();
      const { addToWatchlist } = useWatchlist();

      await addToWatchlist('listing-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('watchlist');
      expect(mockSupabase._queryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        listing_id: 'listing-123',
      });
    });

    it('returns true, captures analytics, refreshes, and shows success toast on add', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const refreshed = [createMockWatchlistItem({ listing_id: 'listing-123' })];
      mockSupabase._queryBuilder.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: refreshed, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { addToWatchlist, watchlistItems } = useWatchlist();

      const result = await addToWatchlist('listing-123');

      expect(result).toBe(true);
      // refresh ran via fetchWatchlist
      expect(watchlistItems.value).toEqual(refreshed);
      // analytics fired with the source page from the route
      expect(mockCapture).toHaveBeenCalledWith('listing_watchlisted', {
        listing_id: 'listing-123',
        source_page: ROUTE_PATH,
      });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Saved',
        description: 'Listing added to your watchlist',
        color: 'success',
      });
    });

    it('treats a duplicate-key (23505) insert as "already saved" and returns false', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.insert = vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });
      const orderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase._queryBuilder.order = orderSpy;

      const useWatchlist = await loadUseWatchlist();
      const { addToWatchlist } = useWatchlist();

      const result = await addToWatchlist('listing-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Already Saved',
        description: 'This listing is already in your watchlist',
        color: 'info',
      });
      // duplicate path short-circuits before refresh / analytics
      expect(orderSpy).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('shows an error toast and returns false on other insert errors', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.insert = vi.fn().mockResolvedValue({
        data: null,
        error: { code: '500', message: 'Server error' },
      });

      const useWatchlist = await loadUseWatchlist();
      const { addToWatchlist } = useWatchlist();

      const result = await addToWatchlist('listing-123');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to add listing to watchlist',
        color: 'error',
      });
      expect(console.error).toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // removeFromWatchlist
  // -------------------------------------------------------------------------
  describe('removeFromWatchlist', () => {
    // delete().eq('user_id').eq('listing_id') — terminal is the second eq.
    const stubDelete = (result: { data: any; error: any }) => {
      const secondEq = vi.fn().mockResolvedValue(result);
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._queryBuilder.delete = vi.fn().mockReturnValue({ eq: firstEq });
      return { firstEq, secondEq };
    };

    it('returns false without touching Supabase when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useWatchlist = await loadUseWatchlist();
      const { removeFromWatchlist } = useWatchlist();

      const result = await removeFromWatchlist('listing-123');

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('deletes the row filtered by user id and listing id', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const { firstEq, secondEq } = stubDelete({ data: null, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { removeFromWatchlist } = useWatchlist();

      await removeFromWatchlist('listing-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('watchlist');
      expect(mockSupabase._queryBuilder.delete).toHaveBeenCalled();
      expect(firstEq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(secondEq).toHaveBeenCalledWith('listing_id', 'listing-123');
    });

    it('returns true, prunes local state, captures analytics, and shows info toast on success', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      stubDelete({ data: null, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { removeFromWatchlist, watchlistItems } = useWatchlist();

      watchlistItems.value = [
        createMockWatchlistItem({ listing_id: 'listing-123' }),
        createMockWatchlistItem({ listing_id: 'listing-456' }),
      ];

      const result = await removeFromWatchlist('listing-123');

      expect(result).toBe(true);
      expect(watchlistItems.value.map((i) => i.listing_id)).toEqual(['listing-456']);
      expect(mockCapture).toHaveBeenCalledWith('listing_unwatchlisted', {
        listing_id: 'listing-123',
        source_page: ROUTE_PATH,
      });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Removed',
        description: 'Listing removed from your watchlist',
        color: 'info',
      });
    });

    it('shows an error toast, returns false, and leaves local state intact on delete error', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      stubDelete({ data: null, error: new Error('Database error') });

      const useWatchlist = await loadUseWatchlist();
      const { removeFromWatchlist, watchlistItems } = useWatchlist();

      watchlistItems.value = [createMockWatchlistItem({ listing_id: 'listing-123' })];

      const result = await removeFromWatchlist('listing-123');

      expect(result).toBe(false);
      // state untouched because the error throws before the filter
      expect(watchlistItems.value.map((i) => i.listing_id)).toEqual(['listing-123']);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to remove listing from watchlist',
        color: 'error',
      });
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // toggleWatchlist
  // -------------------------------------------------------------------------
  describe('toggleWatchlist', () => {
    it('adds when the listing is not currently watchlisted', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase._queryBuilder.insert = insertSpy;
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });

      const useWatchlist = await loadUseWatchlist();
      const { toggleWatchlist, watchlistItems } = useWatchlist();

      watchlistItems.value = [];
      const result = await toggleWatchlist('listing-123');

      expect(insertSpy).toHaveBeenCalledWith({ user_id: 'test-user-id', listing_id: 'listing-123' });
      expect(result).toBe(true);
    });

    it('removes when the listing is already watchlisted', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const secondEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      const deleteSpy = vi.fn().mockReturnValue({ eq: firstEq });
      mockSupabase._queryBuilder.delete = deleteSpy;
      const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase._queryBuilder.insert = insertSpy;

      const useWatchlist = await loadUseWatchlist();
      const { toggleWatchlist, watchlistItems } = useWatchlist();

      watchlistItems.value = [createMockWatchlistItem({ listing_id: 'listing-123' })];
      const result = await toggleWatchlist('listing-123');

      expect(deleteSpy).toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getWatchlistCount
  // -------------------------------------------------------------------------
  describe('getWatchlistCount', () => {
    // select('*', { count, head }).eq('listing_id') — terminal is eq.
    it('returns the watcher count and uses a head/exact count query', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.eq = vi.fn().mockResolvedValue({ count: 5, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { getWatchlistCount } = useWatchlist();

      const count = await getWatchlistCount('listing-123');

      expect(count).toBe(5);
      expect(mockSupabase.from).toHaveBeenCalledWith('watchlist');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('listing_id', 'listing-123');
    });

    it('works for anonymous callers (no auth gate)', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.eq = vi.fn().mockResolvedValue({ count: 3, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { getWatchlistCount } = useWatchlist();

      expect(await getWatchlistCount('listing-123')).toBe(3);
    });

    it('returns 0 when count is null', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.eq = vi.fn().mockResolvedValue({ count: null, error: null });

      const useWatchlist = await loadUseWatchlist();
      const { getWatchlistCount } = useWatchlist();

      expect(await getWatchlistCount('listing-123')).toBe(0);
    });

    it('returns 0 and logs on error', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const err = new Error('Database error');
      mockSupabase._queryBuilder.eq = vi.fn().mockResolvedValue({ count: null, error: err });

      const useWatchlist = await loadUseWatchlist();
      const { getWatchlistCount } = useWatchlist();

      expect(await getWatchlistCount('listing-123')).toBe(0);
      expect(console.error).toHaveBeenCalledWith('Error getting watchlist count:', err);
    });
  });

  // -------------------------------------------------------------------------
  // shared state (useState key 'watchlist-items')
  // -------------------------------------------------------------------------
  describe('shared state', () => {
    it('shares watchlist state across multiple instances', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const refreshed = [createMockWatchlistItem({ listing_id: 'listing-123' })];
      mockSupabase._queryBuilder.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: refreshed, error: null });

      const useWatchlist = await loadUseWatchlist();
      const a = useWatchlist();
      const b = useWatchlist();

      await a.addToWatchlist('listing-123');

      expect(a.watchlistItems.value).toEqual(refreshed);
      expect(b.watchlistItems.value).toEqual(refreshed);
      expect(a.isWatchlisted('listing-123')).toBe(true);
      expect(b.isWatchlisted('listing-123')).toBe(true);
    });
  });
});
