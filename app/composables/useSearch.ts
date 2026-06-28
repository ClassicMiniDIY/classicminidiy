import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import type { ListingWithPhotos } from './useListings';

export interface SearchFilters {
  search?: string;
  listing_category?: string;
  parts_subcategory?: string;
  year_min?: number;
  year_max?: number;
  manufacturer?: string;
  model?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  transmission?: string;
  location?: string;
  distance?: number; // Distance in miles for radius filtering
  locationCoords?: { latitude: number; longitude: number }; // Geocoded coordinates
  shipping_available?: boolean;
  ships_international?: boolean;
  free_shipping?: boolean;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'year_asc' | 'year_desc';
}

/**
 * Sanitize search input to prevent SQL injection
 * Supabase's textSearch is parameterized but we add extra sanitization
 */
const sanitizeSearchInput = (input: string): string => {
  if (!input) return '';

  // Limit length
  const maxLength = 200;
  let sanitized = input.slice(0, maxLength);

  // Remove potentially dangerous characters for full-text search
  // Allow alphanumeric, spaces, hyphens, and apostrophes only
  // Commas and dots are excluded to prevent PostgREST filter injection in .or() queries
  sanitized = sanitized.replace(/[^\w\s'-]/gi, '');

  // Trim and normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');

  return sanitized;
};

/**
 * Helper function to update filter state from URL query params
 * Extracts common logic used during initialization and route changes
 */
const updateFiltersFromQuery = (
  query: Record<string, any>,
  filters: {
    searchQuery: Ref<string>;
    selectedCategory: Ref<string>;
    selectedPartsSubcategory: Ref<string>;
    selectedYearRange: Ref<string>;
    selectedManufacturer: Ref<string>;
    selectedModel: Ref<string>;
    selectedCondition: Ref<string>;
    selectedPriceRange: Ref<string>;
    selectedTransmission: Ref<string>;
    selectedLocation: Ref<string>;
    selectedDistance: Ref<string>;
    selectedShippingAvailable: Ref<boolean>;
    selectedShipsInternational: Ref<boolean>;
    selectedFreeShipping: Ref<boolean>;
    sortBy: Ref<string>;
  }
) => {
  filters.searchQuery.value = sanitizeSearchInput((query.search as string) || '');
  filters.selectedCategory.value = (query.category as string) || '';
  filters.selectedPartsSubcategory.value = (query.subcategory as string) || '';
  filters.selectedYearRange.value = (query.year as string) || '';
  filters.selectedManufacturer.value = (query.manufacturer as string) || '';
  filters.selectedModel.value = (query.model as string) || '';
  filters.selectedCondition.value = (query.condition as string) || '';
  filters.selectedPriceRange.value = (query.price as string) || '';
  filters.selectedTransmission.value = (query.transmission as string) || '';
  filters.selectedLocation.value = (query.location as string) || '';
  filters.selectedDistance.value = (query.distance as string) || '';
  filters.selectedShippingAvailable.value = query.shipping === 'true';
  filters.selectedShipsInternational.value = query.international === 'true';
  filters.selectedFreeShipping.value = query.free_shipping === 'true';
  filters.sortBy.value = (query.sort as string) || 'newest';
};

/**
 * Parse a 1-indexed page number from a URL query value. Returns 1 for
 * anything missing, non-numeric, or <= 0. Used so `/listings?page=4`
 * restores the user to page 4 on reload or native back-navigation.
 */
const parsePageFromQuery = (raw: unknown): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

export const useSearch = () => {
  const router = useRouter();
  const route = useRoute();
  const supabase = useSupabase();
  const toast = useToast();
  const { capture } = usePostHog();

  // Initialize filter refs
  const searchQuery = ref('');
  const selectedCategory = ref('');
  const selectedPartsSubcategory = ref('');
  const selectedYearRange = ref('');
  const selectedManufacturer = ref('');
  const selectedModel = ref('');
  const selectedCondition = ref('');
  const selectedPriceRange = ref('');
  const selectedTransmission = ref('');
  const selectedLocation = ref('');
  const selectedDistance = ref('');
  const selectedShippingAvailable = ref(false);
  const selectedShipsInternational = ref(false);
  const selectedFreeShipping = ref(false);
  const sortBy = ref('newest');

  // Geocoding for distance-based filtering
  const { geocodeLocation, calculateDistance, isGeocoding } = useGeocoding();
  const locationCoords = ref<{ latitude: number; longitude: number } | null>(null);

  // AbortController to cancel in-flight search requests
  let currentAbortController: AbortController | null = null;

  // Initialize filters from URL query params
  updateFiltersFromQuery(route.query, {
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
  });

  const listings = ref<ListingWithPhotos[]>([]);
  const loading = ref(false);
  const totalCount = ref(0);
  // Restore page from URL so `/listings?page=4` lands on page 4 instead of
  // silently resetting to page 1 — fixes #83 (back button sent users to
  // page 1 instead of the page they were on).
  const currentPage = ref(parsePageFromQuery(route.query.page));
  const pageSize = ref(12); // 12 listings per page

  // Count active filters for analytics
  const countActiveFilters = (): number => {
    let count = 0;
    if (selectedCategory.value) count++;
    if (selectedPartsSubcategory.value) count++;
    if (selectedYearRange.value) count++;
    if (selectedManufacturer.value) count++;
    if (selectedModel.value) count++;
    if (selectedCondition.value) count++;
    if (selectedPriceRange.value) count++;
    if (selectedTransmission.value) count++;
    if (selectedLocation.value) count++;
    if (selectedDistance.value) count++;
    if (selectedShippingAvailable.value) count++;
    if (selectedShipsInternational.value) count++;
    if (selectedFreeShipping.value) count++;
    return count;
  };

  // Build filters object from UI state
  const buildFilters = (): SearchFilters => {
    const filters: SearchFilters = {};

    if (searchQuery.value) {
      filters.search = searchQuery.value;
    }

    if (selectedCategory.value) {
      filters.listing_category = selectedCategory.value;
    }

    if (selectedPartsSubcategory.value) {
      filters.parts_subcategory = selectedPartsSubcategory.value;
    }

    if (selectedCondition.value) {
      filters.condition = selectedCondition.value;
    }

    if (selectedManufacturer.value) {
      filters.manufacturer = selectedManufacturer.value;
    }

    if (selectedModel.value) {
      filters.model = selectedModel.value;
    }

    if (selectedTransmission.value) {
      filters.transmission = selectedTransmission.value;
    }

    if (selectedLocation.value) {
      filters.location = selectedLocation.value;
    }

    // Handle year range filters
    if (selectedYearRange.value) {
      const yearRanges: Record<string, { min: number; max: number }> = {
        '1960s': { min: 1959, max: 1969 },
        '1970s': { min: 1970, max: 1979 },
        '1980s': { min: 1980, max: 1989 },
        '1990s': { min: 1990, max: 2000 },
      };

      const range = yearRanges[selectedYearRange.value];
      if (range) {
        filters.year_min = range.min;
        filters.year_max = range.max;
      }
    }

    // Handle price range filters
    if (selectedPriceRange.value) {
      const priceRanges: Record<string, { min?: number; max?: number }> = {
        free: { min: 0, max: 0 },
        'under-10k': { max: 10000 },
        '10k-20k': { min: 10000, max: 20000 },
        '20k-30k': { min: 20000, max: 30000 },
        '30k-50k': { min: 30000, max: 50000 },
        'over-50k': { min: 50000 },
      };

      const range = priceRanges[selectedPriceRange.value];
      if (range) {
        if (range.min !== undefined) {
          filters.min_price = range.min;
        }
        if (range.max !== undefined) {
          filters.max_price = range.max;
        }
      }
    }

    if (selectedShippingAvailable.value) {
      filters.shipping_available = true;
    }

    if (selectedShipsInternational.value) {
      filters.ships_international = true;
    }

    if (selectedFreeShipping.value) {
      filters.free_shipping = true;
    }

    if (sortBy.value) {
      filters.sort = sortBy.value as SearchFilters['sort'];
    }

    return filters;
  };

  // Update URL query params when filters change
  const updateURLParams = () => {
    const query: Record<string, string> = {};

    if (searchQuery.value) query.search = searchQuery.value;
    if (selectedCategory.value) query.category = selectedCategory.value;
    if (selectedPartsSubcategory.value) query.subcategory = selectedPartsSubcategory.value;
    if (selectedYearRange.value) query.year = selectedYearRange.value;
    if (selectedManufacturer.value) query.manufacturer = selectedManufacturer.value;
    if (selectedModel.value) query.model = selectedModel.value;
    if (selectedCondition.value) query.condition = selectedCondition.value;
    if (selectedPriceRange.value) query.price = selectedPriceRange.value;
    if (selectedTransmission.value) query.transmission = selectedTransmission.value;
    if (selectedLocation.value) query.location = selectedLocation.value;
    if (selectedDistance.value) query.distance = selectedDistance.value;
    if (selectedShippingAvailable.value) query.shipping = 'true';
    if (selectedShipsInternational.value) query.international = 'true';
    if (selectedFreeShipping.value) query.free_shipping = 'true';
    if (sortBy.value && sortBy.value !== 'newest') query.sort = sortBy.value;
    // Include pagination so the URL survives reloads and back-navigation.
    // Page 1 is omitted to keep /listings clean.
    if (currentPage.value > 1) query.page = String(currentPage.value);

    router.replace({ query });
  };

  // Perform the search
  const performSearch = async () => {
    // Abort any in-flight search request
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    loading.value = true;

    try {
      const { loadVisibility, activeStatuses } = useExampleListings();
      await loadVisibility();

      const filters = buildFilters();

      // Check if we need distance-based filtering
      const useDistanceFilter = selectedLocation.value && selectedDistance.value;
      let geocodedCoords: { latitude: number; longitude: number } | null = null;

      // Geocode location if distance filtering is active
      if (useDistanceFilter) {
        const result = await geocodeLocation(selectedLocation.value);
        if (result) {
          geocodedCoords = { latitude: result.latitude, longitude: result.longitude };
          locationCoords.value = geocodedCoords;
        } else {
          // Geocoding failed for an active distance filter — short-circuit to
          // empty results instead of returning unfiltered listings. (The
          // try/finally resets `loading`.)
          listings.value = [];
          totalCount.value = 0;
          return;
        }
      }

      // When using distance filter, we need to fetch all matching listings
      // and then filter/paginate client-side
      const useClientSidePagination = useDistanceFilter && geocodedCoords;

      // Calculate pagination (only used when not doing client-side filtering)
      const from = (currentPage.value - 1) * pageSize.value;
      const to = from + pageSize.value - 1;

      // Optimized query with efficient pagination
      // Uses range() for offset/limit and count: 'exact' for total count in single query
      let query = supabase
        .from('listings')
        .select(
          `
          *,
          listing_photos (
            id,
            storage_path,
            display_order,
            category,
            is_primary
          ),
          profiles:public_profiles!listings_user_id_fkey (
            id,
            display_name,
            username,
            location,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .in('status', activeStatuses.value);

      // Only apply range if not using client-side pagination
      if (!useClientSidePagination) {
        query = query.range(from, to);
      } else {
        // Add a safeguard limit for client-side distance filtering
        // to prevent fetching excessive records that could impact performance
        query = query.limit(1000);
      }

      // Apply filters
      if (filters.search) {
        const sanitizedSearch = sanitizeSearchInput(filters.search);
        if (sanitizedSearch) {
          // Use ilike on title and description since search_vector column doesn't exist
          query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
        }
      }

      if (filters.listing_category) {
        query = query.eq('listing_category', filters.listing_category);
      }

      if (filters.parts_subcategory) {
        query = query.eq('parts_subcategory', filters.parts_subcategory);
      }

      if (filters.condition) {
        query = query.eq('condition', filters.condition);
      }

      if (filters.manufacturer) {
        query = query.eq('manufacturer', filters.manufacturer);
      }

      if (filters.model) {
        query = query.eq('model', filters.model);
      }

      if (filters.transmission) {
        query = query.eq('transmission', filters.transmission);
      }

      if (filters.year_min !== undefined) {
        query = query.gte('year', filters.year_min);
      }

      if (filters.year_max !== undefined) {
        query = query.lte('year', filters.year_max);
      }

      if (filters.min_price !== undefined) {
        query = query.gte('price', filters.min_price);
      }

      if (filters.max_price !== undefined) {
        query = query.lte('price', filters.max_price);
      }

      // Only apply text-based location filter if NOT using distance filter
      if (filters.location && !useDistanceFilter) {
        query = query.ilike('location', `%${filters.location}%`);
      }

      // When using distance filter, only get listings with coordinates
      if (useDistanceFilter) {
        query = query.not('latitude', 'is', null).not('longitude', 'is', null);
      }

      // Shipping filters
      if (filters.shipping_available) {
        query = query.eq('shipping_available', true);
      }

      if (filters.ships_international) {
        query = query.in('ships_to', ['international', 'specific_countries']);
      }

      if (filters.free_shipping) {
        query = query.eq('shipping_available', true).or('shipping_cost.eq.0,shipping_cost.is.null');
      }

      // Apply sorting
      // Note: Featured listings get prominence on the homepage via FeaturedGrid/PromotedListings.
      // Search results respect user-selected sort order without hidden boosting.
      switch (filters.sort) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'price_asc':
          query = query.order('price', { ascending: true, nullsFirst: false });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false, nullsFirst: false });
          break;
        case 'year_asc':
          query = query.order('year', { ascending: true });
          break;
        case 'year_desc':
          query = query.order('year', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Ensure listing photos are ordered: primary first, then by display_order
      query = applyPhotoOrdering(query);

      const { data, error, count } = await query.abortSignal(signal);

      if (error) {
        console.error('Search error:', error);
        throw error;
      }

      let resultListings = (data as ListingWithPhotos[]) || [];
      let resultCount = count || 0;

      // Apply distance filtering client-side if needed
      if (useClientSidePagination && geocodedCoords) {
        const distanceMiles = parseInt(selectedDistance.value, 10);

        // Filter listings by distance
        const filteredByDistance = resultListings.filter((listing) => {
          if (!listing.latitude || !listing.longitude) return false;
          const distance = calculateDistance(
            geocodedCoords!.latitude,
            geocodedCoords!.longitude,
            listing.latitude,
            listing.longitude
          );
          return distance <= distanceMiles;
        });

        // Sort by distance (closest first) when using distance filter
        filteredByDistance.sort((a, b) => {
          const distA = calculateDistance(
            geocodedCoords!.latitude,
            geocodedCoords!.longitude,
            a.latitude!,
            a.longitude!
          );
          const distB = calculateDistance(
            geocodedCoords!.latitude,
            geocodedCoords!.longitude,
            b.latitude!,
            b.longitude!
          );
          return distA - distB;
        });

        // Update total count
        resultCount = filteredByDistance.length;

        // Apply pagination
        resultListings = filteredByDistance.slice(from, to + 1);
      }

      listings.value = sortExamplesLast(resultListings);
      totalCount.value = resultCount;

      // Track search analytics
      const activeFiltersCount = countActiveFilters();
      if (searchQuery.value || activeFiltersCount > 0) {
        capture('search_performed', {
          query: searchQuery.value || '',
          results_count: resultCount,
          filters_active: activeFiltersCount,
        });

        // Track no results
        if (resultCount === 0) {
          capture('no_results_shown', {
            query: searchQuery.value || undefined,
            filters_applied: buildFilters() as Record<string, unknown>,
          });
        }
      }
    } catch (error: any) {
      // Silently ignore aborted requests — a newer search is already in progress
      if (error?.name === 'AbortError' || signal.aborted) {
        return;
      }
      console.error('Failed to search listings:', error);
      listings.value = [];
      totalCount.value = 0;

      // Show error toast to user
      toast.add({
        title: 'Search Error',
        description: 'Failed to load listings. Please try again.',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  // Debounced search for search query input
  const debouncedSearch = useDebounceFn(() => {
    updateURLParams();
    performSearch();
  }, 500);

  // Store watch stop handles for cleanup
  const watchStopHandles: Array<() => void> = [];

  // Watch search query with debouncing
  const stopSearchWatch = watch(searchQuery, () => {
    debouncedSearch();
  });
  watchStopHandles.push(stopSearchWatch);

  // Watch other filters without debouncing
  const stopFiltersWatch = watch(
    [
      selectedCategory,
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
    ],
    () => {
      updateURLParams();
      performSearch();
    }
  );
  watchStopHandles.push(stopFiltersWatch);

  // Watch route query params and update filters when URL changes
  // This handles cases like clicking a category link from the navbar when already on the listings page
  const stopRouteWatch = watch(
    () => route.query,
    (newQuery) => {
      // Update filters from query params using helper function
      updateFiltersFromQuery(newQuery, {
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
      });

      // Perform search with new filters
      performSearch();
    },
    { deep: true }
  );
  watchStopHandles.push(stopRouteWatch);

  // Clear all filters
  const clearFilters = () => {
    // Count filters before clearing for analytics
    const filtersRemoved = countActiveFilters() + (searchQuery.value ? 1 : 0);

    searchQuery.value = '';
    selectedCategory.value = '';
    selectedPartsSubcategory.value = '';
    selectedYearRange.value = '';
    selectedManufacturer.value = '';
    selectedModel.value = '';
    selectedCondition.value = '';
    selectedPriceRange.value = '';
    selectedTransmission.value = '';
    selectedLocation.value = '';
    selectedDistance.value = '';
    selectedShippingAvailable.value = false;
    selectedShipsInternational.value = false;
    selectedFreeShipping.value = false;
    sortBy.value = 'newest';
    currentPage.value = 1; // Reset to first page
    locationCoords.value = null; // Clear cached coordinates

    // Track filters cleared
    if (filtersRemoved > 0) {
      capture('filters_cleared', {
        filters_removed: filtersRemoved,
      });
    }
  };

  // Pagination helpers
  const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value));
  const hasNextPage = computed(() => currentPage.value < totalPages.value);
  const hasPrevPage = computed(() => currentPage.value > 1);

  const nextPage = () => {
    if (hasNextPage.value) {
      currentPage.value++;
      updateURLParams();
      performSearch();
    }
  };

  const prevPage = () => {
    if (hasPrevPage.value) {
      currentPage.value--;
      updateURLParams();
      performSearch();
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
      updateURLParams();
      performSearch();
    }
  };

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    return !!(
      searchQuery.value ||
      selectedCategory.value ||
      selectedYearRange.value ||
      selectedManufacturer.value ||
      selectedModel.value ||
      selectedCondition.value ||
      selectedPriceRange.value ||
      selectedTransmission.value ||
      selectedLocation.value ||
      selectedDistance.value ||
      selectedShippingAvailable.value ||
      selectedShipsInternational.value ||
      selectedFreeShipping.value
    );
  });

  // Reset to page 1 when filters change
  const stopPageResetWatch = watch(
    [
      searchQuery,
      selectedCategory,
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
    ],
    () => {
      currentPage.value = 1;
    }
  );
  watchStopHandles.push(stopPageResetWatch);

  // Cleanup function to stop all watchers
  const cleanup = () => {
    // Abort any in-flight request
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    // Stop all watchers
    watchStopHandles.forEach((stop) => stop());
    watchStopHandles.length = 0;
  };

  return {
    // State
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
    hasActiveFilters,
    isGeocoding,

    // Pagination
    currentPage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,

    // Methods
    performSearch,
    clearFilters,
    buildFilters,
    nextPage,
    prevPage,
    goToPage,
    cleanup,
  };
};
