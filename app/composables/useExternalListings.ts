type SourceSite = 'bat' | 'carsandbids' | 'copart' | 'craigslist' | 'facebook' | 'ebay' | 'other';
type FindCategory = 'vehicle' | 'engine' | 'parts';

export interface ExternalListing {
  id: string;
  source_url: string;
  source_site: SourceSite;
  title: string;
  slug: string;
  description: string | null;
  og_image_url: string | null;
  og_description: string | null;
  year: number | null;
  model: string | null;
  price: number | null;
  price_label: string | null;
  auction_end_time: string | null;
  category: FindCategory | null;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  submitted_by: string | null;
  admin_notes: string | null;
  editor_commentary: string | null;
  is_editors_pick: boolean;
  like_count: number;
  comment_count: number;
  metadata_fetched_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export interface SubmitFindData {
  url: string;
  title: string;
  description?: string;
  category?: FindCategory;
  tags?: string[];
  og_image_url?: string | null;
  og_description?: string | null;
  year?: number | null;
  model?: string | null;
  price?: number | null;
  price_label?: string | null;
  auction_end_time?: string | null;
}

export interface FindFilters {
  sourceSite?: SourceSite;
  category?: FindCategory;
  tags?: string[];
  sort?: 'newest' | 'most_liked' | 'ending_soon';
  page?: number;
  limit?: number;
}

/**
 * Detect which source site a URL belongs to based on its hostname.
 * Inline version to avoid importing server utils on the client.
 */
function detectSourceSite(url: string): SourceSite {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('bringatrailer.com')) return 'bat';
    if (hostname.includes('carsandbids.com')) return 'carsandbids';
    if (hostname.includes('copart.com')) return 'copart';
    if (hostname.includes('craigslist.org')) return 'craigslist';
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('ebay.com') || hostname.includes('ebay.co.uk')) return 'ebay';
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * Generate a URL-friendly slug from a title with a random suffix for uniqueness.
 */
function generateFindSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  // crypto.randomUUID is undefined in non-secure (HTTP) contexts / older browsers.
  const suffix =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).substring(2, 10);
  return `${baseSlug}-${suffix}`;
}

export const useExternalListings = () => {
  const supabase = useSupabase();
  const toast = useToast();
  const { capture } = usePostHog();

  // Lazy-load auth only when needed (for mutations)
  const getUser = () => {
    const { user } = useAuth();
    return user.value;
  };

  // State
  const finds = useState<ExternalListing[]>('external-listings', () => []);
  const currentFind = useState<ExternalListing | null>('external-listing-current', () => null);
  const loading = useState<boolean>('external-listings-loading', () => false);
  const submitting = useState<boolean>('external-listings-submitting', () => false);
  const totalCount = useState<number>('external-listings-total', () => 0);
  const likedIds = useState<string[]>('external-listings-liked-ids', () => []);
  const watchlistedIds = useState<string[]>('external-listings-watchlisted-ids', () => []);

  /**
   * Fetch approved external listings with optional filters and pagination.
   */
  const fetchFinds = async (filters?: FindFilters) => {
    loading.value = true;
    try {
      const page = filters?.page ?? 1;
      const limit = filters?.limit ?? 20;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let query = supabase
        .from('external_listings')
        .select(
          `
          *,
          profiles:public_profiles!external_listings_submitted_by_fkey (
            display_name,
            username,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .eq('status', 'approved');

      // Apply sort
      const sort = filters?.sort || 'newest';
      if (sort === 'most_liked') {
        query = query.order('like_count', { ascending: false });
      } else if (sort === 'ending_soon') {
        query = query.order('auction_end_time', { ascending: true, nullsFirst: false });
      } else {
        query = query.order('published_at', { ascending: false });
      }

      query = query.range(start, end);

      if (filters?.sourceSite) {
        query = query.eq('source_site', filters.sourceSite);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      finds.value = (data as unknown as ExternalListing[]) || [];
      totalCount.value = count || 0;
    } catch (error: any) {
      console.error('Error fetching finds:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load finds',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch a single find by slug. Sets currentFind.
   */
  const fetchFind = async (slug: string) => {
    loading.value = true;
    try {
      const { data, error } = await supabase
        .from('external_listings')
        .select(
          `
          *,
          profiles:public_profiles!external_listings_submitted_by_fkey (
            display_name,
            username,
            avatar_url
          )
        `
        )
        .eq('slug', slug)
        .single();

      if (error) throw error;

      currentFind.value = data as unknown as ExternalListing;
      return currentFind.value;
    } catch (error: any) {
      console.error('Error fetching find:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load find',
        color: 'error',
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Submit a new find for moderation.
   */
  const submitFind = async (data: SubmitFindData) => {
    const user = getUser();
    if (!user) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to submit a find',
        color: 'warning',
      });
      return null;
    }

    submitting.value = true;
    try {
      const slug = generateFindSlug(data.title);
      const sourceSite = detectSourceSite(data.url);

      const insertPayload = {
        source_url: data.url,
        source_site: sourceSite,
        title: data.title,
        slug,
        description: data.description || null,
        category: data.category || null,
        tags: data.tags || [],
        submitted_by: user.id,
        status: 'pending' as const,
        og_image_url: data.og_image_url || null,
        og_description: data.og_description || null,
        year: data.year ?? null,
        model: data.model || null,
        price: data.price ?? null,
        price_label: data.price_label || null,
        auction_end_time: data.auction_end_time || null,
        metadata_fetched_at: data.og_image_url || data.og_description ? new Date().toISOString() : null,
      };

      let { data: inserted, error } = await supabase
        .from('external_listings')
        .insert(insertPayload)
        .select()
        .single();

      // If the insert fails due to a CHECK constraint on source_site (e.g. 'copart'
      // not yet in the DB enum), retry with 'other' so the find still gets saved.
      if (error && error.code === '23514' && sourceSite !== 'other') {
        const retry = await supabase
          .from('external_listings')
          .insert({ ...insertPayload, source_site: 'other' })
          .select()
          .single();
        inserted = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      capture('find_submitted', {
        source_site: sourceSite,
        category: data.category || null,
        url: data.url,
      });

      // Notify admins about the new find (fire and forget)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          $fetch('/api/exchange/external-listings/notify-submit', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: { findId: inserted.id },
          }).catch(() => {});
        }
      } catch {
        // Ignore notification failures
      }

      toast.add({
        title: 'Find Submitted',
        description: 'Your find has been submitted for review. An admin will review it shortly.',
        color: 'success',
      });

      return inserted;
    } catch (error: any) {
      console.error('Error submitting find:', error);

      // Handle duplicate URL
      if (error.code === '23505') {
        toast.add({
          title: 'Duplicate URL',
          description: 'This URL has already been submitted.',
          color: 'warning',
        });
      } else {
        toast.add({
          title: 'Error',
          description: 'Failed to submit find',
          color: 'error',
        });
      }
      return null;
    } finally {
      submitting.value = false;
    }
  };

  /**
   * Toggle like on a find. The denormalized like_count on external_listings
   * is updated by a SECURITY DEFINER database trigger, so we only need to
   * insert/delete the like row and do optimistic UI updates locally.
   */
  const toggleLike = async (id: string) => {
    const user = getUser();
    if (!user) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to like finds',
        color: 'warning',
      });
      return;
    }

    const alreadyLiked = likedIds.value.includes(id);

    if (alreadyLiked) {
      // Optimistic update
      likedIds.value = likedIds.value.filter((lid) => lid !== id);
      updateFindLikeCount(id, -1);

      try {
        const { error } = await supabase
          .from('external_listing_likes')
          .delete()
          .eq('external_listing_id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        capture('find_unliked', {
          id,
          source_site: getSourceSite(id),
        });
      } catch (error: any) {
        // Rollback optimistic update
        likedIds.value = [...likedIds.value, id];
        updateFindLikeCount(id, 1);

        console.error('Error unliking find:', error);
        toast.add({
          title: 'Error',
          description: 'Failed to unlike find',
          color: 'error',
        });
      }
    } else {
      // Optimistic update
      likedIds.value = [...likedIds.value, id];
      updateFindLikeCount(id, 1);

      try {
        const { error } = await supabase.from('external_listing_likes').insert({
          external_listing_id: id,
          user_id: user.id,
        });

        if (error) {
          // Handle duplicate key gracefully
          if (error.code === '23505') {
            return;
          }
          throw error;
        }

        capture('find_liked', {
          id,
          source_site: getSourceSite(id),
        });
      } catch (error: any) {
        // Rollback optimistic update
        likedIds.value = likedIds.value.filter((lid) => lid !== id);
        updateFindLikeCount(id, -1);

        console.error('Error liking find:', error);
        toast.add({
          title: 'Error',
          description: 'Failed to like find',
          color: 'error',
        });
      }
    }
  };

  /**
   * Check if a find is liked by the current user.
   */
  const isLiked = (id: string): boolean => {
    return likedIds.value.includes(id);
  };

  /**
   * Toggle watchlist on a find.
   */
  const toggleWatchlist = async (id: string) => {
    const user = getUser();
    if (!user) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to save finds',
        color: 'warning',
      });
      return;
    }

    const alreadyWatchlisted = watchlistedIds.value.includes(id);

    if (alreadyWatchlisted) {
      try {
        const { error } = await supabase
          .from('external_listing_watchlist')
          .delete()
          .eq('external_listing_id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        watchlistedIds.value = watchlistedIds.value.filter((wid) => wid !== id);

        toast.add({
          title: 'Removed',
          description: 'Find removed from your watchlist',
          color: 'info',
        });
      } catch (error: any) {
        console.error('Error removing from watchlist:', error);
        toast.add({
          title: 'Error',
          description: 'Failed to remove from watchlist',
          color: 'error',
        });
      }
    } else {
      try {
        const { error } = await supabase.from('external_listing_watchlist').insert({
          user_id: user.id,
          external_listing_id: id,
        });

        if (error) {
          // Handle duplicate key gracefully
          if (error.code === '23505') {
            toast.add({
              title: 'Already Saved',
              description: 'This find is already in your watchlist',
              color: 'info',
            });
            return;
          }
          throw error;
        }

        watchlistedIds.value = [...watchlistedIds.value, id];

        toast.add({
          title: 'Saved',
          description: 'Find added to your watchlist',
          color: 'success',
        });
      } catch (error: any) {
        console.error('Error adding to watchlist:', error);
        toast.add({
          title: 'Error',
          description: 'Failed to add to watchlist',
          color: 'error',
        });
      }
    }
  };

  /**
   * Check if a find is watchlisted by the current user.
   */
  const isWatchlisted = (id: string): boolean => {
    return watchlistedIds.value.includes(id);
  };

  /**
   * Load the current user's liked and watchlisted IDs for O(1) lookups.
   * Call this when the user is authenticated and finds are displayed.
   */
  const loadUserInteractions = async () => {
    const user = getUser();
    if (!user) {
      likedIds.value = [];
      watchlistedIds.value = [];
      return;
    }

    try {
      const [likesResult, watchlistResult] = await Promise.all([
        supabase.from('external_listing_likes').select('external_listing_id').eq('user_id', user.id),
        supabase.from('external_listing_watchlist').select('external_listing_id').eq('user_id', user.id),
      ]);

      if (likesResult.error) throw likesResult.error;
      if (watchlistResult.error) throw watchlistResult.error;

      likedIds.value = (likesResult.data || []).map((r) => r.external_listing_id);
      watchlistedIds.value = (watchlistResult.data || []).map((r) => r.external_listing_id);
    } catch (error: any) {
      console.error('Error loading user interactions:', error);
    }
  };

  /**
   * Delete a user's own pending find.
   */
  const deleteFind = async (id: string) => {
    const user = getUser();
    if (!user) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to delete finds',
        color: 'warning',
      });
      return false;
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      await $fetch(`/api/exchange/external-listings/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // Remove from local state
      finds.value = finds.value.filter((f) => f.id !== id);

      toast.add({
        title: 'Deleted',
        description: 'Your find has been deleted',
        color: 'info',
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting find:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to delete find',
        color: 'error',
      });
      return false;
    }
  };

  // ---- Internal helpers ----

  /**
   * Update the like_count on a find in the local finds array and currentFind.
   */
  function updateFindLikeCount(id: string, delta: number) {
    const idx = finds.value.findIndex((f) => f.id === id);
    const existing = finds.value[idx];
    if (idx !== -1 && existing) {
      finds.value[idx] = {
        ...existing,
        like_count: Math.max(0, existing.like_count + delta),
      };
    }
    const current = currentFind.value;
    if (current && current.id === id) {
      currentFind.value = {
        ...current,
        like_count: Math.max(0, current.like_count + delta),
      };
    }
  }

  /**
   * Get the source_site for a find from local state (for analytics).
   */
  function getSourceSite(id: string): string {
    const find = finds.value.find((f) => f.id === id);
    if (find) return find.source_site;
    if (currentFind.value?.id === id) return currentFind.value.source_site;
    return 'other';
  }

  return {
    // State
    finds,
    currentFind,
    loading,
    submitting,
    totalCount,
    likedIds,
    watchlistedIds,

    // Methods
    fetchFinds,
    fetchFind,
    submitFind,
    toggleLike,
    isLiked,
    toggleWatchlist,
    isWatchlisted,
    loadUserInteractions,
    deleteFind,
  };
};
