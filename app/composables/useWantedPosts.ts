/**
 * Composable for managing Wanted Posts (Classic Mini parts/vehicles wanted ads)
 *
 * Provides CRUD operations, filtering, pagination, and status management
 * for the wanted_posts table. Uses server API endpoints for create/update/delete
 * (with server-side sanitization and moderation) and direct Supabase queries for reads.
 */

export interface WantedPost {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  parts_subcategory?: string | null;
  condition_preference: string;
  budget_min?: number | null;
  budget_max?: number | null;
  currency: string;
  city?: string | null;
  state_province?: string | null;
  country?: string | null;
  status: string;
  moderation_status: string;
  moderation_issues?: string[] | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export interface WantedPostFilters {
  search?: string;
  category?: string;
  conditionPreference?: string;
  budgetMin?: number;
  budgetMax?: number;
  country?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'newest' | 'oldest' | 'budget_high' | 'budget_low';
}

export interface CreateWantedPostData {
  title: string;
  description: string;
  category: string;
  partsSubcategory?: string | null;
  conditionPreference?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  city?: string | null;
  stateProvince?: string | null;
  country?: string | null;
}

export interface UpdateWantedPostData {
  title?: string;
  description?: string;
  category?: string;
  partsSubcategory?: string | null;
  conditionPreference?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  city?: string | null;
  stateProvince?: string | null;
  country?: string | null;
}

export const useWantedPosts = () => {
  const supabase = useSupabase();
  const toast = useToast();
  const { handleError } = useErrorHandler();
  const { capture } = usePostHog();

  // Lazy-load auth only when needed (for create/update/delete operations)
  // This allows public pages to browse wanted posts without requiring authentication
  const getUser = () => {
    const { user } = useAuth();
    return user.value;
  };

  /**
   * Resolve the current Supabase session access token, or surface a "Session
   * Expired" toast and return null. Used by every mutating operation to
   * authenticate against the server endpoints.
   */
  async function getAccessTokenOrWarn(action: string): Promise<string | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      toast.add({
        title: 'Session Expired',
        description: `Please sign in again to ${action}`,
        color: 'warning',
      });
      return null;
    }
    return accessToken;
  }

  // Reactive state
  const wantedPosts = ref<WantedPost[]>([]);
  const currentPost = ref<WantedPost | null>(null);
  const loading = ref(false);
  const totalCount = ref(0);

  /**
   * Fetch wanted posts with filters, search, and pagination.
   * Only returns active + approved posts for public browsing.
   */
  async function fetchWantedPosts(filters?: WantedPostFilters) {
    loading.value = true;

    try {
      const page = filters?.page ?? 1;
      const perPage = filters?.perPage ?? 20;
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from('wanted_posts')
        .select('*, profiles:public_profiles!wanted_posts_user_id_fkey(id, display_name, username, avatar_url)', {
          count: 'exact',
        })
        .eq('status', 'active')
        .eq('moderation_status', 'approved');

      // Search filter (title + description)
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Category filter
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      // Condition preference filter
      if (filters?.conditionPreference) {
        query = query.eq('condition_preference', filters.conditionPreference);
      }

      // Budget range filters
      if (filters?.budgetMin !== undefined) {
        query = query.gte('budget_max', filters.budgetMin);
      }
      if (filters?.budgetMax !== undefined) {
        query = query.lte('budget_min', filters.budgetMax);
      }

      // Country filter
      if (filters?.country) {
        query = query.ilike('country', `%${filters.country}%`);
      }

      // Sorting
      const sortBy = filters?.sortBy ?? 'newest';
      switch (sortBy) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'budget_high':
          query = query.order('budget_max', { ascending: false, nullsFirst: false });
          break;
        case 'budget_low':
          query = query.order('budget_min', { ascending: true, nullsFirst: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      wantedPosts.value = (data as unknown as WantedPost[]) || [];
      totalCount.value = count ?? 0;

      return wantedPosts.value;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to load wanted posts' });
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch a single wanted post by ID with profile join.
   */
  async function fetchWantedPost(id: string) {
    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('wanted_posts')
        .select('*, profiles:public_profiles!wanted_posts_user_id_fkey(id, display_name, username, avatar_url)')
        .eq('id', id)
        .single();

      if (error) throw error;

      currentPost.value = data as unknown as WantedPost;
      return currentPost.value;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to load wanted post' });
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch the current user's wanted posts for their dashboard.
   * Shows all statuses (not filtered to active/approved) so the user
   * can manage their own flagged, fulfilled, or expired posts.
   */
  async function fetchUserWantedPosts(userId?: string) {
    loading.value = true;

    try {
      const user = getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wanted_posts')
        .select('*, profiles:public_profiles!wanted_posts_user_id_fkey(id, display_name, username, avatar_url)')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      wantedPosts.value = (data as unknown as WantedPost[]) || [];
      return wantedPosts.value;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to load your wanted posts' });
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Create a new wanted post via server API (handles sanitization + moderation).
   */
  async function createWantedPost(postData: CreateWantedPostData) {
    try {
      const user = getUser();
      if (!user) {
        toast.add({
          title: 'Authentication Required',
          description: 'Please sign in to create a wanted post',
          color: 'warning',
        });
        return null;
      }

      const accessToken = await getAccessTokenOrWarn('create a wanted post');
      if (!accessToken) return null;

      const response = await $fetch('/api/wanted/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          title: postData.title,
          description: postData.description,
          category: postData.category,
          partsSubcategory: postData.partsSubcategory,
          conditionPreference: postData.conditionPreference,
          budgetMin: postData.budgetMin,
          budgetMax: postData.budgetMax,
          currency: postData.currency,
          city: postData.city,
          stateProvince: postData.stateProvince,
          country: postData.country,
        },
      });

      const createdPost = response.post as WantedPost;

      // Track analytics
      capture('wanted_post_created', {
        wanted_post_id: createdPost.id,
        category: createdPost.category,
        has_budget: createdPost.budget_min !== null || createdPost.budget_max !== null,
        has_location: !!createdPost.city || !!createdPost.country,
      });

      if (response.flagged) {
        toast.add({
          title: 'Post Created',
          description: 'Your wanted post was created but flagged for review due to content moderation.',
          color: 'warning',
        });
      } else {
        toast.add({
          title: 'Wanted Post Created',
          description: 'Your wanted post is now live!',
          color: 'success',
        });
      }

      return createdPost;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to create wanted post' });
      return null;
    }
  }

  /**
   * Update an existing wanted post via server API (handles sanitization + moderation).
   */
  async function updateWantedPost(id: string, postData: UpdateWantedPostData) {
    try {
      const user = getUser();
      if (!user) {
        toast.add({
          title: 'Authentication Required',
          description: 'Please sign in to update your wanted post',
          color: 'warning',
        });
        return null;
      }

      const accessToken = await getAccessTokenOrWarn('update your wanted post');
      if (!accessToken) return null;

      const response = await $fetch(`/api/wanted/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          title: postData.title,
          description: postData.description,
          category: postData.category,
          partsSubcategory: postData.partsSubcategory,
          conditionPreference: postData.conditionPreference,
          budgetMin: postData.budgetMin,
          budgetMax: postData.budgetMax,
          currency: postData.currency,
          city: postData.city,
          stateProvince: postData.stateProvince,
          country: postData.country,
        },
      });

      const updatedPost = response.post as WantedPost;

      // Update local state if this post is in the list
      const index = wantedPosts.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        wantedPosts.value[index] = updatedPost;
      }

      // Update currentPost if it matches
      if (currentPost.value?.id === id) {
        currentPost.value = updatedPost;
      }

      // Track analytics
      capture('wanted_post_edited', {
        wanted_post_id: id,
      });

      if (response.flagged) {
        toast.add({
          title: 'Post Updated',
          description: 'Your wanted post was updated but flagged for review due to content moderation.',
          color: 'warning',
        });
      } else {
        toast.add({
          title: 'Wanted Post Updated',
          description: 'Your changes have been saved.',
          color: 'success',
        });
      }

      return updatedPost;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to update wanted post' });
      return null;
    }
  }

  /**
   * Delete a wanted post via server API.
   */
  async function deleteWantedPost(id: string) {
    try {
      const user = getUser();
      if (!user) {
        toast.add({
          title: 'Authentication Required',
          description: 'Please sign in to delete your wanted post',
          color: 'warning',
        });
        return false;
      }

      const accessToken = await getAccessTokenOrWarn('delete your wanted post');
      if (!accessToken) return false;

      await $fetch(`/api/wanted/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Remove from local state
      wantedPosts.value = wantedPosts.value.filter((p) => p.id !== id);

      // Clear currentPost if it matches
      if (currentPost.value?.id === id) {
        currentPost.value = null;
      }

      // Track analytics
      capture('wanted_post_deleted', {
        wanted_post_id: id,
      });

      toast.add({
        title: 'Wanted Post Deleted',
        description: 'Your wanted post has been removed.',
        color: 'info',
      });

      return true;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to delete wanted post' });
      return false;
    }
  }

  /**
   * Mark a wanted post as fulfilled (the user found what they were looking for).
   */
  async function markFulfilled(id: string) {
    try {
      const user = getUser();
      if (!user) {
        toast.add({
          title: 'Authentication Required',
          description: 'Please sign in to update your wanted post',
          color: 'warning',
        });
        return false;
      }

      const { data, error } = await supabase
        .from('wanted_posts')
        .update({ status: 'fulfilled' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const index = wantedPosts.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        wantedPosts.value[index] = data as unknown as WantedPost;
      }

      if (currentPost.value?.id === id) {
        currentPost.value = data as unknown as WantedPost;
      }

      // Track analytics
      capture('wanted_post_fulfilled', {
        wanted_post_id: id,
      });

      toast.add({
        title: 'Marked as Fulfilled',
        description: 'Glad you found what you were looking for!',
        color: 'success',
      });

      return true;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to mark as fulfilled' });
      return false;
    }
  }

  /**
   * Renew a wanted post by extending the expiration by 90 days from now
   * and setting status back to active.
   */
  async function renewWantedPost(id: string) {
    try {
      const user = getUser();
      if (!user) {
        toast.add({
          title: 'Authentication Required',
          description: 'Please sign in to renew your wanted post',
          color: 'warning',
        });
        return false;
      }

      // Calculate new expiry: 90 days from now
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 90);

      const { data, error } = await supabase
        .from('wanted_posts')
        .update({
          expires_at: newExpiresAt.toISOString(),
          status: 'active',
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const index = wantedPosts.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        wantedPosts.value[index] = data as unknown as WantedPost;
      }

      if (currentPost.value?.id === id) {
        currentPost.value = data as unknown as WantedPost;
      }

      // Track analytics
      capture('wanted_post_renewed', {
        wanted_post_id: id,
      });

      toast.add({
        title: 'Wanted Post Renewed',
        description: 'Your wanted post has been renewed for another 90 days.',
        color: 'success',
      });

      return true;
    } catch (error) {
      handleError(error, { toastTitle: 'Failed to renew wanted post' });
      return false;
    }
  }

  return {
    // State
    wantedPosts,
    currentPost,
    loading,
    totalCount,

    // Methods
    fetchWantedPosts,
    fetchWantedPost,
    fetchUserWantedPosts,
    createWantedPost,
    updateWantedPost,
    deleteWantedPost,
    markFulfilled,
    renewWantedPost,
  };
};
