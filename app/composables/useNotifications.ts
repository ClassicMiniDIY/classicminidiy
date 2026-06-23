export interface NotificationPreferences {
  email_new_messages: boolean;
  email_new_comments: boolean;
  email_comment_replies: boolean;
  email_listing_status: boolean;
  email_weekly_digest: boolean;
  push_new_messages: boolean;
  email_saved_search_matches: boolean;
}

export const useNotifications = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const toast = useToast();

  const preferences = ref<NotificationPreferences | null>(null);
  const loading = ref(true);
  const saving = ref(false);

  /**
   * Fetch notification preferences for current user
   */
  const fetchPreferences = async () => {
    if (!user.value) {
      preferences.value = null;
      return null;
    }

    loading.value = true;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.value.id)
        .maybeSingle();

      if (error) throw error;

      // If no preferences exist yet, create default ones
      if (!data) {
        const { data: newPrefs, error: insertError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.value.id,
            email_new_messages: true,
            email_new_comments: true,
            email_comment_replies: true,
            email_listing_status: true,
            email_weekly_digest: false,
            push_new_messages: true,
            email_saved_search_matches: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        preferences.value = newPrefs;
        return newPrefs;
      }

      preferences.value = data;
      return data;
    } catch (error: any) {
      console.error('Failed to fetch notification preferences:', error);
      toast.add({
        title: 'Error',
        description: 'Failed to load notification preferences',
        color: 'error',
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Update notification preferences
   */
  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user.value) {
      toast.add({
        title: 'Authentication Required',
        description: 'Please sign in to update preferences',
        color: 'warning',
      });
      return false;
    }

    saving.value = true;

    try {
      const { error } = await supabase.from('notification_preferences').update(updates).eq('user_id', user.value.id);

      if (error) throw error;

      // Update local state
      if (preferences.value) {
        preferences.value = { ...preferences.value, ...updates };
      }

      toast.add({
        title: 'Saved',
        description: 'Your notification preferences have been updated',
        color: 'success',
      });

      return true;
    } catch (error: any) {
      console.error('Failed to update notification preferences:', error);
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to save preferences',
        color: 'error',
      });
      return false;
    } finally {
      saving.value = false;
    }
  };

  /**
   * Toggle a specific preference
   */
  const togglePreference = async (key: keyof NotificationPreferences) => {
    if (!preferences.value) return false;

    // v-model has already flipped the value, so use it directly
    const currentValue = preferences.value[key];
    return await updatePreferences({ [key]: currentValue });
  };

  return {
    preferences,
    loading,
    saving,
    fetchPreferences,
    updatePreferences,
    togglePreference,
  };
};
