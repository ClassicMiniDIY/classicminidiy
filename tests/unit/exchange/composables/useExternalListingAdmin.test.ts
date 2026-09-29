import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { ExternalListing } from '~/app/composables/useExternalListings';

// ---------------------------------------------------------------------------
// Shared mocks. The CMDIY useExternalListingAdmin composable depends on:
//   useSupabase, useAuth, useToast, usePostHog, useState, $fetch.
// vitest.setup globally stubs usePostHog/useState/$fetch, but useToast is NOT
// stubbed there and we want controllable handles for toast + capture + $fetch,
// so we stub all of the user-driven ones explicitly here.
//
// Mutating-write chains terminate on `.eq('id', ...)` (which returns the query
// builder and is awaited via its `.then`), so update/approve/reject results are
// driven by reassigning `_queryBuilder.then` or `_queryBuilder.eq`. Reads use
// `.single()`. List queries terminate on `.order()` / `.range()`.
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;
let mockFetch: ReturnType<typeof vi.fn>;

const createMockExternalListing = (overrides: Partial<ExternalListing> = {}): ExternalListing =>
  ({
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
    status: 'pending',
    submitted_by: 'test-user-123',
    admin_notes: null,
    editor_commentary: null,
    is_editors_pick: false,
    like_count: 5,
    comment_count: 2,
    metadata_fetched_at: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    profiles: { display_name: 'Test User', username: null, avatar_url: null },
    ...overrides,
  }) as ExternalListing;

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();
  mockFetch = vi.fn();

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  vi.stubGlobal('$fetch', mockFetch);

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
  const { useExternalListingAdmin } = await import('~/app/composables/useExternalListingAdmin');
  return useExternalListingAdmin;
};

describe('useExternalListingAdmin', () => {
  // -------------------------------------------------------------------------
  // surface / initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('initializes with empty pending/all lists and loading=false', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { pendingFinds, allFinds, loading } = useExternalListingAdmin();

      expect(pendingFinds.value).toEqual([]);
      expect(allFinds.value).toEqual([]);
      expect(loading.value).toBe(false);
    });

    it('exposes all expected members', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const api = useExternalListingAdmin();

      expect(typeof api.fetchPending).toBe('function');
      expect(typeof api.fetchAll).toBe('function');
      expect(typeof api.approve).toBe('function');
      expect(typeof api.reject).toBe('function');
      expect(typeof api.refetchMetadata).toBe('function');
      expect(typeof api.bulkRefetchMetadata).toBe('function');
      expect(typeof api.toggleEditorsPick).toBe('function');
      expect(typeof api.updateFind).toBe('function');
      expect(typeof api.deleteFind).toBe('function');
      expect(api.pendingFinds).toBeDefined();
      expect(api.allFinds).toBeDefined();
      expect(api.loading).toBeDefined();
    });

    it('shares state across instances via useState keys', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const a = useExternalListingAdmin();
      const b = useExternalListingAdmin();

      a.pendingFinds.value = [createMockExternalListing({ id: 'find-1' })];

      expect(b.pendingFinds.value.map((f) => f.id)).toEqual(['find-1']);
    });
  });

  // -------------------------------------------------------------------------
  // fetchPending
  // -------------------------------------------------------------------------
  describe('fetchPending', () => {
    it('queries external_listings filtered by status=pending, ordered by created_at desc', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const pending = [createMockExternalListing({ id: 'find-1' }), createMockExternalListing({ id: 'find-2' })];
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: pending, error: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchPending, pendingFinds } = useExternalListingAdmin();

      await fetchPending();

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(pendingFinds.value).toEqual(pending);
    });

    it('selects the joined submitter profile graph', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchPending } = useExternalListingAdmin();

      await fetchPending();

      const selectArg = mockSupabase._mockSelect.mock.calls[0][0] as string;
      expect(selectArg).toContain('profiles!external_listings_submitted_by_fkey');
      expect(selectArg).toContain('display_name');
      expect(selectArg).toContain('avatar_url');
    });

    it('coerces null data to an empty array', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: null, error: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchPending, pendingFinds } = useExternalListingAdmin();

      pendingFinds.value = [createMockExternalListing()];
      await fetchPending();

      expect(pendingFinds.value).toEqual([]);
    });

    it('shows an error toast and logs on failure (without throwing)', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') });

      const useExternalListingAdmin = await loadComposable();
      const { fetchPending } = useExternalListingAdmin();

      await expect(fetchPending()).resolves.toBeUndefined();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load pending finds',
        color: 'error',
      });
      expect(console.error).toHaveBeenCalled();
    });

    it('resets loading to false after both success and failure', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: [], error: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchPending, loading } = useExternalListingAdmin();

      expect(loading.value).toBe(false);
      await fetchPending();
      expect(loading.value).toBe(false);

      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: null, error: new Error('boom') });
      await fetchPending();
      expect(loading.value).toBe(false);
    });

    it('works for anonymous callers (no auth gate)', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const pending = [createMockExternalListing({ id: 'find-1' })];
      mockSupabase._queryBuilder.order = vi.fn().mockResolvedValue({ data: pending, error: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchPending, pendingFinds } = useExternalListingAdmin();

      await fetchPending();

      expect(pendingFinds.value).toEqual(pending);
    });
  });

  // -------------------------------------------------------------------------
  // fetchAll
  // -------------------------------------------------------------------------
  describe('fetchAll', () => {
    it('uses default pagination (page 1, limit 20 => range 0..19) and exact count', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const finds = [createMockExternalListing({ id: 'find-1' })];
      mockSupabase._queryBuilder.range = vi.fn().mockResolvedValue({ data: finds, error: null, count: 1 });

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll, allFinds } = useExternalListingAdmin();

      const result = await fetchAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(expect.any(String), { count: 'exact' });
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabase._queryBuilder.range).toHaveBeenCalledWith(0, 19);
      expect(allFinds.value).toEqual(finds);
      expect(result).toEqual({ finds, total: 1 });
    });

    it('computes the range from page and limit', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll } = useExternalListingAdmin();

      // page 3, limit 10 => start (3-1)*10 = 20, end 20+10-1 = 29
      await fetchAll({ page: 3, limit: 10 });

      expect(mockSupabase._queryBuilder.range).toHaveBeenCalledWith(20, 29);
    });

    it('applies the status filter when provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      // status filter is appended via `query = query.eq(...)` AFTER `.range()`,
      // so range must stay chainable; the awaited result comes from `.then`.
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll } = useExternalListingAdmin();

      await fetchAll({ status: 'approved' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('applies the sourceSite filter when provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null, count: 0 }));

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll } = useExternalListingAdmin();

      await fetchAll({ sourceSite: 'bat' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('source_site', 'bat');
    });

    it('does not apply status/source filters when none are provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll } = useExternalListingAdmin();

      await fetchAll();

      expect(mockSupabase._queryBuilder.eq).not.toHaveBeenCalled();
    });

    it('coerces null data/count to empty array and 0', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.range = vi.fn().mockResolvedValue({ data: null, error: null, count: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll, allFinds } = useExternalListingAdmin();

      const result = await fetchAll();

      expect(allFinds.value).toEqual([]);
      expect(result).toEqual({ finds: [], total: 0 });
    });

    it('returns { finds: [], total: 0 }, shows error toast on failure', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.range = vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error('Database error'), count: null });

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll } = useExternalListingAdmin();

      const result = await fetchAll();

      expect(result).toEqual({ finds: [], total: 0 });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load finds',
        color: 'error',
      });
      expect(console.error).toHaveBeenCalled();
    });

    it('resets loading to false after the query', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });

      const useExternalListingAdmin = await loadComposable();
      const { fetchAll, loading } = useExternalListingAdmin();

      await fetchAll();
      expect(loading.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // approve
  // -------------------------------------------------------------------------
  describe('approve', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { approve } = useExternalListingAdmin();

      await expect(approve('find-123')).rejects.toThrow('Not authenticated');
    });

    it('updates status=approved with a published_at timestamp, filtered by id', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', published_at: expect.any(String) })
      );
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'find-123');
    });

    it('includes editor commentary and editors pick when provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123', 'Great find!', true);

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', editor_commentary: 'Great find!', is_editors_pick: true })
      );
    });

    it('omits commentary/pick keys entirely when undefined', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123');

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('editor_commentary');
      expect(updateArg).not.toHaveProperty('is_editors_pick');
    });

    it('includes an empty-string commentary (undefined check, not truthiness)', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123', '', false);

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ editor_commentary: '', is_editors_pick: false })
      );
    });

    it('removes the find from the pending list after approval', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [
        createMockExternalListing({ id: 'find-123' }),
        createMockExternalListing({ id: 'find-456' }),
      ];

      await approve('find-123');

      expect(pendingFinds.value.map((f) => f.id)).toEqual(['find-456']);
    });

    it('captures find_approved analytics and shows a success toast', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123', undefined, true);

      expect(mockCapture).toHaveBeenCalledWith('find_approved', { id: 'find-123', is_editors_pick: true });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Find Approved',
        description: 'The find has been approved and is now visible to the community.',
        color: 'success',
      });
    });

    it('defaults is_editors_pick to false in analytics when not provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123');

      expect(mockCapture).toHaveBeenCalledWith('find_approved', { id: 'find-123', is_editors_pick: false });
    });

    it('shows an error toast and does not prune/capture on update error', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: new Error('Update failed') }));

      const useExternalListingAdmin = await loadComposable();
      const { approve, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await approve('find-123');

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to approve find',
        color: 'error',
      });
      // not pruned — error thrown before the filter
      expect(pendingFinds.value.map((f) => f.id)).toEqual(['find-123']);
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // reject
  // -------------------------------------------------------------------------
  describe('reject', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { reject } = useExternalListingAdmin();

      await expect(reject('find-123')).rejects.toThrow('Not authenticated');
    });

    it('updates status=rejected with admin_notes when a reason is given', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { reject, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await reject('find-123', 'Not a Classic Mini');

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ status: 'rejected', admin_notes: 'Not a Classic Mini' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'find-123');
    });

    it('omits admin_notes when no reason is provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { reject, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await reject('find-123');

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ status: 'rejected' });
    });

    it('removes the find from the pending list after rejection', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { reject, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [
        createMockExternalListing({ id: 'find-123' }),
        createMockExternalListing({ id: 'find-456' }),
      ];

      await reject('find-123', 'Off-topic');

      expect(pendingFinds.value.map((f) => f.id)).toEqual(['find-456']);
    });

    it('captures find_rejected analytics and shows a warning toast', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { reject, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await reject('find-123', 'Spam');

      expect(mockCapture).toHaveBeenCalledWith('find_rejected', { id: 'find-123', reason: 'Spam' });
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Find Rejected',
        description: 'The find has been rejected.',
        color: 'warning',
      });
    });

    it('passes reason=null to analytics when no reason is provided', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { reject, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await reject('find-123');

      expect(mockCapture).toHaveBeenCalledWith('find_rejected', { id: 'find-123', reason: null });
    });

    it('shows an error toast and does not prune/capture on update error', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: new Error('Update failed') }));

      const useExternalListingAdmin = await loadComposable();
      const { reject, pendingFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await reject('find-123', 'Spam');

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to reject find',
        color: 'error',
      });
      expect(pendingFinds.value.map((f) => f.id)).toEqual(['find-123']);
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refetchMetadata
  // -------------------------------------------------------------------------
  describe('refetchMetadata', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      await expect(refetchMetadata('find-123')).rejects.toThrow('Not authenticated');
    });

    it('reads source_url, calls the parse endpoint with it, and updates mapped fields', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      // Read uses .eq().single(); update terminates on .eq() awaited via .then.
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({
        metadata: {
          title: 'New Title',
          description: 'New Desc',
          imageUrl: 'https://example.com/new.jpg',
          sourceSite: 'carsandbids',
          year: 1975,
          model: 'Cooper',
          price: 30000,
          priceLabel: 'Bid to $30,000',
          auctionEndTime: '2026-02-01T00:00:00.000Z',
          category: 'vehicle',
        },
      });

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      const result = await refetchMetadata('find-123');

      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('source_url');
      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/external-listings/parse', {
        method: 'POST',
        body: { url: 'https://example.com/x' },
      });
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata_fetched_at: expect.any(String),
          title: 'New Title',
          og_description: 'New Desc',
          og_image_url: 'https://example.com/new.jpg',
          source_site: 'carsandbids',
          year: 1975,
          model: 'Cooper',
          price: 30000,
          price_label: 'Bid to $30,000',
          auction_end_time: '2026-02-01T00:00:00.000Z',
          category: 'vehicle',
        })
      );
      expect(result).toEqual(expect.objectContaining({ title: 'New Title' }));
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Metadata Refreshed',
        description: 'The listing metadata has been updated from the source.',
        color: 'success',
      });
    });

    it('skips null/missing metadata fields but always sets metadata_fetched_at', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({
        metadata: { title: 'Only Title', description: null, year: null, price: null, model: '' },
      });

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      await refetchMetadata('find-123');

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg).toHaveProperty('metadata_fetched_at');
      expect(updateArg).toHaveProperty('title', 'Only Title');
      expect(updateArg).not.toHaveProperty('og_description');
      expect(updateArg).not.toHaveProperty('year');
      expect(updateArg).not.toHaveProperty('price');
      expect(updateArg).not.toHaveProperty('model');
    });

    it('preserves year/price of 0 (null check, not falsiness)', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({ metadata: { year: 0, price: 0 } });

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      await refetchMetadata('find-123');

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg).toHaveProperty('year', 0);
      expect(updateArg).toHaveProperty('price', 0);
    });

    it('retries the update without source_site on a 23514 CHECK constraint violation', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      // First update await => 23514 error; retry update await => success. Both
      // updates terminate on .eq() awaited via the shared `.then`, so vary by
      // call count.
      let updateCalls = 0;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => {
        updateCalls += 1;
        return resolve(updateCalls === 1 ? { error: { code: '23514' } } : { error: null });
      });
      mockFetch.mockResolvedValue({ metadata: { title: 'T', sourceSite: 'copart' } });

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      const result = await refetchMetadata('find-123');

      // two update calls: first with source_site, retry without it
      expect(mockSupabase._mockUpdate).toHaveBeenCalledTimes(2);
      const firstUpdate = mockSupabase._mockUpdate.mock.calls[0][0];
      const retryUpdate = mockSupabase._mockUpdate.mock.calls[1][0];
      expect(firstUpdate).toHaveProperty('source_site', 'copart');
      expect(retryUpdate).not.toHaveProperty('source_site');
      expect(retryUpdate).toHaveProperty('title', 'T');
      // retry succeeded -> metadata returned, success toast
      expect(result).toEqual(expect.objectContaining({ title: 'T' }));
      expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }));
    });

    it('returns null and shows error toast when the source_url fetch fails', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: new Error('not found') });

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      const result = await refetchMetadata('find-123');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to refetch metadata from source',
        color: 'error',
      });
    });

    it('returns null and shows error toast when the parse endpoint throws', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockFetch.mockRejectedValue(new Error('parse failed'));

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      const result = await refetchMetadata('find-123');

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }));
    });

    it('returns null and shows error toast when the (non-23514) update fails', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: { code: '500' } }));
      mockFetch.mockResolvedValue({ metadata: { title: 'T' } });

      const useExternalListingAdmin = await loadComposable();
      const { refetchMetadata } = useExternalListingAdmin();

      const result = await refetchMetadata('find-123');

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }));
    });
  });

  // -------------------------------------------------------------------------
  // bulkRefetchMetadata
  // -------------------------------------------------------------------------
  describe('bulkRefetchMetadata', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata } = useExternalListingAdmin();

      await expect(bulkRefetchMetadata(['a', 'b'])).rejects.toThrow('Not authenticated');
    });

    it('processes every id sequentially and tallies successes', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      // refetchMetadata succeeds: single() returns source_url, eq() update ok, parse ok
      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({ metadata: { title: 'T' } });

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata } = useExternalListingAdmin();

      const result = await bulkRefetchMetadata(['a', 'b', 'c']);

      expect(result).toEqual({ succeeded: 3, failed: 0 });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('counts a returned-null refetch as a success (refetchMetadata swallows errors)', async () => {
      // refetchMetadata never throws — it returns null on failure — so the
      // bulk try/catch only catches if refetch itself throws. A failed parse
      // therefore still increments `succeeded`. Documents real behavior.
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: new Error('not found') });

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata } = useExternalListingAdmin();

      const result = await bulkRefetchMetadata(['a', 'b']);

      expect(result).toEqual({ succeeded: 2, failed: 0 });
    });

    it('reports the progress callback before each id and once at completion', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({ metadata: { title: 'T' } });

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata, allFinds } = useExternalListingAdmin();
      allFinds.value = [
        createMockExternalListing({ id: 'a', title: 'Find A' }),
        createMockExternalListing({ id: 'b', title: 'Find B' }),
      ];

      const onProgress = vi.fn();
      await bulkRefetchMetadata(['a', 'b'], onProgress);

      // per-id before-calls carry the resolved title from allFinds
      expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2, 'Find A');
      expect(onProgress).toHaveBeenNthCalledWith(2, 1, 2, 'Find B');
      // final completion call
      expect(onProgress).toHaveBeenNthCalledWith(3, 2, 2, '');
    });

    it("falls back to 'Unknown' title when the id is in neither list", async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({ metadata: { title: 'T' } });

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata } = useExternalListingAdmin();

      const onProgress = vi.fn();
      await bulkRefetchMetadata(['missing'], onProgress);

      expect(onProgress).toHaveBeenNthCalledWith(1, 0, 1, 'Unknown');
    });

    it('shows a success toast when nothing failed', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { source_url: 'https://example.com/x' }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ error: null }));
      mockFetch.mockResolvedValue({ metadata: { title: 'T' } });

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata } = useExternalListingAdmin();

      await bulkRefetchMetadata(['a']);

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Bulk Refresh Complete',
        description: '1 refreshed, 0 failed out of 1 finds.',
        color: 'success',
      });
    });

    it('handles an empty id list (0/0) with a success toast', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { bulkRefetchMetadata } = useExternalListingAdmin();

      const onProgress = vi.fn();
      const result = await bulkRefetchMetadata([], onProgress);

      expect(result).toEqual({ succeeded: 0, failed: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(0, 0, '');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Bulk Refresh Complete',
        description: '0 refreshed, 0 failed out of 0 finds.',
        color: 'success',
      });
    });
  });

  // -------------------------------------------------------------------------
  // toggleEditorsPick
  // -------------------------------------------------------------------------
  describe('toggleEditorsPick', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { toggleEditorsPick } = useExternalListingAdmin();

      await expect(toggleEditorsPick('find-123')).rejects.toThrow('Not authenticated');
    });

    it('flips false -> true, persists, and updates both local lists', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { is_editors_pick: false }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { toggleEditorsPick, pendingFinds, allFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123', is_editors_pick: false })];
      allFinds.value = [createMockExternalListing({ id: 'find-123', is_editors_pick: false })];

      await toggleEditorsPick('find-123');

      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('is_editors_pick');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ is_editors_pick: true });
      expect(pendingFinds.value[0].is_editors_pick).toBe(true);
      expect(allFinds.value[0].is_editors_pick).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: "Editor's Pick Set",
        description: "This find is now highlighted as an editor's pick.",
        color: 'success',
      });
    });

    it('flips true -> false and shows the removed toast', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { is_editors_pick: true }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { toggleEditorsPick, allFinds } = useExternalListingAdmin();
      allFinds.value = [createMockExternalListing({ id: 'find-123', is_editors_pick: true })];

      await toggleEditorsPick('find-123');

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ is_editors_pick: false });
      expect(allFinds.value[0].is_editors_pick).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: "Editor's Pick Removed",
        description: "This find is no longer an editor's pick.",
        color: 'success',
      });
    });

    it('leaves other finds untouched in the local lists', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { is_editors_pick: false }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { toggleEditorsPick, allFinds } = useExternalListingAdmin();
      allFinds.value = [
        createMockExternalListing({ id: 'find-123', is_editors_pick: false }),
        createMockExternalListing({ id: 'find-456', is_editors_pick: false }),
      ];

      await toggleEditorsPick('find-123');

      expect(allFinds.value.find((f) => f.id === 'find-456')!.is_editors_pick).toBe(false);
    });

    it('shows an error toast and does not mutate state when the read fails', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: new Error('Fetch error') });

      const useExternalListingAdmin = await loadComposable();
      const { toggleEditorsPick, allFinds } = useExternalListingAdmin();
      allFinds.value = [createMockExternalListing({ id: 'find-123', is_editors_pick: false })];

      await toggleEditorsPick('find-123');

      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
      expect(allFinds.value[0].is_editors_pick).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: "Failed to update editor's pick status",
        color: 'error',
      });
    });

    it('shows an error toast when the persisting update fails', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { is_editors_pick: false }, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: new Error('Update failed') }));

      const useExternalListingAdmin = await loadComposable();
      const { toggleEditorsPick, allFinds } = useExternalListingAdmin();
      allFinds.value = [createMockExternalListing({ id: 'find-123', is_editors_pick: false })];

      await toggleEditorsPick('find-123');

      // update threw before local mutation
      expect(allFinds.value[0].is_editors_pick).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: "Failed to update editor's pick status",
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateFind
  // -------------------------------------------------------------------------
  describe('updateFind', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { updateFind } = useExternalListingAdmin();

      await expect(updateFind('find-123', { title: 'X' })).rejects.toThrow('Not authenticated');
    });

    it('updates only the provided fields filtered by id', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { updateFind } = useExternalListingAdmin();

      await updateFind('find-123', { title: 'Updated', price: 1000 });

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ title: 'Updated', price: 1000 });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'find-123');
    });

    it('merges the fields into matching finds in both local lists', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { updateFind, pendingFinds, allFinds } = useExternalListingAdmin();
      pendingFinds.value = [createMockExternalListing({ id: 'find-123', title: 'Old' })];
      allFinds.value = [createMockExternalListing({ id: 'find-123', title: 'Old' })];

      await updateFind('find-123', { title: 'New' });

      expect(pendingFinds.value[0].title).toBe('New');
      expect(allFinds.value[0].title).toBe('New');
    });

    it('shows a success toast on update', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useExternalListingAdmin = await loadComposable();
      const { updateFind } = useExternalListingAdmin();

      await updateFind('find-123', { title: 'New' });

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Find Updated',
        description: 'The find has been updated successfully.',
        color: 'success',
      });
    });

    it('shows an error toast and does not mutate local state on error', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: new Error('Update failed') }));

      const useExternalListingAdmin = await loadComposable();
      const { updateFind, allFinds } = useExternalListingAdmin();
      allFinds.value = [createMockExternalListing({ id: 'find-123', title: 'Old' })];

      await updateFind('find-123', { title: 'New' });

      expect(allFinds.value[0].title).toBe('Old');
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to update find',
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // deleteFind
  // -------------------------------------------------------------------------
  describe('deleteFind', () => {
    it('throws when anonymous', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const useExternalListingAdmin = await loadComposable();
      const { deleteFind } = useExternalListingAdmin();

      await expect(deleteFind('find-123')).rejects.toThrow('Not authenticated');
    });

    it('calls the DELETE API with the bearer token from the session', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockFetch.mockResolvedValue(undefined);

      const useExternalListingAdmin = await loadComposable();
      const { deleteFind } = useExternalListingAdmin();

      await deleteFind('find-123');

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/external-listings/find-123', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-access-token' },
      });
    });

    it('sends empty headers when there is no session token', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      mockFetch.mockResolvedValue(undefined);

      const useExternalListingAdmin = await loadComposable();
      const { deleteFind } = useExternalListingAdmin();

      await deleteFind('find-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/exchange/external-listings/find-123', {
        method: 'DELETE',
        headers: {},
      });
    });

    it('prunes the find from both local lists and shows a success toast', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockFetch.mockResolvedValue(undefined);

      const useExternalListingAdmin = await loadComposable();
      const { deleteFind, pendingFinds, allFinds } = useExternalListingAdmin();
      pendingFinds.value = [
        createMockExternalListing({ id: 'find-123' }),
        createMockExternalListing({ id: 'find-456' }),
      ];
      allFinds.value = [
        createMockExternalListing({ id: 'find-123' }),
        createMockExternalListing({ id: 'find-789' }),
      ];

      await deleteFind('find-123');

      expect(pendingFinds.value.map((f) => f.id)).toEqual(['find-456']);
      expect(allFinds.value.map((f) => f.id)).toEqual(['find-789']);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Find Deleted',
        description: 'The find has been deleted.',
        color: 'success',
      });
    });

    it('propagates API errors (no internal catch) and leaves state intact', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockFetch.mockRejectedValue(new Error('Delete failed'));

      const useExternalListingAdmin = await loadComposable();
      const { deleteFind, allFinds } = useExternalListingAdmin();
      allFinds.value = [createMockExternalListing({ id: 'find-123' })];

      await expect(deleteFind('find-123')).rejects.toThrow('Delete failed');
      expect(allFinds.value.map((f) => f.id)).toEqual(['find-123']);
      expect(mockToast.add).not.toHaveBeenCalled();
    });
  });
});
