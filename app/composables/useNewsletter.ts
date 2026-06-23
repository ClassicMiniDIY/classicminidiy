/**
 * Newsletter listing type for admin preview
 */
export interface NewsletterPreviewListing {
  id: string;
  title: string;
  slug: string;
  year: number | null;
  model: string;
  price: number | null;
  currency: string;
  location: string;
  tier: 'free' | 'paid';
  description?: string;
  created_at: string;
  primaryPhotoUrl: string | null;
}

/**
 * Newsletter preview response from API
 */
export interface NewsletterPreview {
  listings: NewsletterPreviewListing[];
  emailHtml: string;
  premiumCount: number;
  freeCount: number;
  totalCount: number;
  totalPremiumThisWeek: number;
  totalFreeThisWeek: number;
  subscriberCount: number;
  profileSubscriberCount: number;
  shopifySubscriberCount: number;
  lastSentAt: string | null;
  lastSendStatus: 'sent' | 'failed' | 'partial' | null;
  lastRecipientCount: number | null;
}

/**
 * Newsletter send history record
 */
export interface NewsletterSendRecord {
  id: string;
  sent_at: string;
  sent_by: string;
  recipient_count: number;
  listing_ids: string[];
  premium_count: number;
  free_count: number;
  status: 'sending' | 'sent' | 'failed' | 'partial';
  error_message: string | null;
}

/**
 * Composable for managing the weekly newsletter admin features
 */
export const useNewsletter = () => {
  const supabase = useSupabase();
  const toast = useToast();

  const loading = ref(false);
  const sending = ref(false);
  const testSending = ref(false);
  const preview = ref<NewsletterPreview | null>(null);
  const sendHistory = ref<NewsletterSendRecord[]>([]);
  const historyLoading = ref(false);

  /**
   * Get authorization header for API requests
   */
  const getAuthHeader = async (): Promise<string | null> => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    return token ? `Bearer ${token}` : null;
  };

  /**
   * Fetch newsletter preview data
   */
  const fetchPreview = async (): Promise<NewsletterPreview | null> => {
    loading.value = true;

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        throw new Error('Not authenticated');
      }

      const data = await $fetch<NewsletterPreview>('/api/admin/exchange/newsletter/preview', {
        headers: {
          Authorization: authHeader,
        },
      });

      preview.value = data;
      return data;
    } catch (error: any) {
      console.error('Failed to fetch newsletter preview:', error);
      toast.add({
        title: 'Error',
        description: error?.data?.message || 'Failed to load newsletter preview',
        color: 'error',
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Send test newsletter email
   */
  const sendTestEmail = async (email?: string): Promise<boolean> => {
    testSending.value = true;

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        throw new Error('Not authenticated');
      }

      const result = await $fetch<{ success: boolean; sentTo: string; listingCount: number }>(
        '/api/admin/exchange/newsletter/test',
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
          },
          body: email ? { email } : {},
        }
      );

      toast.add({
        title: 'Test Email Sent',
        description: `Newsletter preview sent to ${result.sentTo}`,
        color: 'success',
      });

      return true;
    } catch (error: any) {
      console.error('Failed to send test newsletter:', error);
      toast.add({
        title: 'Failed to Send',
        description: error?.data?.message || 'Could not send test email',
        color: 'error',
      });
      return false;
    } finally {
      testSending.value = false;
    }
  };

  /**
   * Send newsletter to all subscribers
   */
  const sendToAllSubscribers = async (forceOverride = false): Promise<boolean> => {
    sending.value = true;

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        throw new Error('Not authenticated');
      }

      const result = await $fetch<{
        success: boolean;
        status: 'sending' | 'sent' | 'failed' | 'partial';
        totalAttempted: number;
        listingCount: number;
        sendId: string;
      }>('/api/admin/exchange/newsletter/send', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
        body: { forceOverride },
      });

      toast.add({
        title: 'Newsletter Sending',
        description: `Sending to ${result.totalAttempted} subscribers in the background. Refresh the page to check progress.`,
        color: 'info',
      });

      // Refresh to show the 'sending' record in history
      await fetchPreview();
      await fetchSendHistory();

      return true;
    } catch (error: any) {
      console.error('Failed to send newsletter:', error);

      // Check if it's a rate limit error (sent too recently)
      if (error?.statusCode === 429) {
        toast.add({
          title: 'Already Sent',
          description: error?.data?.message || 'Newsletter was sent recently',
          color: 'warning',
        });
      } else {
        toast.add({
          title: 'Failed to Send',
          description: error?.data?.message || 'Could not send newsletter',
          color: 'error',
        });
      }
      return false;
    } finally {
      sending.value = false;
    }
  };

  /**
   * Fetch newsletter send history
   */
  const fetchSendHistory = async (): Promise<NewsletterSendRecord[]> => {
    historyLoading.value = true;

    try {
      const { data, error } = await supabase
        .from('newsletter_sends')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      sendHistory.value = (data as NewsletterSendRecord[]) || [];
      return sendHistory.value;
    } catch (error: any) {
      console.error('Failed to fetch send history:', error);
      // Don't show toast for this - it's not critical
      return [];
    } finally {
      historyLoading.value = false;
    }
  };

  /**
   * Check if newsletter can be sent (not sent within last 6 days)
   */
  const canSendNewsletter = computed(() => {
    if (!preview.value?.lastSentAt) return true;

    const lastSent = new Date(preview.value.lastSentAt);
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    return lastSent < sixDaysAgo;
  });

  /**
   * Get days until next allowed send
   */
  const daysUntilNextSend = computed(() => {
    if (!preview.value?.lastSentAt) return 0;

    const lastSent = new Date(preview.value.lastSentAt);
    const nextAllowed = new Date(lastSent);
    nextAllowed.setDate(nextAllowed.getDate() + 7);

    const now = new Date();
    const diffTime = nextAllowed.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  });

  return {
    // State
    loading,
    sending,
    testSending,
    preview,
    sendHistory,
    historyLoading,

    // Computed
    canSendNewsletter,
    daysUntilNextSend,

    // Actions
    fetchPreview,
    sendTestEmail,
    sendToAllSubscribers,
    fetchSendHistory,
  };
};
