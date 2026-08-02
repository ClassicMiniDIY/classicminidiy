import type { Database } from '~~/types/database';

type TargetType = Database['public']['Enums']['target_type_enum'];

export interface MostWantedRequest {
  id: string;
  title: string;
  notes: string | null;
  target_type: TargetType | null;
  target_id: string | null;
  ask_count: number;
  asked_by_me: boolean;
  created_at: string;
}

/**
 * "Most Wanted" — archive gaps the community has asked for (design S6).
 *
 * Reads go through `get_most_wanted()` rather than selecting the table so the
 * "have I already asked for this?" flag comes back in the same round trip.
 * Writes go through `request_archive_item()`, which is where the one-ask-per-
 * account rule lives — ask_count is never client-writable.
 */
export const useArchiveRequests = () => {
  const supabase = useSupabase();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const { track } = useAnalytics();

  const requests = useState<MostWantedRequest[]>('archive:most-wanted', () => []);
  const loading = ref(false);
  const submitting = ref(false);

  const load = async (limit = 5) => {
    loading.value = true;
    try {
      const { data, error } = await supabase.rpc('get_most_wanted', { p_limit: limit });
      if (error) throw error;
      requests.value = (data ?? []) as MostWantedRequest[];
    } catch (error) {
      console.error('Failed to load Most Wanted:', error);
      requests.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Create the request, or add this account's +1 to an existing one. Idempotent
   * per account server-side, so a double click cannot inflate the count.
   */
  const requestItem = async (options: {
    title: string;
    notes?: string | null;
    targetType?: TargetType | null;
    targetId?: string | null;
    source?: 'manual' | 'search_miss' | 'gap';
  }) => {
    if (!isAuthenticated.value) {
      await navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } });
      return null;
    }

    submitting.value = true;
    try {
      const { data, error } = await supabase.rpc('request_archive_item', {
        p_title: options.title,
        p_notes: options.notes ?? null,
        p_target_type: options.targetType ?? null,
        p_target_id: options.targetId ?? null,
        p_source: options.source ?? 'manual',
      });
      if (error) throw error;

      track('archive_request_created', { title: options.title, source: options.source ?? 'manual' });
      toast.add({
        title: 'Added to Most Wanted',
        description: 'We will surface it to the community — you will see it on the archive home.',
        color: 'success',
        icon: 'fas fa-circle-check',
      });

      await load(requests.value.length || 5);
      return data;
    } catch (error: any) {
      console.error('Failed to record archive request:', error);
      toast.add({
        title: 'Could not save that request',
        description: error?.message ?? 'Please try again in a moment.',
        color: 'error',
        icon: 'fas fa-circle-exclamation',
      });
      return null;
    } finally {
      submitting.value = false;
    }
  };

  return { requests, loading, submitting, load, requestItem };
};
