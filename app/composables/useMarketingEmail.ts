/**
 * Marketing email composer state + actions (/admin/marketing).
 *
 * Reads marketing_emails client-side via the is_admin() RLS SELECT policy
 * (mirrors useNewsletter's newsletter_sends reads); all writes and edge-fn
 * actions go through the allowlist-gated /api/admin/marketing/* proxies with
 * $adminFetch. While a send is running the edge fn checkpoints
 * recipient_count per batch — pollWhileSending() watches the row so the UI
 * shows live progress even after the send proxy times out (the Deno loop
 * outlives the Vercel request window by design).
 */

export type MarketingBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; markdown: string }
  | { type: 'image'; url: string; alt?: string; href?: string }
  | { type: 'button'; href: string; label: string }
  | { type: 'divider' };

export type MarketingEmailStatus = 'draft' | 'sending' | 'sent' | 'partial' | 'failed';

export interface MarketingAudienceCounts {
  profile: number;
  shopify: number;
  ghost: number;
  patreon: number;
  suppressed: number;
  total: number;
}

export interface MarketingEmailRecord {
  id: string;
  subject: string;
  preheader: string | null;
  blocks: MarketingBlock[];
  status: MarketingEmailStatus;
  audience_counts: MarketingAudienceCounts | null;
  total_recipients: number | null;
  recipient_count: number;
  sent_by: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingDraftPayload {
  subject: string;
  preheader?: string;
  blocks: MarketingBlock[];
}

/**
 * Whether the signed-in admin is on the MARKETING_ADMIN_EMAILS allowlist.
 * Cached per session (useState); `allowed` is null until the first check
 * resolves, so gate UI with `allowed === true`. Used by the admin dashboard
 * card, the ExchangeShell sidebar entry, and the /admin/marketing page guard.
 */
export const useMarketingAccess = () => {
  const allowed = useState<boolean | null>('marketing:access', () => null);
  const check = async (): Promise<boolean> => {
    if (allowed.value !== null) return allowed.value;
    try {
      await $adminFetch('/api/admin/marketing/access');
      allowed.value = true;
    } catch {
      allowed.value = false;
    }
    return allowed.value;
  };
  return { allowed, check };
};

export const useMarketingEmail = () => {
  const supabase = useSupabase();
  const toast = useToast();

  const emails = useState<MarketingEmailRecord[]>('marketing:emails', () => []);
  const emailsLoading = ref(false);
  const previewHtml = ref('');
  const previewLoading = ref(false);
  const audience = ref<MarketingAudienceCounts | null>(null);
  const audienceLoading = ref(false);
  const saving = ref(false);
  const sending = ref(false);
  const testSending = ref(false);

  const drafts = computed(() => emails.value.filter((e) => e.status === 'draft'));
  const history = computed(() => emails.value.filter((e) => e.status !== 'draft'));
  const activeSend = computed(() => emails.value.find((e) => e.status === 'sending') ?? null);

  const fetchEmails = async () => {
    emailsLoading.value = true;
    try {
      const { data, error } = await supabase
        .from('marketing_emails')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Generated Row types blocks as Json; the app-level type narrows it.
      emails.value = (data as unknown as MarketingEmailRecord[]) || [];
    } catch (error: any) {
      console.error('Failed to load marketing emails:', error);
      toast.add({ title: 'Error', description: 'Failed to load marketing emails', color: 'error' });
    } finally {
      emailsLoading.value = false;
    }
  };

  const createDraft = async (payload: MarketingDraftPayload): Promise<MarketingEmailRecord | null> => {
    saving.value = true;
    try {
      const row = await $adminFetch<MarketingEmailRecord>('/api/admin/marketing/drafts', {
        method: 'POST',
        body: payload,
      });
      emails.value = [row, ...emails.value];
      toast.add({ title: 'Draft saved', color: 'success' });
      return row;
    } catch (error: any) {
      toast.add({ title: 'Error', description: error?.data?.message || 'Failed to save draft', color: 'error' });
      return null;
    } finally {
      saving.value = false;
    }
  };

  const updateDraft = async (id: string, payload: MarketingDraftPayload): Promise<MarketingEmailRecord | null> => {
    saving.value = true;
    try {
      const row = await $adminFetch<MarketingEmailRecord>(`/api/admin/marketing/drafts/${id}`, {
        method: 'PUT',
        body: payload,
      });
      emails.value = emails.value.map((e) => (e.id === id ? row : e));
      toast.add({ title: 'Draft saved', color: 'success' });
      return row;
    } catch (error: any) {
      toast.add({ title: 'Error', description: error?.data?.message || 'Failed to save draft', color: 'error' });
      return null;
    } finally {
      saving.value = false;
    }
  };

  const deleteDraft = async (id: string): Promise<boolean> => {
    try {
      await $adminFetch(`/api/admin/marketing/drafts/${id}`, { method: 'DELETE' });
      emails.value = emails.value.filter((e) => e.id !== id);
      toast.add({ title: 'Draft deleted', color: 'success' });
      return true;
    } catch (error: any) {
      toast.add({ title: 'Error', description: error?.data?.message || 'Failed to delete draft', color: 'error' });
      return false;
    }
  };

  const fetchPreview = async (payload: MarketingDraftPayload) => {
    previewLoading.value = true;
    try {
      const result = await $adminFetch<{ emailHtml: string }>('/api/admin/marketing/preview', {
        method: 'POST',
        body: payload,
      });
      previewHtml.value = result.emailHtml || '';
    } catch (error: any) {
      // Preview runs debounced on every edit — half-typed content will fail
      // validation constantly, so surface it inline, never as toast spam.
      previewHtml.value = '';
      console.debug('Marketing preview not renderable yet:', error?.data?.message || error?.message);
    } finally {
      previewLoading.value = false;
    }
  };

  const fetchAudience = async (): Promise<MarketingAudienceCounts | null> => {
    audienceLoading.value = true;
    try {
      const result = await $adminFetch<{ counts: MarketingAudienceCounts }>('/api/admin/marketing/audience', {
        timeout: 120_000,
      });
      audience.value = result.counts;
      return result.counts;
    } catch (error: any) {
      toast.add({
        title: 'Error',
        description: error?.data?.message || 'Failed to resolve audience',
        color: 'error',
      });
      return null;
    } finally {
      audienceLoading.value = false;
    }
  };

  const sendTest = async (payload: MarketingDraftPayload, email?: string): Promise<boolean> => {
    testSending.value = true;
    try {
      const result = await $adminFetch<{ success: boolean; sentTo: string }>('/api/admin/marketing/test', {
        method: 'POST',
        body: { ...payload, email },
      });
      toast.add({ title: 'Test sent', description: `Sent to ${result.sentTo}`, color: 'success' });
      return true;
    } catch (error: any) {
      toast.add({ title: 'Error', description: error?.data?.message || 'Failed to send test', color: 'error' });
      return false;
    } finally {
      testSending.value = false;
    }
  };

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  /** Refresh the sending row every 5s until it reaches a terminal status. */
  const pollWhileSending = (id: string) => {
    stopPolling();
    // If the row is still 'draft' after a few polls, the proxy timed out on a
    // request that never reached the edge fn — stop and say so instead of
    // spinning forever.
    let draftPolls = 0;
    pollTimer = setInterval(async () => {
      try {
        const { data: row } = await supabase.from('marketing_emails').select('*').eq('id', id).maybeSingle();
        if (!row) return;
        const data = row as unknown as MarketingEmailRecord;
        emails.value = emails.value.map((e) => (e.id === id ? data : e));
        if (data.status === 'draft') {
          if (++draftPolls >= 3) {
            stopPolling();
            sending.value = false;
            toast.add({ title: 'Send did not start', description: 'Please try again', color: 'error' });
          }
          return;
        }
        if (data.status !== 'sending') {
          stopPolling();
          sending.value = false;
          toast.add({
            title: data.status === 'sent' ? 'Marketing email sent' : `Send finished: ${data.status}`,
            description: `${data.recipient_count}/${data.total_recipients ?? data.recipient_count} delivered`,
            color: data.status === 'sent' ? 'success' : data.status === 'partial' ? 'warning' : 'error',
          });
        }
      } catch {
        // transient — keep polling
      }
    }, 5000);
  };

  const sendMarketingEmail = async (id: string): Promise<boolean> => {
    sending.value = true;
    try {
      const result = await $adminFetch<any>('/api/admin/marketing/send', { method: 'POST', body: { id } });
      await fetchEmails();
      if (result?.polling || emails.value.find((e) => e.id === id)?.status === 'sending') {
        // Proxy timed out (or send still running) — the edge loop continues.
        pollWhileSending(id);
        return true;
      }
      sending.value = false;
      if (result?.success) {
        toast.add({
          title: 'Marketing email sent',
          description: `${result.recipientCount}/${result.totalAttempted} delivered`,
          color: result.status === 'sent' ? 'success' : 'warning',
        });
      }
      return !!result?.success;
    } catch (error: any) {
      sending.value = false;
      const status = error?.statusCode || error?.response?.status;
      toast.add({
        title: status === 429 ? 'Already sent' : 'Send failed',
        description: error?.data?.message || 'Failed to send marketing email',
        color: 'error',
      });
      await fetchEmails();
      return false;
    }
  };

  onUnmounted(stopPolling);

  return {
    emails,
    emailsLoading,
    drafts,
    history,
    activeSend,
    previewHtml,
    previewLoading,
    audience,
    audienceLoading,
    saving,
    sending,
    testSending,
    fetchEmails,
    createDraft,
    updateDraft,
    deleteDraft,
    fetchPreview,
    fetchAudience,
    sendTest,
    sendMarketingEmail,
    pollWhileSending,
  };
};
