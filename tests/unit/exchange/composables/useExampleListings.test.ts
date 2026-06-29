import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// Resolved-value handles assigned in beforeEach so each test can drive Supabase.
let mockSupabase: ReturnType<typeof setupGlobalMocks>['mockSupabase'];

beforeEach(() => {
  ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useExampleListings', () => {
  // ---------------------------------------------------------------------------
  // EXAMPLE_STATUSES constant
  // ---------------------------------------------------------------------------
  describe('EXAMPLE_STATUSES', () => {
    it('contains both example statuses and nothing else', async () => {
      const { EXAMPLE_STATUSES } = await import('~/composables/useExampleListings');
      expect(EXAMPLE_STATUSES).toContain('example_free');
      expect(EXAMPLE_STATUSES).toContain('example_paid');
      expect(EXAMPLE_STATUSES).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // isExampleStatus()
  // ---------------------------------------------------------------------------
  describe('isExampleStatus()', () => {
    it('returns true for example_free', async () => {
      const { isExampleStatus } = await import('~/composables/useExampleListings');
      expect(isExampleStatus('example_free')).toBe(true);
    });

    it('returns true for example_paid', async () => {
      const { isExampleStatus } = await import('~/composables/useExampleListings');
      expect(isExampleStatus('example_paid')).toBe(true);
    });

    it('returns false for the real "active" status', async () => {
      const { isExampleStatus } = await import('~/composables/useExampleListings');
      expect(isExampleStatus('active')).toBe(false);
    });

    it('returns false for unrelated statuses (draft, sold, "")', async () => {
      const { isExampleStatus } = await import('~/composables/useExampleListings');
      expect(isExampleStatus('draft')).toBe(false);
      expect(isExampleStatus('sold')).toBe(false);
      expect(isExampleStatus('')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sortExamplesLast()
  // ---------------------------------------------------------------------------
  describe('sortExamplesLast()', () => {
    it('moves example listings after real listings', async () => {
      const { sortExamplesLast } = await import('~/composables/useExampleListings');
      const input = [
        { id: 'a', status: 'example_free' },
        { id: 'b', status: 'active' },
        { id: 'c', status: 'example_paid' },
        { id: 'd', status: 'active' },
      ];
      const result = sortExamplesLast(input);
      expect(result.map((l) => l.id)).toEqual(['b', 'd', 'a', 'c']);
    });

    it('is a stable sort — preserves original order within each group', async () => {
      const { sortExamplesLast } = await import('~/composables/useExampleListings');
      const input = [
        { id: 'real1', status: 'active' },
        { id: 'ex1', status: 'example_free' },
        { id: 'real2', status: 'active' },
        { id: 'ex2', status: 'example_paid' },
        { id: 'real3', status: 'active' },
      ];
      const result = sortExamplesLast(input);
      expect(result.map((l) => l.id)).toEqual(['real1', 'real2', 'real3', 'ex1', 'ex2']);
    });

    it('returns a new array and does not mutate the input', async () => {
      const { sortExamplesLast } = await import('~/composables/useExampleListings');
      const input = [
        { id: 'a', status: 'example_free' },
        { id: 'b', status: 'active' },
      ];
      const snapshot = input.map((l) => l.id);
      const result = sortExamplesLast(input);
      expect(result).not.toBe(input);
      expect(input.map((l) => l.id)).toEqual(snapshot);
    });

    it('returns an empty array for empty input', async () => {
      const { sortExamplesLast } = await import('~/composables/useExampleListings');
      expect(sortExamplesLast([])).toEqual([]);
    });

    it('leaves an all-real list unchanged in order', async () => {
      const { sortExamplesLast } = await import('~/composables/useExampleListings');
      const input = [
        { id: 'a', status: 'active' },
        { id: 'b', status: 'active' },
      ];
      expect(sortExamplesLast(input).map((l) => l.id)).toEqual(['a', 'b']);
    });
  });

  // ---------------------------------------------------------------------------
  // loadVisibility()
  // ---------------------------------------------------------------------------
  describe('loadVisibility()', () => {
    it('sets showExamples true when site_settings.show_example_listings is true', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: true }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility, showExamples } = useExampleListings();
      await loadVisibility();

      expect(showExamples.value).toBe(true);
    });

    it('sets showExamples false when site_settings.show_example_listings is false', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: false }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility, showExamples } = useExampleListings();
      await loadVisibility();

      expect(showExamples.value).toBe(false);
    });

    it('queries the site_settings row id=1 selecting only show_example_listings', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: true }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility } = useExampleListings();
      await loadVisibility();

      expect(mockSupabase.from).toHaveBeenCalledWith('site_settings');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('show_example_listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('defaults to showing examples when Supabase returns an error', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility, showExamples } = useExampleListings();
      // Force a known-bad starting point to prove the error branch resets to true.
      showExamples.value = false;
      await loadVisibility();

      expect(showExamples.value).toBe(true);
    });

    it('defaults to showing examples when data is null without an error', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility, showExamples } = useExampleListings();
      showExamples.value = false;
      await loadVisibility();

      expect(showExamples.value).toBe(true);
    });

    it('is cached per-session — a second call does not re-query', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: false }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility } = useExampleListings();

      await loadVisibility();
      await loadVisibility();

      // single() should only have run once despite two loadVisibility calls.
      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('shares the cache across composable instances (useState-backed)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: false }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');

      const first = useExampleListings();
      await first.loadVisibility();

      // A fresh instance sees the cached flag and skips the query.
      const second = useExampleListings();
      await second.loadVisibility();

      expect(mockSupabase._mockSingle).toHaveBeenCalledTimes(1);
      expect(second.showExamples.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // setExampleVisibility()
  // ---------------------------------------------------------------------------
  describe('setExampleVisibility()', () => {
    it('updates site_settings row id=1 and reflects the new value locally', async () => {
      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { setExampleVisibility, showExamples } = useExampleListings();
      await setExampleVisibility(false);

      expect(mockSupabase.from).toHaveBeenCalledWith('site_settings');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ show_example_listings: false });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 1);
      expect(showExamples.value).toBe(false);
    });

    it('sets showExamples true when enabling', async () => {
      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { setExampleVisibility, showExamples } = useExampleListings();
      showExamples.value = false;
      await setExampleVisibility(true);

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ show_example_listings: true });
      expect(showExamples.value).toBe(true);
    });

    it('throws and does not mutate local state when the update errors', async () => {
      const updateError = { message: 'forbidden' };
      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: updateError });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { setExampleVisibility, showExamples } = useExampleListings();
      const before = showExamples.value; // default true

      await expect(setExampleVisibility(false)).rejects.toEqual(updateError);
      // Local state must not have been flipped on a failed write.
      expect(showExamples.value).toBe(before);
    });
  });

  // ---------------------------------------------------------------------------
  // activeStatuses (computed)
  // ---------------------------------------------------------------------------
  describe('activeStatuses', () => {
    it('defaults to including example statuses (showExamples defaults to true)', async () => {
      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { activeStatuses } = useExampleListings();
      expect(activeStatuses.value).toEqual(['active', 'example_free', 'example_paid']);
    });

    it('includes example statuses after loadVisibility resolves true', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: true }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility, activeStatuses } = useExampleListings();
      await loadVisibility();

      expect(activeStatuses.value).toEqual(['active', 'example_free', 'example_paid']);
    });

    it('excludes example statuses after loadVisibility resolves false', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { show_example_listings: false }, error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { loadVisibility, activeStatuses } = useExampleListings();
      await loadVisibility();

      expect(activeStatuses.value).toEqual(['active']);
    });

    it('reacts to setExampleVisibility flipping the flag off', async () => {
      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const { useExampleListings } = await import('~/composables/useExampleListings');
      const { setExampleVisibility, activeStatuses } = useExampleListings();

      expect(activeStatuses.value).toContain('example_free');
      await setExampleVisibility(false);
      expect(activeStatuses.value).toEqual(['active']);
    });
  });
});
