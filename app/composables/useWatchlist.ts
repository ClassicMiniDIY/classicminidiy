export interface WatchlistItem {
  user_id: string;
  listing_id: string;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    slug: string;
    price: number;
    year: number;
    model: string;
    location: string;
    tier: string;
    status: string;
    photos?: Array<{
      storage_path: string;
      is_primary: boolean;
    }>;
  };
}

export const useWatchlist = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();
  const { capture } = usePostHog();
  const route = useRoute();

  // Local state for watchlist
  const watchlistItems = useState<WatchlistItem[]>('watchlist-items', () => []);
  const watchlistedListingIds = computed(() => new Set(watchlistItems.value.map((item) => item.listing_id)));

  // Check if a listing is in the watchlist
  const isWatchlisted = (listingId: string): boolean => {
    return watchlistedListingIds.value.has(listingId);
  };

  // Fetch user's watchlist
  const fetchWatchlist = async () => {
    if (!user.value) {
      watchlistItems.value = [];
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select(
          `
          user_id,
          listing_id,
          created_at,
          listing:listings (
            id,
            title,
            slug,
            price,
            year,
            model,
            location,
            tier,
            status,
            photos:listing_photos (
              storage_path,
              is_primary
            )
          )
        `
        )
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      watchlistItems.value = (data as unknown as WatchlistItem[]) || [];
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load watchlist',
        color: 'error',
      });
    }
  };

  // Add a listing to watchlist
  const addToWatchlist = async (listingId: string) => {
    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to save listings',
        color: 'warning',
      });
      return false;
    }

    try {
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.value.id,
        listing_id: listingId,
      });

      if (error) {
        // Check if already in watchlist (duplicate key error)
        if (error.code === '23505') {
          toast.add({
            title: 'Already Saved',
            description: 'This listing is already in your watchlist',
            color: 'info',
          });
          return false;
        }
        throw error;
      }

      // Refresh watchlist
      await fetchWatchlist();

      // Track watchlist addition
      capture('listing_watchlisted', {
        listing_id: listingId,
        source_page: route.fullPath,
      });

      toast.add({
        title: 'Saved',
        description: 'Listing added to your watchlist',
        color: 'success',
      });

      return true;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to add listing to watchlist',
        color: 'error',
      });
      return false;
    }
  };

  // Remove a listing from watchlist
  const removeFromWatchlist = async (listingId: string) => {
    if (!user.value) return false;

    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.value.id)
        .eq('listing_id', listingId);

      if (error) throw error;

      // Update local state
      watchlistItems.value = watchlistItems.value.filter((item) => item.listing_id !== listingId);

      // Track watchlist removal
      capture('listing_unwatchlisted', {
        listing_id: listingId,
        source_page: route.fullPath,
      });

      toast.add({
        title: 'Removed',
        description: 'Listing removed from your watchlist',
        color: 'info',
      });

      return true;
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to remove listing from watchlist',
        color: 'error',
      });
      return false;
    }
  };

  // Toggle watchlist status
  const toggleWatchlist = async (listingId: string) => {
    if (isWatchlisted(listingId)) {
      return await removeFromWatchlist(listingId);
    } else {
      return await addToWatchlist(listingId);
    }
  };

  // Get watchlist count for a listing
  const getWatchlistCount = async (listingId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error getting watchlist count:', error);
      return 0;
    }
  };

  return {
    watchlistItems,
    watchlistedListingIds,
    isWatchlisted,
    fetchWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    getWatchlistCount,
  };
};
