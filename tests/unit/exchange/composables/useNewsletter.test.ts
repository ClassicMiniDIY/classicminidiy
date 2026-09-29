import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, mockSession } from '../../../setup/mockSupabase';
import { createMockUser, setupGlobalMocks, cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { NewsletterPreview, NewsletterSendRecord } from '~/app/composables/useNewsletter';

// ---------------------------------------------------------------------------
// useNewsletter (CMDIY exchange admin newsletter composable) depends on:
//   useSupabase  — auth.getSession() for the Bearer header + newsletter_sends
//                  table query in fetchSendHistory.
//   useToast     — success / error / warning / info toasts. NOT stubbed in
//                  vitest.setup, so we stub it here with a controllable handle.
//   $fetch       — global; stubbed per test so we can assert URL/method/
//                  headers/body and drive success vs. error responses.
//
// Auth in this composable is read ONLY through supabase.auth.getSession() (no
// useAuth dependency), so "anonymous" is simulated by making getSession()
// return no session. setupGlobalMocks still wires useAuth/useSupabase; we
// override the supabase handle so we control getSession + the query builder.
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockFetch: ReturnType<typeof vi.fn>;

const AUTH_HEADER = `Bearer ${mockSession.access_token}`;

const createMockPreview = (overrides: Partial<NewsletterPreview> = {}): NewsletterPreview => ({
  listings: [
    {
      id: 'listing-1',
      title: '1973 Mini Cooper S',
      slug: '1973-mini-cooper-s',
      year: 1973,
      model: 'Cooper S',
      price: 25000,
      currency: 'USD',
      location: 'London, UK',
      tier: 'paid',
      description: 'A lovely Mini',
      created_at: new Date().toISOString(),
      primaryPhotoUrl: 'https://example.com/photo.jpg',
    },
  ],
  emailHtml: '<html><body>Newsletter</body></html>',
  premiumCount: 1,
  freeCount: 0,
  totalCount: 1,
  totalPremiumThisWeek: 1,
  totalFreeThisWeek: 0,
  subscriberCount: 100,
  profileSubscriberCount: 60,
  shopifySubscriberCount: 40,
  lastSentAt: null,
  lastSendStatus: null,
  lastRecipientCount: null,
  ...overrides,
});

const createMockSendRecord = (overrides: Partial<NewsletterSendRecord> = {}): NewsletterSendRecord => ({
  id: 'send-1',
  sent_at: new Date().toISOString(),
  sent_by: 'test-user-id',
  recipient_count: 100,
  listing_ids: ['listing-1'],
  premium_count: 1,
  free_count: 0,
  status: 'sent',
  error_message: null,
  ...overrides,
});

// Build a $fetch error shaped the way the composable inspects it:
//   error.statusCode (429 branch) and error.data.message (toast description).
const makeFetchError = (statusCode: number | undefined, message?: string) => {
  const err: any = new Error(message || 'fetch failed');
  if (statusCode !== undefined) err.statusCode = statusCode;
  if (message !== undefined) err.data = { message };
  return err;
};

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockToast = { add: vi.fn() };
  mockFetch = vi.fn().mockResolvedValue({});

  // setupGlobalMocks wires useAuth + useSupabase; override supabase so the
  // getSession + query-builder handles we drive in assertions are the ones the
  // composable actually receives.
  setupGlobalMocks({ user: createMockUser(), supabase: mockSupabase });
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('$fetch', mockFetch);

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const loadComposable = async () => {
  const { useNewsletter } = await import('~/app/composables/useNewsletter');
  return useNewsletter;
};

// Make getSession() return no session (simulates an unauthenticated caller).
const stubAnonSession = () => {
  mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
};

describe('useNewsletter', () => {
  // -------------------------------------------------------------------------
  // initial state / surface
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('exposes all expected members with sane defaults', async () => {
      const useNewsletter = await loadComposable();
      const nl = useNewsletter();

      // state
      expect(nl.loading.value).toBe(false);
      expect(nl.sending.value).toBe(false);
      expect(nl.testSending.value).toBe(false);
      expect(nl.preview.value).toBeNull();
      expect(nl.sendHistory.value).toEqual([]);
      expect(nl.historyLoading.value).toBe(false);

      // computeds (no preview yet)
      expect(nl.canSendNewsletter.value).toBe(true);
      expect(nl.daysUntilNextSend.value).toBe(0);

      // actions
      expect(typeof nl.fetchPreview).toBe('function');
      expect(typeof nl.sendTestEmail).toBe('function');
      expect(typeof nl.sendToAllSubscribers).toBe('function');
      expect(typeof nl.fetchSendHistory).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // fetchPreview()
  // -------------------------------------------------------------------------
  describe('fetchPreview()', () => {
    it('GETs /api/admin/exchange/newsletter/preview with the Bearer auth header', async () => {
      const preview = createMockPreview();
      mockFetch.mockResolvedValueOnce(preview);

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/admin/exchange/newsletter/preview');
      // GET request: no method passed.
      expect(opts.method).toBeUndefined();
      expect(opts.headers).toEqual({ Authorization: AUTH_HEADER });
      expect(opts.body).toBeUndefined();
    });

    it('stores the result in preview and returns it', async () => {
      const preview = createMockPreview({ subscriberCount: 250 });
      mockFetch.mockResolvedValueOnce(preview);

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.fetchPreview();

      expect(result).toEqual(preview);
      expect(nl.preview.value).toEqual(preview);
    });

    it('toggles loading true during the call and false after', async () => {
      let resolveFetch!: (v: any) => void;
      mockFetch.mockReturnValueOnce(new Promise((res) => (resolveFetch = res)));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const promise = nl.fetchPreview();
      expect(nl.loading.value).toBe(true);

      resolveFetch(createMockPreview());
      await promise;
      expect(nl.loading.value).toBe(false);
    });

    it('returns null, shows an error toast, and does not set preview when not authenticated', async () => {
      stubAnonSession();

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.fetchPreview();

      expect(result).toBeNull();
      expect(nl.preview.value).toBeNull();
      // getAuthHeader returns null -> throws before $fetch is called.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
      expect(nl.loading.value).toBe(false);
    });

    it('returns null and shows an error toast with the server message when $fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(makeFetchError(500, 'Server exploded'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.fetchPreview();

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Server exploded',
        color: 'error',
      });
      expect(nl.loading.value).toBe(false);
    });

    it('falls back to a default description when the error has no data.message', async () => {
      mockFetch.mockRejectedValueOnce(new Error('boom'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load newsletter preview',
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // sendTestEmail()
  // -------------------------------------------------------------------------
  describe('sendTestEmail()', () => {
    it('POSTs to /api/admin/exchange/newsletter/test with the auth header and the email body', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, sentTo: 'admin@cmdiy.com', listingCount: 3 });

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendTestEmail('admin@cmdiy.com');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/admin/exchange/newsletter/test');
      expect(opts.method).toBe('POST');
      expect(opts.headers).toEqual({ Authorization: AUTH_HEADER });
      expect(opts.body).toEqual({ email: 'admin@cmdiy.com' });
    });

    it('sends an empty body object when no email is provided', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, sentTo: 'default@cmdiy.com', listingCount: 1 });

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendTestEmail();

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.body).toEqual({});
    });

    it('returns true and shows a success toast naming the recipient', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, sentTo: 'admin@cmdiy.com', listingCount: 3 });

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendTestEmail('admin@cmdiy.com');

      expect(result).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Test Email Sent',
        description: 'Newsletter preview sent to admin@cmdiy.com',
        color: 'success',
      });
    });

    it('toggles testSending during the call', async () => {
      let resolveFetch!: (v: any) => void;
      mockFetch.mockReturnValueOnce(new Promise((res) => (resolveFetch = res)));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const promise = nl.sendTestEmail('x@y.com');
      expect(nl.testSending.value).toBe(true);

      resolveFetch({ success: true, sentTo: 'x@y.com', listingCount: 0 });
      await promise;
      expect(nl.testSending.value).toBe(false);
    });

    it('returns false and shows an error toast when not authenticated', async () => {
      stubAnonSession();

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendTestEmail('x@y.com');

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to Send', color: 'error' })
      );
      expect(nl.testSending.value).toBe(false);
    });

    it('returns false and shows the server error message on $fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(makeFetchError(400, 'No subscribers configured'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendTestEmail('x@y.com');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Failed to Send',
        description: 'No subscribers configured',
        color: 'error',
      });
    });

    it('falls back to a default description when the error has no data.message', async () => {
      mockFetch.mockRejectedValueOnce(new Error('boom'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendTestEmail('x@y.com');

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Failed to Send',
        description: 'Could not send test email',
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // sendToAllSubscribers()
  // -------------------------------------------------------------------------
  describe('sendToAllSubscribers()', () => {
    // The happy path triggers fetchPreview() + fetchSendHistory() afterward,
    // so we resolve the send $fetch, then the refresh fetchPreview $fetch.
    const stubSendThenRefresh = (sendResult: any) => {
      mockFetch
        .mockResolvedValueOnce(sendResult) // POST /send
        .mockResolvedValueOnce(createMockPreview()); // GET /preview (refresh)
      // fetchSendHistory uses the supabase query builder, not $fetch.
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));
    };

    it('POSTs to /api/admin/exchange/newsletter/send with the auth header and forceOverride body (default false)', async () => {
      stubSendThenRefresh({ success: true, status: 'sending', totalAttempted: 100, listingCount: 5, sendId: 's1' });

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendToAllSubscribers();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/admin/exchange/newsletter/send');
      expect(opts.method).toBe('POST');
      expect(opts.headers).toEqual({ Authorization: AUTH_HEADER });
      expect(opts.body).toEqual({ forceOverride: false });
    });

    it('passes forceOverride: true through to the body when requested', async () => {
      stubSendThenRefresh({ success: true, status: 'sending', totalAttempted: 50, listingCount: 2, sendId: 's2' });

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendToAllSubscribers(true);

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.body).toEqual({ forceOverride: true });
    });

    it('returns true, shows an info toast with the attempted count, and refreshes preview + history', async () => {
      stubSendThenRefresh({ success: true, status: 'sending', totalAttempted: 123, listingCount: 5, sendId: 's3' });

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendToAllSubscribers();

      expect(result).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Newsletter Sending',
        description: 'Sending to 123 subscribers in the background. Refresh the page to check progress.',
        color: 'info',
      });

      // Refresh fan-out: send POST + preview GET were both $fetch'd.
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toBe('/api/admin/exchange/newsletter/preview');
      // fetchSendHistory hit the newsletter_sends table.
      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_sends');
    });

    it('toggles sending during the call', async () => {
      let resolveSend!: (v: any) => void;
      mockFetch
        .mockReturnValueOnce(new Promise((res) => (resolveSend = res)))
        .mockResolvedValueOnce(createMockPreview());
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const promise = nl.sendToAllSubscribers();
      expect(nl.sending.value).toBe(true);

      resolveSend({ success: true, status: 'sending', totalAttempted: 1, listingCount: 0, sendId: 's' });
      await promise;
      expect(nl.sending.value).toBe(false);
    });

    it('returns false and shows an error toast when not authenticated', async () => {
      stubAnonSession();

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendToAllSubscribers();

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to Send', color: 'error' })
      );
      expect(nl.sending.value).toBe(false);
    });

    it('shows the "Already Sent" warning toast on a 429 (sent too recently) and does NOT refresh', async () => {
      mockFetch.mockRejectedValueOnce(makeFetchError(429, 'Newsletter already sent this week'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendToAllSubscribers();

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Already Sent',
        description: 'Newsletter already sent this week',
        color: 'warning',
      });
      // Only the failed send POST happened — no preview refresh.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('429 warning falls back to a default description when error has no data.message', async () => {
      mockFetch.mockRejectedValueOnce(makeFetchError(429));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendToAllSubscribers();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Already Sent',
        description: 'Newsletter was sent recently',
        color: 'warning',
      });
    });

    it('shows a generic error toast (not the 429 warning) on a non-429 failure', async () => {
      mockFetch.mockRejectedValueOnce(makeFetchError(500, 'SES outage'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.sendToAllSubscribers();

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Failed to Send',
        description: 'SES outage',
        color: 'error',
      });
      expect(mockToast.add).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Already Sent' }));
    });

    it('non-429 error falls back to a default description when error has no data.message', async () => {
      mockFetch.mockRejectedValueOnce(new Error('boom'));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.sendToAllSubscribers();

      expect(mockToast.add).toHaveBeenCalledWith({
        title: 'Failed to Send',
        description: 'Could not send newsletter',
        color: 'error',
      });
    });
  });

  // -------------------------------------------------------------------------
  // fetchSendHistory()
  // -------------------------------------------------------------------------
  describe('fetchSendHistory()', () => {
    it('queries newsletter_sends ordered by sent_at desc limited to 10', async () => {
      const records = [createMockSendRecord({ id: 's1' }), createMockSendRecord({ id: 's2' })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: records, error: null }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.fetchSendHistory();

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_sends');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('sent_at', { ascending: false });
      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(records);
      expect(nl.sendHistory.value).toEqual(records);
    });

    it('stores an empty array when the query returns null data', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.fetchSendHistory();

      expect(result).toEqual([]);
      expect(nl.sendHistory.value).toEqual([]);
    });

    it('toggles historyLoading during the call', async () => {
      let resolveQuery!: (v: any) => void;
      const queryResolved = new Promise<void>((res) => (resolveQuery = res));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => queryResolved.then(() => resolve({ data: [], error: null })));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const promise = nl.fetchSendHistory();
      expect(nl.historyLoading.value).toBe(true);

      resolveQuery();
      await promise;
      expect(nl.historyLoading.value).toBe(false);
    });

    it('returns [] and does NOT toast on a Supabase error (non-critical)', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'permission denied' } })
      );

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      const result = await nl.fetchSendHistory();

      expect(result).toEqual([]);
      expect(mockToast.add).not.toHaveBeenCalled();
      expect(nl.historyLoading.value).toBe(false);
    });

    it('does not require the Bearer header (uses the auto-authed PostgREST client)', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchSendHistory();

      // Pure Supabase path — no $fetch and no getSession call.
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // canSendNewsletter (computed) — 6-day cooldown
  // -------------------------------------------------------------------------
  describe('canSendNewsletter', () => {
    it('is true when there is no preview', async () => {
      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      expect(nl.canSendNewsletter.value).toBe(true);
    });

    it('is true when lastSentAt is null', async () => {
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: null }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.canSendNewsletter.value).toBe(true);
    });

    it('is false when the last send was within the last 6 days', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      // Sent 3 days ago -> still inside the 6-day cooldown.
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: '2026-06-25T12:00:00Z' }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.canSendNewsletter.value).toBe(false);
    });

    it('is true when the last send was more than 6 days ago', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      // Sent 7 days ago -> outside the 6-day cooldown.
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: '2026-06-21T12:00:00Z' }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.canSendNewsletter.value).toBe(true);
    });

    it('is false exactly at the 6-day boundary (cooldown is strict <)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      // Sent exactly 6 days ago. sixDaysAgo === lastSent, and lastSent < sixDaysAgo
      // is false, so it cannot send yet.
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: '2026-06-22T12:00:00Z' }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.canSendNewsletter.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // daysUntilNextSend (computed) — 7-day window, ceil, floored at 0
  // -------------------------------------------------------------------------
  describe('daysUntilNextSend', () => {
    it('is 0 when there is no preview', async () => {
      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      expect(nl.daysUntilNextSend.value).toBe(0);
    });

    it('is 0 when lastSentAt is null', async () => {
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: null }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.daysUntilNextSend.value).toBe(0);
    });

    it('returns the days remaining in the 7-day window after a recent send', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      // Sent 2 days ago -> next allowed in 5 days.
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: '2026-06-26T12:00:00Z' }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.daysUntilNextSend.value).toBe(5);
    });

    it('ceils partial days up', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      // Sent at 06-26 13:00Z -> nextAllowed = 07-03 13:00Z; now = 06-28 12:00Z.
      // Remaining = 5 days + 1 hour = 5.04 days -> Math.ceil -> 6.
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: '2026-06-26T13:00:00Z' }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.daysUntilNextSend.value).toBe(6);
    });

    it('is floored at 0 once the 7-day window has fully elapsed', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));

      // Sent 10 days ago -> window passed -> Math.max(0, negative) -> 0.
      mockFetch.mockResolvedValueOnce(createMockPreview({ lastSentAt: '2026-06-18T12:00:00Z' }));

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(nl.daysUntilNextSend.value).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // cross-cutting: the auth header reflects the live session token
  // -------------------------------------------------------------------------
  describe('auth header sourcing', () => {
    it('builds the Bearer header from supabase.auth.getSession() on each call', async () => {
      mockSupabase.auth.getSession = vi
        .fn()
        .mockResolvedValue({ data: { session: { access_token: 'rotated-token' } }, error: null });
      mockFetch.mockResolvedValueOnce(createMockPreview());

      const useNewsletter = await loadComposable();
      const nl = useNewsletter();
      await nl.fetchPreview();

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers).toEqual({ Authorization: 'Bearer rotated-token' });
    });
  });
});
