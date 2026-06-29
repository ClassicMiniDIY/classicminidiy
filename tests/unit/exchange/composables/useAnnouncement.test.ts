import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { createMockAuth, createMockUser, setupGlobalMocks, cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { SiteAnnouncement } from '~/app/composables/useAnnouncement';

// ---------------------------------------------------------------------------
// useAnnouncement depends on: useSupabase, useAuth, useErrorHandler.
//   - useSupabase / useAuth are stubbed via setupGlobalMocks (testHelpers).
//   - useErrorHandler is NOT globally stubbed; updateAnnouncement() calls the
//     REAL useErrorHandler().handleError, which in turn uses useToast (real
//     composable — stub per test), usePostHog + useRoute (both globally stubbed
//     in vitest.setup). We stub useToast explicitly so handleError's toast.add
//     does not blow up and so we can assert on it.
//   - There is a MODULE-LEVEL cache (announcementCache) with a 60s TTL. Because
//     cleanupGlobalMocks() calls vi.resetModules() in afterEach, every test that
//     dynamically imports the composable gets a fresh module → fresh null cache.
//     Within a single test, repeated useAnnouncement() calls share that cache.
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };

const createMockAnnouncement = (overrides: Partial<SiteAnnouncement> = {}): SiteAnnouncement => ({
  id: 1,
  title: 'Site Maintenance',
  description: 'We will be down for maintenance Saturday night.',
  type: 'info',
  is_enabled: true,
  updated_by: null,
  created_at: new Date('2026-06-01T00:00:00Z').toISOString(),
  updated_at: new Date('2026-06-20T00:00:00Z').toISOString(),
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockToast = { add: vi.fn() };

  // Default: authenticated user (the prompt's canonical setup). Individual tests
  // re-stub useAuth (anon vs. signed-in) as needed before importing.
  setupGlobalMocks({ user: createMockUser() });
  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => mockToast);

  // useErrorHandler is auto-imported in Nuxt but NOT provided by vitest.setup,
  // so it must be stubbed or composable instantiation throws. This stub mirrors
  // the real handleError contract used by updateAnnouncement: fire a toast and
  // honor { rethrow }.
  vi.stubGlobal('useErrorHandler', () => ({
    handleError: vi.fn((error: any, options: { toastTitle?: string; rethrow?: boolean } = {}) => {
      mockToast.add({ title: options.toastTitle ?? 'Error', description: error?.message, color: 'error' });
      if (options.rethrow) throw error;
      return error;
    }),
    withErrorHandling: vi.fn(),
  }));

  // Keep the catch-block console.error noise out of the test output but assert
  // on it where it matters.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const loadComposable = async () => {
  const { useAnnouncement } = await import('~/app/composables/useAnnouncement');
  return useAnnouncement;
};

describe('useAnnouncement', () => {
  // -------------------------------------------------------------------------
  // surface
  // -------------------------------------------------------------------------
  describe('public surface', () => {
    it('exposes exactly the documented members', async () => {
      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      expect(typeof api.getAnnouncement).toBe('function');
      expect(typeof api.getActiveAnnouncement).toBe('function');
      expect(typeof api.updateAnnouncement).toBe('function');
      expect(typeof api.invalidateCache).toBe('function');
      expect(Object.keys(api).sort()).toEqual(
        ['getActiveAnnouncement', 'getAnnouncement', 'invalidateCache', 'updateAnnouncement'].sort()
      );
    });
  });

  // -------------------------------------------------------------------------
  // getAnnouncement()
  // -------------------------------------------------------------------------
  describe('getAnnouncement()', () => {
    it('queries site_announcements filtered by id=1 with single()', async () => {
      const announcement = createMockAnnouncement();
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      await useAnnouncement().getAnnouncement();

      expect(mockSupabase.from).toHaveBeenCalledWith('site_announcements');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('returns the announcement row on success', async () => {
      const announcement = createMockAnnouncement({ title: 'Hello', type: 'warning' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getAnnouncement();

      expect(result).toEqual(announcement);
    });

    it('returns null when the row data is null (no error)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getAnnouncement();

      // data is null → cast to SiteAnnouncement and returned as-is (null).
      expect(result).toBeNull();
    });

    it('returns null (no throw) for PGRST116 — single() found no row', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Results contain 0 rows' },
      });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getAnnouncement();

      expect(result).toBeNull();
      // PGRST116 is handled before the catch — no console.error logging.
      expect(console.error).not.toHaveBeenCalled();
    });

    it('returns null (no throw) for 42P01 — table does not exist yet', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '42P01', message: 'relation "site_announcements" does not exist' },
      });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getAnnouncement();

      expect(result).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('swallows an unexpected Supabase error, logs it, and returns null', async () => {
      const dbError = { code: '500', message: 'Internal database error' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: dbError });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getAnnouncement();

      expect(result).toBeNull();
      // Non-PGRST116/42P01 errors are thrown internally then caught → logged.
      expect(console.error).toHaveBeenCalledWith('Failed to fetch announcement:', dbError);
    });

    it('swallows a thrown/rejected query and returns null', async () => {
      const thrown = new Error('network down');
      mockSupabase._mockSingle.mockRejectedValueOnce(thrown);

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getAnnouncement();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Failed to fetch announcement:', thrown);
    });

    // ---- caching invariants -------------------------------------------------
    it('caches the result — a second call within TTL does NOT re-query', async () => {
      const announcement = createMockAnnouncement();
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      const first = await api.getAnnouncement();
      const second = await api.getAnnouncement();

      expect(first).toEqual(announcement);
      expect(second).toEqual(announcement);
      // single() only ran once — second call served from cache.
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('shares the cache across separate useAnnouncement() instances (module-level)', async () => {
      const announcement = createMockAnnouncement();
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();

      const a = await useAnnouncement().getAnnouncement();
      const b = await useAnnouncement().getAnnouncement();

      expect(a).toEqual(announcement);
      expect(b).toEqual(announcement);
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
    });

    it('re-queries after the cache TTL (60s) expires', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      const first = createMockAnnouncement({ title: 'First' });
      const second = createMockAnnouncement({ title: 'Second' });
      mockSupabase._mockSingle
        .mockResolvedValueOnce({ data: first, error: null })
        .mockResolvedValueOnce({ data: second, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      const a = await api.getAnnouncement();
      expect(a).toEqual(first);

      // Advance just past the 60s TTL.
      vi.setSystemTime(new Date('2026-06-28T12:01:01Z'));

      const b = await api.getAnnouncement();
      expect(b).toEqual(second);
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(2);
    });

    it('still serves from cache at the TTL boundary (just under 60s)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      const announcement = createMockAnnouncement();
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      await api.getAnnouncement();
      // 59.999s later — still inside TTL (strict < CACHE_TTL).
      vi.setSystemTime(new Date('2026-06-28T12:00:59.999Z'));
      await api.getAnnouncement();

      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
    });

    it('does NOT cache a null/error result — a swallowed error re-queries next call', async () => {
      mockSupabase._mockSingle
        .mockResolvedValueOnce({ data: null, error: { code: '42P01', message: 'no table' } })
        .mockResolvedValueOnce({ data: createMockAnnouncement(), error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      const first = await api.getAnnouncement();
      expect(first).toBeNull();

      const second = await api.getAnnouncement();
      // No cache was written on the error path → second call hits the DB again.
      expect(second).not.toBeNull();
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // getActiveAnnouncement()
  // -------------------------------------------------------------------------
  describe('getActiveAnnouncement()', () => {
    it('returns the announcement when enabled and it has a title', async () => {
      const announcement = createMockAnnouncement({ is_enabled: true, title: 'Up', description: null });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      expect(result).toEqual(announcement);
    });

    it('returns the announcement when enabled and it has only a description', async () => {
      const announcement = createMockAnnouncement({ is_enabled: true, title: null, description: 'Body only' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      expect(result).toEqual(announcement);
    });

    it('returns null when the announcement is disabled', async () => {
      const announcement = createMockAnnouncement({ is_enabled: false });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      expect(result).toBeNull();
    });

    it('returns null when enabled but both title and description are null', async () => {
      const announcement = createMockAnnouncement({ is_enabled: true, title: null, description: null });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      expect(result).toBeNull();
    });

    it('returns null when enabled but title and description are empty strings (falsy)', async () => {
      const announcement = createMockAnnouncement({ is_enabled: true, title: '', description: '' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      // Empty strings are falsy → treated as "no content".
      expect(result).toBeNull();
    });

    it('returns null when there is no announcement at all', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      expect(result).toBeNull();
    });

    it('returns null when the underlying fetch errors (swallowed → null)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '500', message: 'boom' },
      });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().getActiveAnnouncement();

      expect(result).toBeNull();
    });

    it('delegates to getAnnouncement and therefore benefits from the cache', async () => {
      const announcement = createMockAnnouncement({ is_enabled: true });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      await api.getActiveAnnouncement();
      await api.getActiveAnnouncement();

      // Second active-check served from cache → only one DB hit.
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // updateAnnouncement()
  // -------------------------------------------------------------------------
  describe('updateAnnouncement()', () => {
    it('throws "Authentication required" when there is no user', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useAnnouncement = await loadComposable();
      await expect(useAnnouncement().updateAnnouncement({ title: 'X' })).rejects.toThrow('Authentication required');
    });

    it('shows an error toast when unauthenticated (handleError path)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(null));

      const useAnnouncement = await loadComposable();
      await expect(useAnnouncement().updateAnnouncement({ title: 'X' })).rejects.toThrow('Authentication required');

      // handleError(rethrow:true) fires a toast before rethrowing.
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to Update Announcement', color: 'error' })
      );
    });

    it('updates site_announcements with the provided fields plus updated_by, filtered by id=1', async () => {
      const user = createMockUser({ id: 'admin-1' });
      vi.stubGlobal('useAuth', () => createMockAuth(user));

      const updated = createMockAnnouncement({ title: 'New', updated_by: 'admin-1' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: updated, error: null });

      const useAnnouncement = await loadComposable();
      await useAnnouncement().updateAnnouncement({ title: 'New', is_enabled: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('site_announcements');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({
        title: 'New',
        is_enabled: true,
        updated_by: 'admin-1',
      });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('stamps updated_by with the current user id', async () => {
      const user = createMockUser({ id: 'editor-42' });
      vi.stubGlobal('useAuth', () => createMockAuth(user));

      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockAnnouncement(), error: null });

      const useAnnouncement = await loadComposable();
      await useAnnouncement().updateAnnouncement({ type: 'success' });

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg).toEqual({ type: 'success', updated_by: 'editor-42' });
    });

    it('returns the updated row on success', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const updated = createMockAnnouncement({ description: 'Updated body' });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: updated, error: null });

      const useAnnouncement = await loadComposable();
      const result = await useAnnouncement().updateAnnouncement({ description: 'Updated body' });

      expect(result).toEqual(updated);
    });

    it('only sends the provided fields (plus updated_by)', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser({ id: 'test-user-id' })));
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: createMockAnnouncement(), error: null });

      const useAnnouncement = await loadComposable();
      await useAnnouncement().updateAnnouncement({ is_enabled: false });

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg).toEqual({ is_enabled: false, updated_by: 'test-user-id' });
      expect(updateArg).not.toHaveProperty('title');
      expect(updateArg).not.toHaveProperty('description');
      expect(updateArg).not.toHaveProperty('type');
    });

    it('throws and toasts when Supabase returns an error', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const dbError = { message: 'permission denied', code: '42501' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: dbError });

      const useAnnouncement = await loadComposable();
      await expect(useAnnouncement().updateAnnouncement({ title: 'X' })).rejects.toEqual(dbError);

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to Update Announcement', color: 'error' })
      );
    });

    it('invalidates the cache so subsequent getAnnouncement re-queries', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const original = createMockAnnouncement({ title: 'Original' });
      const afterUpdate = createMockAnnouncement({ title: 'Edited' });
      const refetched = createMockAnnouncement({ title: 'Edited' });

      mockSupabase._mockSingle
        // 1) initial getAnnouncement → caches "Original"
        .mockResolvedValueOnce({ data: original, error: null })
        // 2) updateAnnouncement → returns "Edited", invalidates cache
        .mockResolvedValueOnce({ data: afterUpdate, error: null })
        // 3) getAnnouncement again → must re-query because cache was cleared
        .mockResolvedValueOnce({ data: refetched, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      const first = await api.getAnnouncement();
      expect(first).toEqual(original);

      await api.updateAnnouncement({ title: 'Edited' });

      const second = await api.getAnnouncement();
      expect(second).toEqual(refetched);
      // 1 initial fetch + 1 update + 1 post-invalidation fetch = 3 single() calls.
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(3);
    });

    it('does NOT invalidate the cache when the update fails', async () => {
      vi.stubGlobal('useAuth', () => createMockAuth(createMockUser()));

      const cached = createMockAnnouncement({ title: 'Cached' });

      mockSupabase._mockSingle
        // 1) prime the cache
        .mockResolvedValueOnce({ data: cached, error: null })
        // 2) failed update — throws before the cache-invalidation line
        .mockResolvedValueOnce({ data: null, error: { message: 'denied', code: '42501' } });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      await api.getAnnouncement(); // cache "Cached"
      await expect(api.updateAnnouncement({ title: 'Edited' })).rejects.toMatchObject({ code: '42501' });

      // Cache should still be valid → this read is served from cache (no new single()).
      const stillCached = await api.getAnnouncement();
      expect(stillCached).toEqual(cached);
      // 1 prime + 1 failed update = 2; the post-failure read used the cache.
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // invalidateCache()
  // -------------------------------------------------------------------------
  describe('invalidateCache()', () => {
    it('forces the next getAnnouncement to re-query', async () => {
      const first = createMockAnnouncement({ title: 'First' });
      const second = createMockAnnouncement({ title: 'Second' });
      mockSupabase._mockSingle
        .mockResolvedValueOnce({ data: first, error: null })
        .mockResolvedValueOnce({ data: second, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      const a = await api.getAnnouncement();
      expect(a).toEqual(first);

      api.invalidateCache();

      const b = await api.getAnnouncement();
      expect(b).toEqual(second);
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(2);
    });

    it('is idempotent / safe to call when nothing is cached', async () => {
      const announcement = createMockAnnouncement();
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: announcement, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      // Clear an empty cache, then fetch.
      api.invalidateCache();
      api.invalidateCache();
      const result = await api.getAnnouncement();

      expect(result).toEqual(announcement);
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
    });

    it('invalidation also affects getActiveAnnouncement (shared cache)', async () => {
      const first = createMockAnnouncement({ is_enabled: true, title: 'A' });
      const second = createMockAnnouncement({ is_enabled: true, title: 'B' });
      mockSupabase._mockSingle
        .mockResolvedValueOnce({ data: first, error: null })
        .mockResolvedValueOnce({ data: second, error: null });

      const useAnnouncement = await loadComposable();
      const api = useAnnouncement();

      const a = await api.getActiveAnnouncement();
      expect(a).toEqual(first);

      api.invalidateCache();

      const b = await api.getActiveAnnouncement();
      expect(b).toEqual(second);
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(2);
    });
  });
});
