export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, any>;
  notify_email: boolean;
  is_active: boolean;
  notified_listing_ids: string[];
  created_at: string;
}

const MAX_SAVED_SEARCHES = 10;

export const useSavedSearches = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();
  const { capture } = usePostHog();

  const savedSearches = ref<SavedSearch[]>([]);
  const loading = ref(false);
  const saving = ref(false);

  /**
   * Fetch all saved searches for the current user
   */
  const fetchSavedSearches = async () => {
    if (!user.value) {
      savedSearches.value = [];
      return;
    }

    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      savedSearches.value = (data as SavedSearch[]) || [];
    } catch (error: any) {
      console.error('Failed to fetch saved searches:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load saved searches',
        color: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  /**
   * Create a new saved search
   * Enforces a client-side max of 10 saved searches
   */
  const createSavedSearch = async (name: string, filters: Record<string, any>): Promise<SavedSearch | null> => {
    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to save searches',
        color: 'warning',
      });
      return null;
    }

    if (savedSearches.value.length >= MAX_SAVED_SEARCHES) {
      toast.add({
        title: 'Limit Reached',
        description: `You can save up to ${MAX_SAVED_SEARCHES} searches. Please delete one before adding another.`,
        color: 'warning',
      });
      return null;
    }

    saving.value = true;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.value.id,
          name,
          filters,
        })
        .select()
        .single();

      if (error) throw error;

      savedSearches.value.unshift(data as SavedSearch);

      capture('saved_search_created', {
        search_name: name,
        filter_count: Object.keys(filters).length,
      });

      toast.add({
        title: 'Search Saved',
        description: 'You will be notified when new listings match your search',
        color: 'success',
      });

      return data as SavedSearch;
    } catch (error: any) {
      console.error('Failed to create saved search:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to save search',
        color: 'error',
      });
      return null;
    } finally {
      saving.value = false;
    }
  };

  /**
   * Toggle the is_active flag on a saved search (optimistic update)
   */
  const toggleActive = async (searchId: string) => {
    if (!user.value) return false;

    const index = savedSearches.value.findIndex((s) => s.id === searchId);
    if (index === -1) return false;

    const previousValue = savedSearches.value[index].is_active;
    const newValue = !previousValue;

    // Optimistic update
    savedSearches.value[index] = { ...savedSearches.value[index], is_active: newValue };

    try {
      const { error } = await supabase
        .from('saved_searches')
        .update({ is_active: newValue })
        .eq('id', searchId)
        .eq('user_id', user.value.id);

      if (error) throw error;

      return true;
    } catch (error: any) {
      // Revert optimistic update
      savedSearches.value[index] = { ...savedSearches.value[index], is_active: previousValue };

      console.error('Failed to toggle saved search:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to update saved search',
        color: 'error',
      });
      return false;
    }
  };

  /**
   * Delete a saved search by id
   */
  const deleteSavedSearch = async (searchId: string) => {
    if (!user.value) return false;

    try {
      const { error } = await supabase.from('saved_searches').delete().eq('id', searchId).eq('user_id', user.value.id);

      if (error) throw error;

      savedSearches.value = savedSearches.value.filter((s) => s.id !== searchId);

      toast.add({
        title: 'Deleted',
        description: 'Saved search has been removed',
        color: 'success',
      });

      return true;
    } catch (error: any) {
      console.error('Failed to delete saved search:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to delete saved search',
        color: 'error',
      });
      return false;
    }
  };

  return {
    savedSearches,
    loading,
    saving,
    fetchSavedSearches,
    createSavedSearch,
    toggleActive,
    deleteSavedSearch,
  };
};
