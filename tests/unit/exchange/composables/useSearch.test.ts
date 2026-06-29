import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed, reactive, nextTick } from 'vue';
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
  latitude: 51.5074,
  longitude: -0.1278,
  created_at: new Date().toISOString(),
  listing_photos: [
    {
      id: 'photo-1',
      storage_path: 'user-id/listing-id/photo1.jpg',
      display_order: 0,
      category: 'body',
      is_primary: true,
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
  {
    ...mockListingWithPhotos,
    id: 'listing-2',
    title: '1967 Morris Mini Cooper',
    slug: '1967-morris-mini-cooper',
    model: 'Cooper',
    year: 1967,
    price: 35000,
    latitude: 40.7128,
    longitude: -74.006,
  },
];

// ---------------------------------------------------------------------------
// vue-router mock — useSearch imports useRouter/useRoute directly from
// 'vue-router' (not Nuxt auto-imports), so they must be module-mocked.
// mockRouteQuery is mutable so individual tests can seed URL params before
// importing the composable.
// ---------------------------------------------------------------------------
let mockRouteQuery: Record<string, string> = {};
const mockRouterReplace = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: vi.fn() }),
  useRoute: () => ({ query: mockRouteQuery }),
}));

// @vueuse/core debounce — run synchronously so updateURLParams/performSearch
// fire immediately instead of after the real 500ms window.
vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: any[]) => any) => fn,
}));

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockCapture: ReturnType<typeof vi.fn>;
let mockToastAdd: ReturnType<typeof vi.fn>;
let mockLoadVisibility: ReturnType<typeof vi.fn>;
let activeStatusesRef: ReturnType<typeof computed<string[]>>;
let mockGeocodeLocation: ReturnType<typeof vi.fn>;
let mockCalculateDistance: ReturnType<typeof vi.fn>;

// The query terminal in useSearch is `await query.abortSignal(signal)`, so
// abortSignal must resolve to the { data, error, count } result. The other
// builder methods just need to be chainable spies returning the builder.
const resolveQueryWith = (result: { data: any; error: any; count?: number }) => {
  mockSupabase._queryBuilder.abortSignal = vi.fn().mockResolvedValue({
    data: result.data,
    error: result.error,
    count: result.count ?? result.data?.length ?? 0,
  });
};

const rejectQueryWith = (err: any) => {
  mockSupabase._queryBuilder.abortSignal = vi.fn().mockRejectedValue(err);
};

beforeEach(() => {
  mockRouteQuery = {};
  mockSupabase = createMockSupabaseClient();

  // The shared builder lacks gte/lte/or/not/limit that this composable chains;
  // add them as chainable spies returning the builder (don't touch mockSupabase.ts).
  mockSupabase._queryBuilder.gte = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.lte = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.or = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.not = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.limit = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.ilike = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  // Default terminal resolution; tests override via resolveQueryWith/rejectQueryWith.
  resolveQueryWith({ data: mockListings, error: null, count: 2 });

  mockCapture = vi.fn();
  mockToastAdd = vi.fn();
  mockLoadVisibility = vi.fn().mockResolvedValue(undefined);
  activeStatusesRef = computed(() => ['active', 'example_free', 'example_paid']);
  mockGeocodeLocation = vi.fn();
  mockCalculateDistance = vi.fn();

  // setupGlobalMocks stubs useAuth + useSupabase; override useSupabase with the
  // handle-rich client.
  setupGlobalMocks({ user: createMockUser(), supabase: mockSupabase });

  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  vi.stubGlobal('useToast', () => ({ add: mockToastAdd }));

  // useExampleListings + applyPhotoOrdering + sortExamplesLast + useGeocoding are
  // Nuxt auto-imports — not in vitest.setup globals, so the composable resolves
  // them off globalThis.
  vi.stubGlobal('useExampleListings', () => ({
    loadVisibility: mockLoadVisibility,
    activeStatuses: activeStatusesRef,
    showExamples: ref(true),
    setExampleVisibility: vi.fn(),
  }));
  vi.stubGlobal('sortExamplesLast', <T extends { status: string }>(listings: T[]) => {
    return [...listings].sort((a, b) => {
      const aEx = ['example_free', 'example_paid'].includes(a.status) ? 1 : 0;
      const bEx = ['example_free', 'example_paid'].includes(b.status) ? 1 : 0;
      return aEx - bEx;
    });
  });
  vi.stubGlobal('useGeocoding', () => ({
    geocodeLocation: mockGeocodeLocation,
    calculateDistance: mockCalculateDistance,
    isGeocoding: ref(false),
  }));
  // Pass-through that records the .order() calls on the builder.
  vi.stubGlobal('applyPhotoOrdering', (query: any) =>
    query
      .order('is_primary', { referencedTable: 'listing_photos', ascending: false })
      .order('display_order', { referencedTable: 'listing_photos', ascending: true })
  );

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
});

const importUseSearch = async () => {
  const { useSearch } = await import('~/app/composables/useSearch');
  return useSearch;
};

describe('useSearch', () => {
  // -------------------------------------------------------------------------
  // initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('initializes filter refs empty and sort to newest', async () => {
      const useSearch = await importUseSearch();
      const {
        searchQuery,
        selectedCategory,
        selectedPartsSubcategory,
        selectedYearRange,
        selectedManufacturer,
        selectedModel,
        selectedCondition,
        selectedPriceRange,
        selectedTransmission,
        selectedLocation,
        selectedDistance,
        selectedShippingAvailable,
        selectedShipsInternational,
        selectedFreeShipping,
        sortBy,
        listings,
        loading,
        totalCount,
        currentPage,
        pageSize,
      } = useSearch();

      expect(searchQuery.value).toBe('');
      expect(selectedCategory.value).toBe('');
      expect(selectedPartsSubcategory.value).toBe('');
      expect(selectedYearRange.value).toBe('');
      expect(selectedManufacturer.value).toBe('');
      expect(selectedModel.value).toBe('');
      expect(selectedCondition.value).toBe('');
      expect(selectedPriceRange.value).toBe('');
      expect(selectedTransmission.value).toBe('');
      expect(selectedLocation.value).toBe('');
      expect(selectedDistance.value).toBe('');
      expect(selectedShippingAvailable.value).toBe(false);
      expect(selectedShipsInternational.value).toBe(false);
      expect(selectedFreeShipping.value).toBe(false);
      expect(sortBy.value).toBe('newest');
      expect(listings.value).toEqual([]);
      expect(loading.value).toBe(false);
      expect(totalCount.value).toBe(0);
      expect(currentPage.value).toBe(1);
      expect(pageSize.value).toBe(12);
    });

    it('initializes filters from URL query params', async () => {
      mockRouteQuery = {
        search: 'Cooper',
        category: 'vehicle',
        subcategory: 'engine',
        year: '1960s',
        manufacturer: 'Austin',
        model: 'Cooper S',
        condition: 'excellent',
        price: '30k-50k',
        transmission: 'manual',
        location: 'California',
        distance: '50',
        shipping: 'true',
        international: 'true',
        free_shipping: 'true',
        sort: 'price_asc',
      };

      const useSearch = await importUseSearch();
      const {
        searchQuery,
        selectedCategory,
        selectedPartsSubcategory,
        selectedYearRange,
        selectedManufacturer,
        selectedModel,
        selectedCondition,
        selectedPriceRange,
        selectedTransmission,
        selectedLocation,
        selectedDistance,
        selectedShippingAvailable,
        selectedShipsInternational,
        selectedFreeShipping,
        sortBy,
      } = useSearch();

      expect(searchQuery.value).toBe('Cooper');
      expect(selectedCategory.value).toBe('vehicle');
      expect(selectedPartsSubcategory.value).toBe('engine');
      expect(selectedYearRange.value).toBe('1960s');
      expect(selectedManufacturer.value).toBe('Austin');
      expect(selectedModel.value).toBe('Cooper S');
      expect(selectedCondition.value).toBe('excellent');
      expect(selectedPriceRange.value).toBe('30k-50k');
      expect(selectedTransmission.value).toBe('manual');
      expect(selectedLocation.value).toBe('California');
      expect(selectedDistance.value).toBe('50');
      expect(selectedShippingAvailable.value).toBe(true);
      expect(selectedShipsInternational.value).toBe(true);
      expect(selectedFreeShipping.value).toBe(true);
      expect(sortBy.value).toBe('price_asc');
    });

    it('sanitizes the search query coming from URL params', async () => {
      // Commas/dots stripped to prevent PostgREST filter injection; tags removed.
      mockRouteQuery = { search: 'Cooper, S. <script>' };

      const useSearch = await importUseSearch();
      const { searchQuery } = useSearch();

      // '<', '>', ',', '.' removed; words/spaces/hyphens kept; whitespace normalized.
      expect(searchQuery.value).toBe('Cooper S script');
    });

    it('restores currentPage from the page query param (>1)', async () => {
      mockRouteQuery = { page: '4' };
      const useSearch = await importUseSearch();
      const { currentPage } = useSearch();
      expect(currentPage.value).toBe(4);
    });

    it('defaults currentPage to 1 for missing/invalid/zero page params', async () => {
      mockRouteQuery = { page: '0' };
      let useSearch = await importUseSearch();
      expect(useSearch().currentPage.value).toBe(1);

      vi.resetModules();
      mockRouteQuery = { page: 'abc' };
      useSearch = await importUseSearch();
      expect(useSearch().currentPage.value).toBe(1);

      vi.resetModules();
      mockRouteQuery = {};
      useSearch = await importUseSearch();
      expect(useSearch().currentPage.value).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // buildFilters()
  // -------------------------------------------------------------------------
  describe('buildFilters()', () => {
    it('returns only the default sort when no filters set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters } = useSearch();
      expect(buildFilters()).toEqual({ sort: 'newest' });
    });

    it('includes search when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, searchQuery } = useSearch();
      searchQuery.value = 'Mini Cooper';
      expect(buildFilters().search).toBe('Mini Cooper');
    });

    it('includes listing_category when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedCategory } = useSearch();
      selectedCategory.value = 'vehicle';
      expect(buildFilters().listing_category).toBe('vehicle');
    });

    it('includes parts_subcategory when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedPartsSubcategory } = useSearch();
      selectedPartsSubcategory.value = 'engine';
      expect(buildFilters().parts_subcategory).toBe('engine');
    });

    it('includes condition when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedCondition } = useSearch();
      selectedCondition.value = 'excellent';
      expect(buildFilters().condition).toBe('excellent');
    });

    it('includes manufacturer when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedManufacturer } = useSearch();
      selectedManufacturer.value = 'Austin';
      expect(buildFilters().manufacturer).toBe('Austin');
    });

    it('includes model when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedModel } = useSearch();
      selectedModel.value = 'Cooper S';
      expect(buildFilters().model).toBe('Cooper S');
    });

    it('includes transmission when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedTransmission } = useSearch();
      selectedTransmission.value = 'manual';
      expect(buildFilters().transmission).toBe('manual');
    });

    it('includes location when set', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedLocation } = useSearch();
      selectedLocation.value = 'California';
      expect(buildFilters().location).toBe('California');
    });

    it.each([
      ['1960s', 1959, 1969],
      ['1970s', 1970, 1979],
      ['1980s', 1980, 1989],
      ['1990s', 1990, 2000],
    ])('maps year range %s to %i-%i', async (range, min, max) => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedYearRange } = useSearch();
      selectedYearRange.value = range as string;
      const f = buildFilters();
      expect(f.year_min).toBe(min);
      expect(f.year_max).toBe(max);
    });

    it('does not set year range for an invalid range value', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedYearRange } = useSearch();
      selectedYearRange.value = 'invalid';
      const f = buildFilters();
      expect(f.year_min).toBeUndefined();
      expect(f.year_max).toBeUndefined();
    });

    it('maps "free" price range to min 0 and max 0', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedPriceRange } = useSearch();
      selectedPriceRange.value = 'free';
      const f = buildFilters();
      expect(f.min_price).toBe(0);
      expect(f.max_price).toBe(0);
    });

    it('maps "under-10k" price range to max only', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedPriceRange } = useSearch();
      selectedPriceRange.value = 'under-10k';
      const f = buildFilters();
      expect(f.min_price).toBeUndefined();
      expect(f.max_price).toBe(10000);
    });

    it.each([
      ['10k-20k', 10000, 20000],
      ['20k-30k', 20000, 30000],
      ['30k-50k', 30000, 50000],
    ])('maps "%s" price range to min %i max %i', async (range, min, max) => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedPriceRange } = useSearch();
      selectedPriceRange.value = range as string;
      const f = buildFilters();
      expect(f.min_price).toBe(min);
      expect(f.max_price).toBe(max);
    });

    it('maps "over-50k" price range to min only', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedPriceRange } = useSearch();
      selectedPriceRange.value = 'over-50k';
      const f = buildFilters();
      expect(f.min_price).toBe(50000);
      expect(f.max_price).toBeUndefined();
    });

    it('does not set price range for an invalid range value', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedPriceRange } = useSearch();
      selectedPriceRange.value = 'invalid';
      const f = buildFilters();
      expect(f.min_price).toBeUndefined();
      expect(f.max_price).toBeUndefined();
    });

    it('includes shipping flags only when true', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, selectedShippingAvailable, selectedShipsInternational, selectedFreeShipping } = useSearch();
      selectedShippingAvailable.value = true;
      selectedShipsInternational.value = true;
      selectedFreeShipping.value = true;
      const f = buildFilters();
      expect(f.shipping_available).toBe(true);
      expect(f.ships_international).toBe(true);
      expect(f.free_shipping).toBe(true);
    });

    it('omits shipping flags when false', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters } = useSearch();
      const f = buildFilters();
      expect(f).not.toHaveProperty('shipping_available');
      expect(f).not.toHaveProperty('ships_international');
      expect(f).not.toHaveProperty('free_shipping');
    });

    it('includes the selected sort option', async () => {
      const useSearch = await importUseSearch();
      const { buildFilters, sortBy } = useSearch();
      sortBy.value = 'price_asc';
      expect(buildFilters().sort).toBe('price_asc');
    });
  });

  // -------------------------------------------------------------------------
  // performSearch()
  // -------------------------------------------------------------------------
  describe('performSearch()', () => {
    it('toggles loading true while in flight then false', async () => {
      let resolveQuery!: (v: any) => void;
      mockSupabase._queryBuilder.abortSignal = vi.fn(
        () => new Promise((resolve) => (resolveQuery = resolve))
      );

      const useSearch = await importUseSearch();
      const { performSearch, loading } = useSearch();

      const p = performSearch();
      // loading flips true synchronously; the query stays pending.
      expect(loading.value).toBe(true);

      // Let the awaited loadVisibility() resolve so abortSignal() is reached
      // and resolveQuery is captured, then release the pending query.
      await vi.waitFor(() => expect(resolveQuery).toBeTypeOf('function'));
      expect(loading.value).toBe(true);

      resolveQuery({ data: mockListings, error: null, count: 2 });
      await p;
      expect(loading.value).toBe(false);
    });

    it('loads example visibility then queries listings with active statuses', async () => {
      const useSearch = await importUseSearch();
      await useSearch().performSearch();

      expect(mockLoadVisibility).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._queryBuilder.in).toHaveBeenCalledWith('status', [
        'active',
        'example_free',
        'example_paid',
      ]);
    });

    it('honors example-visibility setting (active only when examples hidden)', async () => {
      activeStatusesRef = computed(() => ['active']);
      vi.stubGlobal('useExampleListings', () => ({
        loadVisibility: mockLoadVisibility,
        activeStatuses: activeStatusesRef,
        showExamples: ref(false),
        setExampleVisibility: vi.fn(),
      }));

      const useSearch = await importUseSearch();
      await useSearch().performSearch();

      expect(mockSupabase._queryBuilder.in).toHaveBeenCalledWith('status', ['active']);
    });

    it('applies range() for standard (non-distance) pagination', async () => {
      const useSearch = await importUseSearch();
      await useSearch().performSearch();
      // page 1, pageSize 12 => range(0, 11)
      expect(mockSupabase._queryBuilder.range).toHaveBeenCalledWith(0, 11);
    });

    it('builds the text search .or() against title and description (sanitized)', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, searchQuery } = useSearch();
      searchQuery.value = 'Cooper';
      await performSearch();
      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith(
        'title.ilike.%Cooper%,description.ilike.%Cooper%'
      );
    });

    it('strips injection characters from the search term before building .or()', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, searchQuery } = useSearch();
      searchQuery.value = 'Cooper,S.';
      await performSearch();
      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith(
        'title.ilike.%CooperS%,description.ilike.%CooperS%'
      );
    });

    it('applies eq filters for category, subcategory, condition, manufacturer, model, transmission', async () => {
      const useSearch = await importUseSearch();
      const s = useSearch();
      s.selectedCategory.value = 'vehicle';
      s.selectedPartsSubcategory.value = 'engine';
      s.selectedCondition.value = 'excellent';
      s.selectedManufacturer.value = 'Austin';
      s.selectedModel.value = 'Cooper S';
      s.selectedTransmission.value = 'manual';
      await s.performSearch();

      const eq = mockSupabase._queryBuilder.eq;
      expect(eq).toHaveBeenCalledWith('listing_category', 'vehicle');
      expect(eq).toHaveBeenCalledWith('parts_subcategory', 'engine');
      expect(eq).toHaveBeenCalledWith('condition', 'excellent');
      expect(eq).toHaveBeenCalledWith('manufacturer', 'Austin');
      expect(eq).toHaveBeenCalledWith('model', 'Cooper S');
      expect(eq).toHaveBeenCalledWith('transmission', 'manual');
    });

    it('applies year_min/year_max via gte/lte from the year range', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, selectedYearRange } = useSearch();
      selectedYearRange.value = '1960s';
      await performSearch();
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('year', 1959);
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('year', 1969);
    });

    it('applies min_price/max_price via gte/lte from the price range', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, selectedPriceRange } = useSearch();
      selectedPriceRange.value = '10k-20k';
      await performSearch();
      expect(mockSupabase._queryBuilder.gte).toHaveBeenCalledWith('price', 10000);
      expect(mockSupabase._queryBuilder.lte).toHaveBeenCalledWith('price', 20000);
    });

    it('applies text location filter with ilike when no distance filter active', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, selectedLocation } = useSearch();
      selectedLocation.value = 'California';
      await performSearch();
      expect(mockSupabase._queryBuilder.ilike).toHaveBeenCalledWith('location', '%California%');
    });

    it('applies shipping_available eq filter', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, selectedShippingAvailable } = useSearch();
      selectedShippingAvailable.value = true;
      await performSearch();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('shipping_available', true);
    });

    it('applies ships_international as an in() over international/specific_countries', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, selectedShipsInternational } = useSearch();
      selectedShipsInternational.value = true;
      await performSearch();
      expect(mockSupabase._queryBuilder.in).toHaveBeenCalledWith('ships_to', [
        'international',
        'specific_countries',
      ]);
    });

    it('applies free_shipping as eq(shipping_available,true) + or(cost 0/null)', async () => {
      const useSearch = await importUseSearch();
      const { performSearch, selectedFreeShipping } = useSearch();
      selectedFreeShipping.value = true;
      await performSearch();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('shipping_available', true);
      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith('shipping_cost.eq.0,shipping_cost.is.null');
    });

    it.each([
      ['newest', 'created_at', { ascending: false }],
      ['oldest', 'created_at', { ascending: true }],
      ['price_asc', 'price', { ascending: true, nullsFirst: false }],
      ['price_desc', 'price', { ascending: false, nullsFirst: false }],
      ['year_asc', 'year', { ascending: true }],
      ['year_desc', 'year', { ascending: false }],
    ])('orders by the correct column for sort=%s', async (sort, column, opts) => {
      const useSearch = await importUseSearch();
      const { performSearch, sortBy } = useSearch();
      sortBy.value = sort as string;
      await performSearch();
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith(column, opts);
    });

    it('applies referencedTable photo ordering (is_primary desc, display_order asc)', async () => {
      const useSearch = await importUseSearch();
      await useSearch().performSearch();
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('is_primary', {
        referencedTable: 'listing_photos',
        ascending: false,
      });
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('display_order', {
        referencedTable: 'listing_photos',
        ascending: true,
      });
    });

    it('passes the abort signal to the terminal query', async () => {
      const useSearch = await importUseSearch();
      await useSearch().performSearch();
      const arg = mockSupabase._queryBuilder.abortSignal.mock.calls[0][0];
      expect(arg).toBeInstanceOf(AbortSignal);
    });

    it('updates listings (examples sorted last) and totalCount on success', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 2 });
      const useSearch = await importUseSearch();
      const { performSearch, listings, totalCount } = useSearch();
      await performSearch();
      expect(listings.value).toEqual(mockListings);
      expect(totalCount.value).toBe(2);
    });

    it('sorts example listings after real listings', async () => {
      const exampleFirst = [
        { ...mockListingWithPhotos, id: 'ex', status: 'example_paid' },
        { ...mockListingWithPhotos, id: 'real', status: 'active' },
      ];
      resolveQueryWith({ data: exampleFirst, error: null, count: 2 });
      const useSearch = await importUseSearch();
      const { performSearch, listings } = useSearch();
      await performSearch();
      expect(listings.value.map((l: any) => l.id)).toEqual(['real', 'ex']);
    });

    it('captures search_performed when a query or filters are active', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 2 });
      const useSearch = await importUseSearch();
      const { performSearch, searchQuery } = useSearch();
      searchQuery.value = 'Cooper';
      await performSearch();
      expect(mockCapture).toHaveBeenCalledWith('search_performed', {
        query: 'Cooper',
        results_count: 2,
        filters_active: 0,
      });
    });

    it('captures no_results_shown when an active search returns zero results', async () => {
      resolveQueryWith({ data: [], error: null, count: 0 });
      const useSearch = await importUseSearch();
      const { performSearch, searchQuery } = useSearch();
      searchQuery.value = 'Nonexistent';
      await performSearch();
      expect(mockCapture).toHaveBeenCalledWith('no_results_shown', {
        query: 'Nonexistent',
        filters_applied: expect.any(Object),
      });
    });

    it('does not capture analytics when no query and no filters are active', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 2 });
      const useSearch = await importUseSearch();
      await useSearch().performSearch();
      expect(mockCapture).not.toHaveBeenCalledWith('search_performed', expect.anything());
      expect(mockCapture).not.toHaveBeenCalledWith('no_results_shown', expect.anything());
    });

    it('handles a Supabase error: clears results, ends loading, toasts', async () => {
      const dbError = new Error('Database error');
      resolveQueryWith({ data: null, error: dbError, count: 0 });
      const useSearch = await importUseSearch();
      const { performSearch, listings, totalCount, loading } = useSearch();
      await performSearch();
      expect(listings.value).toEqual([]);
      expect(totalCount.value).toBe(0);
      expect(loading.value).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Failed to search listings:', dbError);
      expect(mockToastAdd).toHaveBeenCalledWith({
        title: 'Search Error',
        description: 'Failed to load listings. Please try again.',
        color: 'error',
      });
    });

    it('handles a thrown exception during search', async () => {
      rejectQueryWith(new Error('Network error'));
      const useSearch = await importUseSearch();
      const { performSearch, listings, totalCount, loading } = useSearch();
      await performSearch();
      expect(listings.value).toEqual([]);
      expect(totalCount.value).toBe(0);
      expect(loading.value).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Failed to search listings:', expect.any(Error));
    });

    it('handles a null data response without throwing', async () => {
      resolveQueryWith({ data: null, error: null, count: 0 });
      const useSearch = await importUseSearch();
      const { performSearch, listings, totalCount } = useSearch();
      await performSearch();
      expect(listings.value).toEqual([]);
      expect(totalCount.value).toBe(0);
    });

    it('silently swallows an AbortError (newer search in flight)', async () => {
      const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
      rejectQueryWith(abortErr);
      const useSearch = await importUseSearch();
      const { performSearch, loading } = useSearch();
      await performSearch();
      // No user-facing toast for an aborted request.
      expect(mockToastAdd).not.toHaveBeenCalled();
      expect(loading.value).toBe(false);
    });

    // -----------------------------------------------------------------------
    // distance-based filtering
    // -----------------------------------------------------------------------
    it('short-circuits to empty results when geocoding fails for an active distance filter', async () => {
      mockGeocodeLocation.mockResolvedValue(null);
      const useSearch = await importUseSearch();
      const { performSearch, listings, totalCount, selectedLocation, selectedDistance } = useSearch();
      selectedLocation.value = 'Nowhere';
      selectedDistance.value = '50';
      await performSearch();

      expect(mockGeocodeLocation).toHaveBeenCalledWith('Nowhere');
      expect(listings.value).toEqual([]);
      expect(totalCount.value).toBe(0);
      // Should not run the listings query when geocoding fails.
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('uses limit() instead of range() and requires coordinates when distance filter active', async () => {
      mockGeocodeLocation.mockResolvedValue({ latitude: 51.5, longitude: -0.12 });
      // Within-50mi for the first listing only.
      mockCalculateDistance.mockImplementation((_la: number, _lo: number, lat: number) =>
        lat === 51.5074 ? 5 : 500
      );
      resolveQueryWith({ data: mockListings, error: null, count: 2 });

      const useSearch = await importUseSearch();
      const { performSearch, selectedLocation, selectedDistance, listings, totalCount } = useSearch();
      selectedLocation.value = 'London';
      selectedDistance.value = '50';
      await performSearch();

      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(1000);
      expect(mockSupabase._queryBuilder.range).not.toHaveBeenCalled();
      // Only listings with coordinates are requested.
      expect(mockSupabase._queryBuilder.not).toHaveBeenCalledWith('latitude', 'is', null);
      expect(mockSupabase._queryBuilder.not).toHaveBeenCalledWith('longitude', 'is', null);
      // Distance filter keeps only the in-radius listing; count reflects filtered set.
      expect(listings.value).toHaveLength(1);
      expect(listings.value[0].id).toBe('test-listing-id');
      expect(totalCount.value).toBe(1);
    });

    it('does not apply the text location ilike when a distance filter is active', async () => {
      mockGeocodeLocation.mockResolvedValue({ latitude: 51.5, longitude: -0.12 });
      mockCalculateDistance.mockReturnValue(10);
      const useSearch = await importUseSearch();
      const { performSearch, selectedLocation, selectedDistance } = useSearch();
      selectedLocation.value = 'London';
      selectedDistance.value = '50';
      await performSearch();
      expect(mockSupabase._queryBuilder.ilike).not.toHaveBeenCalledWith('location', expect.any(String));
    });
  });

  // -------------------------------------------------------------------------
  // clearFilters()
  // -------------------------------------------------------------------------
  describe('clearFilters()', () => {
    it('resets every filter ref to its default and page to 1', async () => {
      const useSearch = await importUseSearch();
      const s = useSearch();

      s.searchQuery.value = 'Cooper';
      s.selectedCategory.value = 'vehicle';
      s.selectedPartsSubcategory.value = 'engine';
      s.selectedYearRange.value = '1960s';
      s.selectedManufacturer.value = 'Austin';
      s.selectedModel.value = 'Cooper S';
      s.selectedCondition.value = 'excellent';
      s.selectedPriceRange.value = '30k-50k';
      s.selectedTransmission.value = 'manual';
      s.selectedLocation.value = 'California';
      s.selectedDistance.value = '50';
      s.selectedShippingAvailable.value = true;
      s.selectedShipsInternational.value = true;
      s.selectedFreeShipping.value = true;
      s.sortBy.value = 'price_asc';
      s.currentPage.value = 3;

      s.clearFilters();

      expect(s.searchQuery.value).toBe('');
      expect(s.selectedCategory.value).toBe('');
      expect(s.selectedPartsSubcategory.value).toBe('');
      expect(s.selectedYearRange.value).toBe('');
      expect(s.selectedManufacturer.value).toBe('');
      expect(s.selectedModel.value).toBe('');
      expect(s.selectedCondition.value).toBe('');
      expect(s.selectedPriceRange.value).toBe('');
      expect(s.selectedTransmission.value).toBe('');
      expect(s.selectedLocation.value).toBe('');
      expect(s.selectedDistance.value).toBe('');
      expect(s.selectedShippingAvailable.value).toBe(false);
      expect(s.selectedShipsInternational.value).toBe(false);
      expect(s.selectedFreeShipping.value).toBe(false);
      expect(s.sortBy.value).toBe('newest');
      expect(s.currentPage.value).toBe(1);
    });

    it('captures filters_cleared with the number of filters removed', async () => {
      const useSearch = await importUseSearch();
      const { clearFilters, searchQuery, selectedCategory, selectedModel } = useSearch();
      searchQuery.value = 'Cooper'; // +1
      selectedCategory.value = 'vehicle'; // +1
      selectedModel.value = 'Cooper S'; // +1
      clearFilters();
      expect(mockCapture).toHaveBeenCalledWith('filters_cleared', { filters_removed: 3 });
    });

    it('does not capture filters_cleared when nothing was active', async () => {
      const useSearch = await importUseSearch();
      useSearch().clearFilters();
      expect(mockCapture).not.toHaveBeenCalledWith('filters_cleared', expect.anything());
    });
  });

  // -------------------------------------------------------------------------
  // hasActiveFilters
  // -------------------------------------------------------------------------
  describe('hasActiveFilters', () => {
    it('is false when nothing is set', async () => {
      const useSearch = await importUseSearch();
      expect(useSearch().hasActiveFilters.value).toBe(false);
    });

    it.each([
      'searchQuery',
      'selectedCategory',
      'selectedYearRange',
      'selectedManufacturer',
      'selectedModel',
      'selectedCondition',
      'selectedPriceRange',
      'selectedTransmission',
      'selectedLocation',
      'selectedDistance',
    ])('is true when %s is set', async (key) => {
      const useSearch = await importUseSearch();
      const s = useSearch() as any;
      s[key].value = 'x';
      expect(s.hasActiveFilters.value).toBe(true);
    });

    it.each(['selectedShippingAvailable', 'selectedShipsInternational', 'selectedFreeShipping'])(
      'is true when %s boolean flag is set',
      async (key) => {
        const useSearch = await importUseSearch();
        const s = useSearch() as any;
        s[key].value = true;
        expect(s.hasActiveFilters.value).toBe(true);
      }
    );

    it('does not treat sortBy as an active filter', async () => {
      const useSearch = await importUseSearch();
      const { hasActiveFilters, sortBy } = useSearch();
      sortBy.value = 'price_asc';
      expect(hasActiveFilters.value).toBe(false);
    });

    it('does not treat selectedPartsSubcategory as an active filter', async () => {
      // Documented behavior: hasActiveFilters omits parts_subcategory.
      const useSearch = await importUseSearch();
      const { hasActiveFilters, selectedPartsSubcategory } = useSearch();
      selectedPartsSubcategory.value = 'engine';
      expect(hasActiveFilters.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // pagination
  // -------------------------------------------------------------------------
  describe('pagination', () => {
    it('computes totalPages from totalCount / pageSize (ceil)', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 25 });
      const useSearch = await importUseSearch();
      const { performSearch, totalPages } = useSearch();
      await performSearch();
      // ceil(25 / 12) = 3
      expect(totalPages.value).toBe(3);
    });

    it('computes hasNextPage / hasPrevPage relative to currentPage', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 36 }); // 3 pages
      const useSearch = await importUseSearch();
      const { performSearch, hasNextPage, hasPrevPage, currentPage } = useSearch();
      await performSearch();
      expect(currentPage.value).toBe(1);
      expect(hasPrevPage.value).toBe(false);
      expect(hasNextPage.value).toBe(true);
    });

    it('nextPage advances the page, updates URL, and re-searches', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 36 }); // 3 pages
      const useSearch = await importUseSearch();
      const { performSearch, nextPage, currentPage } = useSearch();
      await performSearch();
      mockRouterReplace.mockClear();

      nextPage();
      expect(currentPage.value).toBe(2);
      expect(mockRouterReplace).toHaveBeenCalled();
      // page param included once > 1
      const query = mockRouterReplace.mock.calls.at(-1)?.[0]?.query;
      expect(query.page).toBe('2');
    });

    it('nextPage is a no-op on the last page', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 5 }); // 1 page
      const useSearch = await importUseSearch();
      const { performSearch, nextPage, currentPage } = useSearch();
      await performSearch();
      nextPage();
      expect(currentPage.value).toBe(1);
    });

    it('prevPage decrements the page when possible', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 36 });
      const useSearch = await importUseSearch();
      const { performSearch, nextPage, prevPage, currentPage } = useSearch();
      await performSearch();
      nextPage(); // -> 2
      prevPage(); // -> 1
      expect(currentPage.value).toBe(1);
    });

    it('prevPage is a no-op on the first page', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 36 });
      const useSearch = await importUseSearch();
      const { performSearch, prevPage, currentPage } = useSearch();
      await performSearch();
      prevPage();
      expect(currentPage.value).toBe(1);
    });

    it('goToPage jumps to a valid page and ignores out-of-range targets', async () => {
      resolveQueryWith({ data: mockListings, error: null, count: 36 }); // 3 pages
      const useSearch = await importUseSearch();
      const { performSearch, goToPage, currentPage } = useSearch();
      await performSearch();

      goToPage(3);
      expect(currentPage.value).toBe(3);

      goToPage(99); // out of range, ignored
      expect(currentPage.value).toBe(3);

      goToPage(0); // below 1, ignored
      expect(currentPage.value).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // route.query watcher (deep) — re-derives filters + re-searches when the URL
  // changes while the composable is mounted (e.g. clicking a category link in
  // the navbar from the listings page).
  // -------------------------------------------------------------------------
  describe('route query watcher', () => {
    it('re-derives filters and re-searches when route.query mutates', async () => {
      // A reactive route query so the composable's `watch(() => route.query, …,
      // { deep: true })` actually fires on mutation (a plain-object reassign
      // would not — the composable captures route.query by reference once).
      mockRouteQuery = reactive({}) as Record<string, string>;
      resolveQueryWith({ data: mockListings, error: null, count: 2 });

      const useSearch = await importUseSearch();
      const s = useSearch();
      // Initial state derived from the (empty) query.
      expect(s.selectedCategory.value).toBe('');

      mockSupabase.from = vi.fn().mockReturnValue(mockSupabase._queryBuilder);

      // Simulate a navbar category link changing the URL in place.
      (mockRouteQuery as Record<string, string>).category = 'vehicle';
      (mockRouteQuery as Record<string, string>).search = 'Cooper, S.';
      await nextTick();

      // Filters re-derived from the new query (search sanitized).
      expect(s.selectedCategory.value).toBe('vehicle');
      expect(s.searchQuery.value).toBe('Cooper S');
      // And a fresh search ran off the new filters.
      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
    });
  });

  // -------------------------------------------------------------------------
  // cleanup()
  // -------------------------------------------------------------------------
  describe('cleanup()', () => {
    it('aborts in-flight requests and stops watchers without throwing', async () => {
      const useSearch = await importUseSearch();
      const { cleanup, sortBy } = useSearch();

      // Mutating a watched ref after cleanup should not trigger another search.
      expect(() => cleanup()).not.toThrow();

      mockSupabase.from = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
      sortBy.value = 'price_asc';
      // Watchers are async; give the scheduler a tick.
      await Promise.resolve();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('aborts the live AbortController when a search is still in flight', async () => {
      // A query that never resolves keeps currentAbortController non-null so
      // cleanup() takes the abort branch (controller.abort(); controller = null).
      mockSupabase._queryBuilder.abortSignal = vi.fn(() => new Promise(() => {}));

      const useSearch = await importUseSearch();
      const { performSearch, cleanup } = useSearch();

      // Kick off a search; it parks awaiting the never-resolving terminal,
      // leaving the controller live.
      void performSearch();
      // Let loadVisibility() resolve so abortSignal(signal) is reached and the
      // controller's signal is wired up.
      await vi.waitFor(() => expect(mockSupabase._queryBuilder.abortSignal).toHaveBeenCalled());

      const signal = mockSupabase._queryBuilder.abortSignal.mock.calls[0][0] as AbortSignal;
      expect(signal.aborted).toBe(false);

      cleanup();

      // The in-flight request's signal is now aborted.
      expect(signal.aborted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // return shape
  // -------------------------------------------------------------------------
  describe('return shape', () => {
    it('exposes all documented state, computeds, and methods', async () => {
      const useSearch = await importUseSearch();
      const r = useSearch();

      for (const key of [
        'searchQuery',
        'selectedCategory',
        'selectedPartsSubcategory',
        'selectedYearRange',
        'selectedManufacturer',
        'selectedModel',
        'selectedCondition',
        'selectedPriceRange',
        'selectedTransmission',
        'selectedLocation',
        'selectedDistance',
        'selectedShippingAvailable',
        'selectedShipsInternational',
        'selectedFreeShipping',
        'sortBy',
        'listings',
        'loading',
        'totalCount',
        'hasActiveFilters',
        'isGeocoding',
        'currentPage',
        'pageSize',
        'totalPages',
        'hasNextPage',
        'hasPrevPage',
        'performSearch',
        'clearFilters',
        'buildFilters',
        'nextPage',
        'prevPage',
        'goToPage',
        'cleanup',
      ]) {
        expect(r).toHaveProperty(key);
      }
    });

    it('returns reactive refs / computeds with a .value', async () => {
      const useSearch = await importUseSearch();
      const { searchQuery, loading, listings, totalCount, hasActiveFilters, totalPages } = useSearch();
      expect(searchQuery).toHaveProperty('value');
      expect(loading).toHaveProperty('value');
      expect(listings).toHaveProperty('value');
      expect(totalCount).toHaveProperty('value');
      expect(typeof hasActiveFilters.value).toBe('boolean');
      expect(typeof totalPages.value).toBe('number');
    });
  });
});
