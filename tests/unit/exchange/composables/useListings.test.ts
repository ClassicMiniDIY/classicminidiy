import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed } from 'vue';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const mockListingWithPhotos = {
  id: 'test-listing-id',
  user_id: 'test-user-id',
  title: '1965 Austin Mini Cooper S',
  slug: '1965-austin-mini-cooper-s',
  status: 'active',
  price: 42000,
  year: 1965,
  model: 'Cooper S',
  condition: 'excellent',
  created_at: new Date().toISOString(),
  listing_photos: [
    {
      id: 'photo-1',
      storage_path: 'user-id/listing-id/photo1.jpg',
      display_order: 0,
      category: 'body',
      caption: 'Front view',
      is_primary: true,
    },
    {
      id: 'photo-2',
      storage_path: 'user-id/listing-id/photo2.jpg',
      display_order: 1,
      category: 'engine',
      caption: 'Engine bay',
      is_primary: false,
    },
  ],
  profiles: {
    id: 'test-user-id',
    display_name: 'Test User',
    username: 'testuser',
    location: 'London, UK',
    avatar_url: 'https://example.com/avatar.jpg',
  },
};

const mockListings = [
  mockListingWithPhotos,
  { ...mockListingWithPhotos, id: 'listing-2', title: '1967 Morris Mini Cooper', model: 'Cooper', year: 1967, price: 35000 },
  { ...mockListingWithPhotos, id: 'listing-3', title: '1972 Innocenti Mini', model: 'Innocenti', year: 1972, price: 28000, condition: 'good' },
];

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockCapture: ReturnType<typeof vi.fn>;
let mockLoadVisibility: ReturnType<typeof vi.fn>;
let activeStatusesRef: ReturnType<typeof computed<string[]>>;

// Drive a query builder that resolves to a list result (thenable).
const resolveListWith = (result: { data: any; error: any }) => {
  mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve(result));
};

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
  // The shared builder lacks gte/lte/or that this composable chains; add them
  // as chainable spies (returning the builder) without touching mockSupabase.ts.
  mockSupabase._queryBuilder.gte = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.lte = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.or = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockCapture = vi.fn();
  mockLoadVisibility = vi.fn().mockResolvedValue(undefined);
  activeStatusesRef = computed(() => ['active', 'example_free', 'example_paid']);

  // setupGlobalMocks stubs useAuth + useSupabase; we override useSupabase to
  // our handle-rich client and (per test) useAuth for anon vs authed.
  setupGlobalMocks({ user: createMockUser(), supabase: mockSupabase });

  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));

  // useExampleListings + applyPhotoOrdering are Nuxt auto-imports — not present
  // in vitest.setup globals, so the composable resolves them off globalThis.
  vi.stubGlobal('useExampleListings', () => ({
    loadVisibility: mockLoadVisibility,
    activeStatuses: activeStatusesRef,
    showExamples: ref(true),
    setExampleVisibility: vi.fn(),
  }));
  // Pass-through that still records the .order() calls on the builder so the
  // referencedTable ordering can be asserted.
  vi.stubGlobal('applyPhotoOrdering', (query: any) =>
    query
      .order('is_primary', { referencedTable: 'listing_photos', ascending: false })
      .order('display_order', { referencedTable: 'listing_photos', ascending: true })
  );
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useListings', () => {
  // -------------------------------------------------------------------------
  // fetchListings()
  // -------------------------------------------------------------------------
  describe('fetchListings()', () => {
    it('fetches active + example statuses by default (loads visibility first)', async () => {
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchListings();

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLoadVisibility).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.in).toHaveBeenCalledWith('status', ['active', 'example_free', 'example_paid']);
      expect(result).toEqual(mockListings);
    });

    it('applies referencedTable photo ordering (is_primary desc, display_order asc)', async () => {
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings();

      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('is_primary', {
        referencedTable: 'listing_photos',
        ascending: false,
      });
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('display_order', {
        referencedTable: 'listing_photos',
        ascending: true,
      });
    });

    it('uses the status filter and skips example-visibility loading when status provided', async () => {
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ status: 'draft' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'draft');
      expect(mockSupabase._queryBuilder.in).not.toHaveBeenCalled();
      expect(mockLoadVisibility).not.toHaveBeenCalled();
    });

    it('honors the example-visibility setting (active only when examples hidden)', async () => {
      activeStatusesRef = computed(() => ['active']);
      vi.stubGlobal('useExampleListings', () => ({
        loadVisibility: mockLoadVisibility,
        activeStatuses: activeStatusesRef,
        showExamples: ref(false),
        setExampleVisibility: vi.fn(),
      }));
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings();

      expect(mockSupabase._queryBuilder.in).toHaveBeenCalledWith('status', ['active']);
    });

    it('applies min_price (gte price)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ min_price: 30000 });
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('price', 30000);
    });

    it('applies max_price (lte price)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ max_price: 50000 });
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('price', 50000);
    });

    it('applies year_min (gte year)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ year_min: 1965 });
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('year', 1965);
    });

    it('applies year_max (lte year)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ year_max: 1970 });
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('year', 1970);
    });

    it('applies model (eq model)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ model: 'Cooper S' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('model', 'Cooper S');
    });

    it('applies condition (eq condition)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ condition: 'excellent' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('condition', 'excellent');
    });

    it('applies search as an OR across title and description', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ search: 'Cooper' });
      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith(
        'title.ilike.%Cooper%,description.ilike.%Cooper%'
      );
    });

    it('applies multiple filters together', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({
        status: 'active',
        min_price: 25000,
        max_price: 50000,
        year_min: 1960,
        year_max: 1970,
        model: 'Cooper S',
        condition: 'excellent',
      });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('price', 25000);
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('price', 50000);
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('year', 1960);
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('year', 1970);
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('model', 'Cooper S');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('condition', 'excellent');
    });

    it('treats falsy numeric filters as absent (no gte/lte calls)', async () => {
      resolveListWith({ data: mockListings, error: null });
      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListings({ min_price: 0, max_price: 0, year_min: 0, year_max: 0 });

      expect(mockSupabase._queryBuilder.gte).not.toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.lte).not.toHaveBeenCalled();
    });

    it('works for anonymous users (no auth required)', async () => {
      stubAuth(null);
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchListings();

      expect(result).toEqual(mockListings);
    });

    it('returns an empty array when no rows match', async () => {
      resolveListWith({ data: [], error: null });
      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchListings();
      expect(result).toEqual([]);
    });

    it('throws when the query errors', async () => {
      const supabaseError = { code: 'PGRST301', message: 'JWT expired' };
      resolveListWith({ data: null, error: supabaseError });
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().fetchListings()).rejects.toEqual(supabaseError);
    });
  });

  // -------------------------------------------------------------------------
  // fetchListingBySlug()
  // -------------------------------------------------------------------------
  describe('fetchListingBySlug()', () => {
    it('fetches a single listing by slug', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchListingBySlug('1965-austin-mini-cooper-s');

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('slug', '1965-austin-mini-cooper-s');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockListingWithPhotos);
    });

    it('fire-and-forget increments view count via RPC after fetching (client only)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchListingBySlug('1965-austin-mini-cooper-s');

      await new Promise((r) => setTimeout(r, 0));

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_listing_views', {
        listing_id_param: mockListingWithPhotos.id,
      });
    });

    it('does not throw when the view-count RPC fails (logs only)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc boom' } });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchListingBySlug('1965-austin-mini-cooper-s');
      await new Promise((r) => setTimeout(r, 0));

      expect(result).toEqual(mockListingWithPhotos);
      expect(errSpy).toHaveBeenCalledWith('Failed to increment view count:', { message: 'rpc boom' });
      errSpy.mockRestore();
    });

    it('throws when the listing is not found', async () => {
      const notFound = { code: 'PGRST116', message: 'Row not found' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: notFound });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().fetchListingBySlug('nope')).rejects.toEqual(notFound);
    });

    it('skips the view-count RPC when data is falsy (no error)', async () => {
      // data null + error null => no throw, but the `data &&` guard short-circuits
      // so increment_listing_views must NOT fire (line 163 false branch).
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchListingBySlug('1965-austin-mini-cooper-s');
      await new Promise((r) => setTimeout(r, 0));

      expect(result).toBeNull();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getListingById()
  // -------------------------------------------------------------------------
  describe('getListingById()', () => {
    it('fetches a single listing by id', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().getListingById('test-listing-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'test-listing-id');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockListingWithPhotos);
    });

    it('throws when the listing is not found by id', async () => {
      const notFound = { code: 'PGRST116', message: 'Row not found' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: notFound });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().getListingById('nope')).rejects.toEqual(notFound);
    });
  });

  // -------------------------------------------------------------------------
  // fetchUserListings()
  // -------------------------------------------------------------------------
  describe('fetchUserListings()', () => {
    it('fetches listings for the authenticated user when no id provided', async () => {
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchUserListings();

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockListings);
    });

    it('fetches listings for an explicit user id', async () => {
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().fetchUserListings('other-user-id');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'other-user-id');
    });

    it('throws when no user and no id provided', async () => {
      stubAuth(null);
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().fetchUserListings()).rejects.toThrow('User not authenticated');
    });

    it('still works for an explicit id when anonymous', async () => {
      stubAuth(null);
      resolveListWith({ data: mockListings, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().fetchUserListings('public-user-id');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'public-user-id');
      expect(result).toEqual(mockListings);
    });

    it('throws when the query errors', async () => {
      const supabaseError = { message: 'boom' };
      resolveListWith({ data: null, error: supabaseError });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().fetchUserListings()).rejects.toEqual(supabaseError);
    });
  });

  // -------------------------------------------------------------------------
  // createListing()
  // -------------------------------------------------------------------------
  describe('createListing()', () => {
    const newListingData = {
      title: '1968 Mini Cooper S',
      description: 'Fully restored classic',
      year: 1968,
      model: 'Cooper S',
      condition: 'excellent',
      price: 55000,
      status: 'draft',
    };

    it('inserts with user_id and a generated slug, returns the row', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { ...mockListingWithPhotos, ...newListingData }, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().createListing(newListingData as any);

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.user_id).toBe('test-user-id');
      expect(insertArg.title).toBe(newListingData.title);
      expect(insertArg.slug).toMatch(/^1968-mini-cooper-s-[a-z0-9]+$/);
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toMatchObject(newListingData);
    });

    it('throws when the user is not authenticated', async () => {
      stubAuth(null);
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().createListing(newListingData as any)).rejects.toThrow('User not authenticated');
    });

    it('throws when the insert errors', async () => {
      const supabaseError = { message: 'Insert failed' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: supabaseError });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().createListing(newListingData as any)).rejects.toEqual(supabaseError);
    });

    it('slugifies special characters and lower-cases the title', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().createListing({ ...newListingData, title: "Bob's 1275 GT!!!" } as any);

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.slug).toMatch(/^bob-s-1275-gt-[a-z0-9]+$/);
    });
  });

  // -------------------------------------------------------------------------
  // updateListing()
  // -------------------------------------------------------------------------
  describe('updateListing()', () => {
    const updates = { title: 'Updated 1968 Mini Cooper S', price: 60000 };

    it('updates filtered by id AND user_id (ownership guard) and returns the row', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { ...mockListingWithPhotos, ...updates }, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      const result = await useListings().updateListing('test-listing-id', { ...updates });

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._mockUpdate).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'test-listing-id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(result).toMatchObject(updates);
    });

    it('regenerates the slug when the title changes', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().updateListing('test-listing-id', { title: 'New Title Here' });

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg.slug).toMatch(/^new-title-here-[a-z0-9]+$/);
    });

    it('does not regenerate the slug when the title is unchanged', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().updateListing('test-listing-id', { price: 70000 });

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg.slug).toBeUndefined();
    });

    it('captures the listing_edited analytics event with changed field keys', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().updateListing('test-listing-id', { ...updates });

      expect(mockCapture).toHaveBeenCalledWith('listing_edited', {
        listing_id: 'test-listing-id',
        fields_changed: expect.arrayContaining(['title', 'price']),
      });
    });

    it('throws when the user is not authenticated', async () => {
      stubAuth(null);
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().updateListing('test-listing-id', { ...updates })).rejects.toThrow('User not authenticated');
    });

    it('throws when the update errors and does not capture analytics', async () => {
      const supabaseError = { message: 'Update failed' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: supabaseError });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().updateListing('test-listing-id', { ...updates })).rejects.toEqual(supabaseError);
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // deleteListing()
  // -------------------------------------------------------------------------
  describe('deleteListing()', () => {
    it('deletes the listing filtered by id AND user_id and cleans up storage files', async () => {
      const photos = [{ storage_path: 'p1.jpg' }, { storage_path: 'p2.jpg' }];
      // first .from('listing_photos').select().eq() resolves to the photo list
      mockSupabase._queryBuilder.eq = vi.fn().mockImplementation(() => mockSupabase._queryBuilder);
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: photos, error: null }));

      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.storage.from = vi.fn(() => ({ remove: mockRemove })) as any;

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().deleteListing('test-listing-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._mockDelete).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'test-listing-id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('listing-photos');
      expect(mockRemove).toHaveBeenCalledWith(['p1.jpg', 'p2.jpg']);
      expect(mockCapture).toHaveBeenCalledWith('listing_deleted', { listing_id: 'test-listing-id' });
    });

    it('skips storage cleanup when the listing has no photos', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));
      const mockRemove = vi.fn();
      mockSupabase.storage.from = vi.fn(() => ({ remove: mockRemove })) as any;

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().deleteListing('test-listing-id');

      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockCapture).toHaveBeenCalledWith('listing_deleted', { listing_id: 'test-listing-id' });
    });

    it('does not throw (only logs) when storage cleanup fails, still captures deletion', async () => {
      const photos = [{ storage_path: 'p1.jpg' }];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: photos, error: null }));
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: { message: 'storage boom' } });
      mockSupabase.storage.from = vi.fn(() => ({ remove: mockRemove })) as any;
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().deleteListing('test-listing-id')).resolves.toBeUndefined();

      expect(errSpy).toHaveBeenCalled();
      expect(mockCapture).toHaveBeenCalledWith('listing_deleted', { listing_id: 'test-listing-id' });
      errSpy.mockRestore();
    });

    it('throws when the user is not authenticated', async () => {
      stubAuth(null);
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().deleteListing('test-listing-id')).rejects.toThrow('User not authenticated');
    });

    it('throws when the delete errors and does not capture analytics', async () => {
      const supabaseError = { message: 'Delete failed' };
      // photo lookup resolves empty; the delete chain rejects via .then on the builder.
      let call = 0;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => {
        call += 1;
        // photo select returns [], delete returns the error
        return resolve(call === 1 ? { data: [], error: null } : { error: supabaseError });
      });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().deleteListing('test-listing-id')).rejects.toEqual(supabaseError);
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // publishListing()
  // -------------------------------------------------------------------------
  describe('publishListing()', () => {
    it('updates status to active and sets published_at (delegates to updateListing)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({
        data: { ...mockListingWithPhotos, status: 'active' },
        error: null,
      });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().publishListing('test-listing-id');

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg.status).toBe('active');
      expect(updateArg.published_at).toBeDefined();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });

    it('throws when the user is not authenticated', async () => {
      stubAuth(null);
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().publishListing('test-listing-id')).rejects.toThrow('User not authenticated');
    });
  });

  // -------------------------------------------------------------------------
  // getPhotoUrl()
  // -------------------------------------------------------------------------
  describe('getPhotoUrl()', () => {
    it('returns the public URL for a storage path', async () => {
      const expectedUrl = 'https://example.com/storage/v1/listing-photos/test-path';
      const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: expectedUrl } });
      mockSupabase.storage.from = vi.fn(() => ({ getPublicUrl })) as any;

      const { useListings } = await import('~/app/composables/useListings');
      const result = useListings().getPhotoUrl('test-path');

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('listing-photos');
      expect(getPublicUrl).toHaveBeenCalledWith('test-path');
      expect(result).toBe(expectedUrl);
    });
  });

  // -------------------------------------------------------------------------
  // getPrimaryPhoto()
  // -------------------------------------------------------------------------
  describe('getPrimaryPhoto()', () => {
    it('returns the URL of the photo flagged is_primary', async () => {
      const getPublicUrl = vi.fn((p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }));
      mockSupabase.storage.from = vi.fn(() => ({ getPublicUrl })) as any;

      const { useListings } = await import('~/app/composables/useListings');
      const url = useListings().getPrimaryPhoto(mockListingWithPhotos as any);

      // is_primary === true is photo1
      expect(getPublicUrl).toHaveBeenCalledWith('user-id/listing-id/photo1.jpg');
      expect(url).toBe('https://cdn/user-id/listing-id/photo1.jpg');
    });

    it('falls back to the first photo when none is flagged primary', async () => {
      const getPublicUrl = vi.fn((p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }));
      mockSupabase.storage.from = vi.fn(() => ({ getPublicUrl })) as any;
      const listing = {
        ...mockListingWithPhotos,
        listing_photos: mockListingWithPhotos.listing_photos.map((p) => ({ ...p, is_primary: false })),
      };

      const { useListings } = await import('~/app/composables/useListings');
      const url = useListings().getPrimaryPhoto(listing as any);

      expect(getPublicUrl).toHaveBeenCalledWith('user-id/listing-id/photo1.jpg');
      expect(url).toBe('https://cdn/user-id/listing-id/photo1.jpg');
    });

    it('returns undefined when there are no photos', async () => {
      const { useListings } = await import('~/app/composables/useListings');
      expect(useListings().getPrimaryPhoto({ ...mockListingWithPhotos, listing_photos: [] } as any)).toBeUndefined();
    });

    it('returns undefined when listing_photos is missing', async () => {
      const { useListings } = await import('~/app/composables/useListings');
      expect(useListings().getPrimaryPhoto({ ...mockListingWithPhotos, listing_photos: undefined } as any)).toBeUndefined();
    });

    it('returns undefined when the resolved photo is falsy (no primary, falsy first entry)', async () => {
      // length > 0 passes the guard; find(is_primary) is undefined (the falsy
      // primitive has no truthy is_primary), and [0] is falsy => photo is falsy,
      // so the ternary returns undefined (line 360). A primitive 0 avoids the
      // null-deref the .find() callback would hit on a null/undefined element.
      const getPublicUrl = vi.fn();
      mockSupabase.storage.from = vi.fn(() => ({ getPublicUrl })) as any;

      const { useListings } = await import('~/app/composables/useListings');
      const url = useListings().getPrimaryPhoto({ ...mockListingWithPhotos, listing_photos: [0] } as any);

      expect(url).toBeUndefined();
      expect(getPublicUrl).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // relistListing()
  // -------------------------------------------------------------------------
  describe('relistListing()', () => {
    it('resets sale fields, sets featured_until for paid tier, and updates filtered by ownership', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { ...mockListingWithPhotos, status: 'active' }, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().relistListing('test-listing-id', 'sold', 'paid');

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg.status).toBe('active');
      expect(updateArg.published_at).toBeDefined();
      expect(updateArg.sold_date).toBeNull();
      expect(updateArg.final_price).toBeNull();
      expect(updateArg.tracking_number).toBeNull();
      expect(updateArg.tracking_carrier).toBeNull();
      expect(updateArg.promoted_on_social_at).toBeNull();
      // paid tier => featured_until ~30 days out
      expect(typeof updateArg.featured_until).toBe('string');
      const days = (new Date(updateArg.featured_until).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThan(31);
      expect('price' in updateArg).toBe(false);

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'test-listing-id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });

    it('leaves featured_until null for the free tier', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().relistListing('test-listing-id', 'expired', 'free');

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg.featured_until).toBeNull();
    });

    it('sets the new price when provided', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().relistListing('test-listing-id', 'cancelled', 'free', 12345);

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg.price).toBe(12345);
    });

    it('captures listing_relisted with price_changed reflecting the newPrice arg', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().relistListing('test-listing-id', 'sold', 'paid', 9000);

      expect(mockCapture).toHaveBeenCalledWith('listing_relisted', {
        listing_id: 'test-listing-id',
        previous_status: 'sold',
        tier: 'paid',
        price_changed: true,
      });
    });

    it('reports price_changed false when no newPrice provided', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingWithPhotos, error: null });

      const { useListings } = await import('~/app/composables/useListings');
      await useListings().relistListing('test-listing-id', 'sold', 'free');

      expect(mockCapture).toHaveBeenCalledWith(
        'listing_relisted',
        expect.objectContaining({ price_changed: false })
      );
    });

    it('throws when the user is not authenticated', async () => {
      stubAuth(null);
      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().relistListing('test-listing-id', 'sold', 'paid')).rejects.toThrow('User not authenticated');
    });

    it('throws when the update errors and does not capture analytics', async () => {
      const supabaseError = { message: 'Relist failed' };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: supabaseError });

      const { useListings } = await import('~/app/composables/useListings');
      await expect(useListings().relistListing('test-listing-id', 'sold', 'paid')).rejects.toEqual(supabaseError);
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });
});
