import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupGlobalMocks, createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { SavedSearch } from '~/app/composables/useSavedSearches';

let mockSupabase: ReturnType<typeof setupGlobalMocks>['mockSupabase'];
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;

const makeSavedSearch = (overrides: Partial<SavedSearch> = {}): SavedSearch => ({
  id: 'search-1',
  user_id: 'test-user-id',
  name: 'Cooper S under 20k',
  filters: { model: 'Cooper S', maxPrice: 20000 },
  notify_email: true,
  is_active: true,
  notified_listing_ids: [],
  created_at: '2026-02-21T00:00:00Z',
  ...overrides,
});

// setupGlobalMocks stubs useAuth + useSupabase. useToast and usePostHog are not
// covered there, so wire them per-test and capture the spies for assertions.
const installAux = () => {
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
};

const loadComposable = async () => {
  const { useSavedSearches } = await import('~/app/composables/useSavedSearches');
  return useSavedSearches();
};

describe('useSavedSearches', () => {
  beforeEach(() => {
    ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
    installAux();
  });

  afterEach(() => {
    cleanupGlobalMocks();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // fetchSavedSearches()
  // ===========================================================================
  describe('fetchSavedSearches()', () => {
    it('queries saved_searches scoped to the user, newest first', async () => {
      const searches = [
        makeSavedSearch({ id: 'search-1', name: 'Cooper S under 20k' }),
        makeSavedSearch({ id: 'search-2', name: 'Parts in California' }),
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: searches, error: null }));

      const { fetchSavedSearches, savedSearches } = await loadComposable();
      await fetchSavedSearches();

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_searches');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(savedSearches.value).toEqual(searches);
    });

    it('returns an empty array and skips the query when not logged in', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: null }));
      installAux();

      const { fetchSavedSearches, savedSearches } = await loadComposable();
      await fetchSavedSearches();

      expect(savedSearches.value).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('shows an error toast and leaves state empty on query failure', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'Database error' } })
      );

      const { fetchSavedSearches, savedSearches } = await loadComposable();
      await fetchSavedSearches();

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Failed to load saved searches',
          color: 'error',
        })
      );
      expect(savedSearches.value).toEqual([]);
    });

    it('coerces null data to an empty array', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const { fetchSavedSearches, savedSearches } = await loadComposable();
      await fetchSavedSearches();

      expect(savedSearches.value).toEqual([]);
      expect(mockToast.add).not.toHaveBeenCalled();
    });

    it('toggles loading false after a successful fetch', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { fetchSavedSearches, loading } = await loadComposable();
      expect(loading.value).toBe(false);
      await fetchSavedSearches();
      expect(loading.value).toBe(false);
    });

    it('sets loading true while the fetch is in flight', async () => {
      let release!: (v: any) => void;
      const gate = new Promise<{ data: any; error: any }>((res) => {
        release = res;
      });
      // `.order()` returns the (thenable) queryBuilder; awaiting it calls then().
      // Defer resolution through `gate` so we can observe loading mid-flight.
      mockSupabase._queryBuilder.then = vi.fn((resolve: any, reject: any) => gate.then(resolve, reject));

      const { fetchSavedSearches, loading } = await loadComposable();
      const promise = fetchSavedSearches();
      expect(loading.value).toBe(true);

      release({ data: [], error: null });
      await promise;
      expect(loading.value).toBe(false);
    });

    it('resets loading to false on fetch error', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'boom' } })
      );

      const { fetchSavedSearches, loading } = await loadComposable();
      await fetchSavedSearches();
      expect(loading.value).toBe(false);
    });
  });

  // ===========================================================================
  // createSavedSearch()
  // ===========================================================================
  describe('createSavedSearch()', () => {
    it('inserts a scoped row, prepends it, and returns the created search', async () => {
      const newSearch = makeSavedSearch({ id: 'new-search-1' });
      mockSupabase._mockSingle.mockResolvedValue({ data: newSearch, error: null });

      const { createSavedSearch, savedSearches } = await loadComposable();
      const result = await createSavedSearch('Cooper S under 20k', { model: 'Cooper S', maxPrice: 20000 });

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_searches');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        name: 'Cooper S under 20k',
        filters: { model: 'Cooper S', maxPrice: 20000 },
      });
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(newSearch);
      expect(savedSearches.value).toHaveLength(1);
      expect(savedSearches.value[0]).toEqual(newSearch);
    });

    it('shows a success toast after creating', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: makeSavedSearch(), error: null });

      const { createSavedSearch } = await loadComposable();
      await createSavedSearch('Test', { model: 'Cooper' });

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Search Saved', color: 'success' })
      );
    });

    it('captures saved_search_created with the filter count', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: makeSavedSearch(), error: null });

      const { createSavedSearch } = await loadComposable();
      await createSavedSearch('Cooper S under 20k', { model: 'Cooper S', maxPrice: 20000 });

      expect(mockCapture).toHaveBeenCalledWith('saved_search_created', {
        search_name: 'Cooper S under 20k',
        filter_count: 2,
      });
    });

    it('returns null, warns, and skips the insert when not logged in', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: null }));
      installAux();

      const { createSavedSearch } = await loadComposable();
      const result = await createSavedSearch('Test', { model: 'Cooper' });

      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Required', color: 'warning' })
      );
    });

    it('enforces the max of 10 saved searches', async () => {
      const { createSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = Array.from({ length: 10 }, (_, i) => makeSavedSearch({ id: `search-${i}` }));

      const result = await createSavedSearch('Too many', { model: 'Cooper' });

      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Limit Reached', color: 'warning' })
      );
    });

    it('allows creating when exactly under the limit (9 existing)', async () => {
      const newSearch = makeSavedSearch({ id: 'new-search' });
      mockSupabase._mockSingle.mockResolvedValue({ data: newSearch, error: null });

      const { createSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = Array.from({ length: 9 }, (_, i) => makeSavedSearch({ id: `search-${i}` }));

      const result = await createSavedSearch('One more', { model: 'Cooper' });

      expect(result).toEqual(newSearch);
      expect(savedSearches.value).toHaveLength(10);
    });

    it('returns null and surfaces the Supabase message on insert failure', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      const { createSavedSearch, savedSearches } = await loadComposable();
      const result = await createSavedSearch('Test', { model: 'Cooper' });

      expect(result).toBeNull();
      expect(savedSearches.value).toHaveLength(0);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', description: 'Insert failed', color: 'error' })
      );
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('prepends the new search ahead of existing ones', async () => {
      const existing = makeSavedSearch({ id: 'existing', name: 'Old search' });
      const newSearch = makeSavedSearch({ id: 'new-search', name: 'New search' });
      mockSupabase._mockSingle.mockResolvedValue({ data: newSearch, error: null });

      const { createSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = [existing];

      await createSavedSearch('New search', { model: 'Cooper' });

      expect(savedSearches.value[0].id).toBe('new-search');
      expect(savedSearches.value[1].id).toBe('existing');
    });

    it('toggles saving false after a successful create', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: makeSavedSearch(), error: null });

      const { createSavedSearch, saving } = await loadComposable();
      expect(saving.value).toBe(false);
      await createSavedSearch('Test', { model: 'Cooper' });
      expect(saving.value).toBe(false);
    });

    it('sets saving true while the insert is in flight', async () => {
      let release!: (v: any) => void;
      mockSupabase._mockSingle.mockImplementation(
        () => new Promise((resolve) => (release = resolve))
      );

      const { createSavedSearch, saving } = await loadComposable();
      const promise = createSavedSearch('Test', { model: 'Cooper' });
      expect(saving.value).toBe(true);

      release({ data: makeSavedSearch(), error: null });
      await promise;
      expect(saving.value).toBe(false);
    });

    it('resets saving to false on create error', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      const { createSavedSearch, saving } = await loadComposable();
      await createSavedSearch('Test', { model: 'Cooper' });
      expect(saving.value).toBe(false);
    });

    it('passes an empty filters object through as filter_count 0', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: makeSavedSearch(), error: null });

      const { createSavedSearch } = await loadComposable();
      await createSavedSearch('No filters', {});

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        name: 'No filters',
        filters: {},
      });
      expect(mockCapture).toHaveBeenCalledWith('saved_search_created', {
        search_name: 'No filters',
        filter_count: 0,
      });
    });
  });

  // ===========================================================================
  // toggleActive()
  // ===========================================================================
  describe('toggleActive()', () => {
    it('flips is_active true -> false optimistically and persists', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));

      const { toggleActive, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1', is_active: true })];

      const result = await toggleActive('search-1');

      expect(result).toBe(true);
      expect(savedSearches.value[0].is_active).toBe(false);
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('flips is_active false -> true optimistically and persists', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));

      const { toggleActive, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1', is_active: false })];

      const result = await toggleActive('search-1');

      expect(result).toBe(true);
      expect(savedSearches.value[0].is_active).toBe(true);
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ is_active: true });
    });

    it('reverts the optimistic update and toasts on failure', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ error: { message: 'Update failed' } })
      );

      const { toggleActive, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1', is_active: true })];

      const result = await toggleActive('search-1');

      expect(result).toBe(false);
      expect(savedSearches.value[0].is_active).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', description: 'Update failed', color: 'error' })
      );
    });

    it('returns false and skips the query when not logged in', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: null }));
      installAux();

      const { toggleActive } = await loadComposable();
      const result = await toggleActive('search-1');

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns false and skips the query for an unknown id', async () => {
      const { toggleActive, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1' })];

      const result = await toggleActive('nonexistent-id');

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('scopes the update to id and user_id', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));

      const { toggleActive, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1', is_active: true })];

      await toggleActive('search-1');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'search-1');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });
  });

  // ===========================================================================
  // deleteSavedSearch()
  // ===========================================================================
  describe('deleteSavedSearch()', () => {
    it('deletes the row and removes it from local state', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));

      const { deleteSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = [
        makeSavedSearch({ id: 'search-1', name: 'First' }),
        makeSavedSearch({ id: 'search-2', name: 'Second' }),
      ];

      const result = await deleteSavedSearch('search-1');

      expect(result).toBe(true);
      expect(mockSupabase._mockDelete).toHaveBeenCalled();
      expect(savedSearches.value).toHaveLength(1);
      expect(savedSearches.value[0].id).toBe('search-2');
    });

    it('shows a success toast after deleting', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));

      const { deleteSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1' })];

      await deleteSavedSearch('search-1');

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Deleted', color: 'success' })
      );
    });

    it('returns false and skips the query when not logged in', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: null }));
      installAux();

      const { deleteSavedSearch } = await loadComposable();
      const result = await deleteSavedSearch('search-1');

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('keeps local state and surfaces the message on delete failure', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ error: { message: 'Delete failed' } })
      );

      const { deleteSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1' })];

      const result = await deleteSavedSearch('search-1');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', description: 'Delete failed', color: 'error' })
      );
      expect(savedSearches.value).toHaveLength(1);
    });

    it('scopes the delete to id and user_id', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));

      const { deleteSavedSearch, savedSearches } = await loadComposable();
      savedSearches.value = [makeSavedSearch({ id: 'search-1' })];

      await deleteSavedSearch('search-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('saved_searches');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'search-1');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });
  });

  // ===========================================================================
  // initial state
  // ===========================================================================
  describe('initial state', () => {
    it('exposes empty searches and idle loading/saving flags', async () => {
      const { savedSearches, loading, saving } = await loadComposable();
      expect(savedSearches.value).toEqual([]);
      expect(loading.value).toBe(false);
      expect(saving.value).toBe(false);
    });
  });
});
