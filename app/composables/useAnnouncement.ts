type AnnouncementType = 'error' | 'warning' | 'info' | 'success';

export interface SiteAnnouncement {
  id: number;
  title: string | null;
  description: string | null;
  type: AnnouncementType;
  is_enabled: boolean;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Cache for SSR/client hydration
let announcementCache: { data: SiteAnnouncement | null; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute cache

export const useAnnouncement = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { handleError } = useErrorHandler();

  /**
   * Get the current site announcement (public, cached)
   */
  const getAnnouncement = async (): Promise<SiteAnnouncement | null> => {
    // Check cache first
    if (announcementCache && Date.now() - announcementCache.timestamp < CACHE_TTL) {
      return announcementCache.data;
    }

    try {
      const { data, error } = await supabase.from('site_announcements').select('*').eq('id', 1).single();

      if (error) {
        // Table might not exist yet if migration hasn't run
        if (error.code === 'PGRST116' || error.code === '42P01') {
          return null;
        }
        throw error;
      }

      const announcement = data as SiteAnnouncement;
      announcementCache = { data: announcement, timestamp: Date.now() };
      return announcement;
    } catch (error) {
      console.error('Failed to fetch announcement:', error);
      return null;
    }
  };

  /**
   * Get enabled announcement only (for display)
   * Returns null if disabled or missing both title and description
   */
  const getActiveAnnouncement = async (): Promise<SiteAnnouncement | null> => {
    const announcement = await getAnnouncement();
    if (!announcement?.is_enabled) return null;
    // Require at least title OR description
    if (!announcement.title && !announcement.description) return null;
    return announcement;
  };

  /**
   * Update the announcement (admin only)
   */
  const updateAnnouncement = async (
    updates: Partial<Pick<SiteAnnouncement, 'title' | 'description' | 'type' | 'is_enabled'>>
  ): Promise<SiteAnnouncement> => {
    try {
      if (!user.value) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase
        .from('site_announcements')
        .update({
          ...updates,
          updated_by: user.value.id,
        })
        .eq('id', 1)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Invalidate cache
      announcementCache = null;

      return data as SiteAnnouncement;
    } catch (error) {
      handleError(error, {
        toastTitle: 'Failed to Update Announcement',
        rethrow: true,
      });
      throw error;
    }
  };

  /**
   * Clear the cache (useful after admin updates)
   */
  const invalidateCache = () => {
    announcementCache = null;
  };

  return {
    getAnnouncement,
    getActiveAnnouncement,
    updateAnnouncement,
    invalidateCache,
  };
};
