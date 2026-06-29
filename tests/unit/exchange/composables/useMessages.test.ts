import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';

// useMessages depends on:
//  - useSupabase / useAuth         (stubbed via setupGlobalMocks-style stubbing)
//  - useToast                      (real CMDIY composable — must be stubbed)
//  - usePostHog                    (globally stubbed in vitest.setup, re-stubbed here for capture spying)
//  - $fetch                        (globally stubbed in vitest.setup)
//  - useMessageAttachments         (real composable — stubbed for the attachment path)
//  - ~/utils/moderation            (real, exercised for validation/moderation behavior)

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockCapture: ReturnType<typeof vi.fn>;

const stubAuth = (userValue: any) => {
  vi.stubGlobal('useAuth', () => ({ user: { value: userValue } }));
};

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockToast = { add: vi.fn() };
  mockCapture = vi.fn();

  // The shared mock query builder lacks .or()/.lt() (used by useMessages).
  // Add them as chainable spies that return the builder, matching the other
  // chainable methods. Both are also thenable via _queryBuilder.then, so list
  // queries terminating on these still resolve.
  mockSupabase._queryBuilder.or = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  mockSupabase._queryBuilder.lt = vi.fn().mockReturnValue(mockSupabase._queryBuilder);

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => mockToast);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  // Default authed user
  stubAuth(createMockUser());
  // $fetch is globally stubbed in vitest.setup; reset to a benign resolved value
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}));
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
});

const importComposable = async () => {
  const mod = await import('~/app/composables/useMessages');
  return mod.useMessages;
};

describe('useMessages', () => {
  // ---------------------------------------------------------------------------
  // exposed surface
  // ---------------------------------------------------------------------------
  describe('exposed surface', () => {
    it('exposes loading/sending refs and all methods', async () => {
      const useMessages = await importComposable();
      const m = useMessages();

      expect(m.loading.value).toBe(false);
      expect(m.sending.value).toBe(false);
      expect(typeof m.fetchConversations).toBe('function');
      expect(typeof m.fetchConversation).toBe('function');
      expect(typeof m.fetchMessages).toBe('function');
      expect(typeof m.startConversation).toBe('function');
      expect(typeof m.sendMessage).toBe('function');
      expect(typeof m.markAsRead).toBe('function');
      expect(typeof m.getUnreadCount).toBe('function');
      expect(typeof m.getOtherParticipant).toBe('function');
      expect(typeof m.reportMessage).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchConversations()
  // ---------------------------------------------------------------------------
  describe('fetchConversations()', () => {
    it('fetches conversations for logged-in user filtered by buyer_id/seller_id', async () => {
      const conversations = [
        {
          id: 'conv-1',
          listing_id: 'listing-1',
          buyer_id: 'test-user-id',
          seller_id: 'seller-1',
          last_message_at: new Date().toISOString(),
          buyer_unread_count: 2,
          seller_unread_count: 0,
        },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: conversations, error: null }));

      const useMessages = await importComposable();
      const { fetchConversations, loading } = useMessages();
      const result = await fetchConversations();

      expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.or).toHaveBeenCalledWith(
        'buyer_id.eq.test-user-id,seller_id.eq.test-user-id'
      );
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('last_message_at', { ascending: false });
      expect(result).toEqual(conversations);
      // loading flag reset in finally
      expect(loading.value).toBe(false);
    });

    it('returns [] without touching supabase when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { fetchConversations } = useMessages();
      const result = await fetchConversations();

      expect(result).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns [] (coalesced from null) on success with null data', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useMessages = await importComposable();
      const { fetchConversations } = useMessages();
      const result = await fetchConversations();

      expect(result).toEqual([]);
      expect(mockToast.add).not.toHaveBeenCalled();
    });

    it('returns [] and shows an error toast on failure', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'Database error' } })
      );

      const useMessages = await importComposable();
      const { fetchConversations, loading } = useMessages();
      const result = await fetchConversations();

      expect(result).toEqual([]);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
      expect(loading.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchConversation()
  // ---------------------------------------------------------------------------
  describe('fetchConversation()', () => {
    it('fetches a single conversation by id', async () => {
      const conversation = { id: 'conv-1', buyer_id: 'test-user-id', seller_id: 'seller-1' };
      mockSupabase._mockSingle.mockResolvedValue({ data: conversation, error: null });

      const useMessages = await importComposable();
      const { fetchConversation } = useMessages();
      const result = await fetchConversation('conv-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'conv-1');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(conversation);
    });

    it('returns null without querying when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { fetchConversation } = useMessages();
      const result = await fetchConversation('conv-1');

      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns null and toasts on error', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const useMessages = await importComposable();
      const { fetchConversation } = useMessages();
      const result = await fetchConversation('conv-1');

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // fetchMessages()
  // ---------------------------------------------------------------------------
  describe('fetchMessages()', () => {
    it('fetches a page, reverses to chronological order, and reports hasMore=false', async () => {
      // Returned newest-first; fewer than PAGE_SIZE+1 ⇒ hasMore=false
      const messages = [
        { id: 'msg-2', conversation_id: 'conv-1', created_at: '2026-01-01T00:00:01Z' },
        { id: 'msg-1', conversation_id: 'conv-1', created_at: '2026-01-01T00:00:00Z' },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: messages, error: null }));

      const useMessages = await importComposable();
      const { fetchMessages } = useMessages();
      const result = await fetchMessages('conv-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('conversation_id', 'conv-1');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      // PAGE_SIZE (50) + 1 to detect hasMore
      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(51);
      // reversed to oldest-first
      expect(result.messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
      expect(result.hasMore).toBe(false);
    });

    it('detects hasMore and trims to the page size when an extra row is returned', async () => {
      const messages = Array.from({ length: 51 }, (_, i) => ({
        id: `msg-${i}`,
        conversation_id: 'conv-1',
        created_at: new Date(2026, 0, 1, 0, 0, 50 - i).toISOString(),
      }));
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: messages, error: null }));

      const useMessages = await importComposable();
      const { fetchMessages } = useMessages();
      const result = await fetchMessages('conv-1');

      expect(result.hasMore).toBe(true);
      expect(result.messages).toHaveLength(50);
    });

    it('honors a custom limit (limit+1 requested)', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const useMessages = await importComposable();
      const { fetchMessages } = useMessages();
      await fetchMessages('conv-1', { limit: 10 });

      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(11);
    });

    it('applies the before cursor with lt()', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const useMessages = await importComposable();
      const { fetchMessages } = useMessages();
      await fetchMessages('conv-1', { before: '2026-01-01T00:00:00Z' });

      expect(mockSupabase._queryBuilder.lt).toHaveBeenCalledWith('created_at', '2026-01-01T00:00:00Z');
    });

    it('returns empty result without querying when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { fetchMessages } = useMessages();
      const result = await fetchMessages('conv-1');

      expect(result).toEqual({ messages: [], hasMore: false });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns empty result and toasts on error', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'Database error' } })
      );

      const useMessages = await importComposable();
      const { fetchMessages } = useMessages();
      const result = await fetchMessages('conv-1');

      expect(result).toEqual({ messages: [], hasMore: false });
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // startConversation()
  // ---------------------------------------------------------------------------
  describe('startConversation()', () => {
    it('returns the id of an existing conversation (listing-based)', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-conv' }, error: null });

      const useMessages = await importComposable();
      const { startConversation, sending } = useMessages();
      const result = await startConversation({ listingId: 'listing-1', recipientId: 'seller-1' });

      expect(result).toBe('existing-conv');
      expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('buyer_id', 'test-user-id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('seller_id', 'seller-1');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('listing_id', 'listing-1');
      expect(sending.value).toBe(false);
    });

    it('filters by wanted_post_id when wantedPostId is provided', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-conv' }, error: null });

      const useMessages = await importComposable();
      const { startConversation } = useMessages();
      await startConversation({ wantedPostId: 'wp-1', recipientId: 'seller-1' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('wanted_post_id', 'wp-1');
      expect(mockSupabase._queryBuilder.eq).not.toHaveBeenCalledWith('listing_id', expect.anything());
    });

    it('creates a new conversation when none exists', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      mockSupabase._mockSingle.mockResolvedValue({ data: { id: 'new-conv' }, error: null });

      const useMessages = await importComposable();
      const { startConversation } = useMessages();
      const result = await startConversation({ listingId: 'listing-1', recipientId: 'seller-1' });

      expect(result).toBe('new-conv');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        listing_id: 'listing-1',
        wanted_post_id: null,
        buyer_id: 'test-user-id',
        seller_id: 'seller-1',
      });
    });

    it('inserts null listing_id when only a wantedPostId is supplied', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      mockSupabase._mockSingle.mockResolvedValue({ data: { id: 'new-conv' }, error: null });

      const useMessages = await importComposable();
      const { startConversation } = useMessages();
      await startConversation({ wantedPostId: 'wp-1', recipientId: 'seller-1' });

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        listing_id: null,
        wanted_post_id: 'wp-1',
        buyer_id: 'test-user-id',
        seller_id: 'seller-1',
      });
    });

    it('warns and returns null when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { startConversation } = useMessages();
      const result = await startConversation({ listingId: 'listing-1', recipientId: 'seller-1' });

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Required', color: 'warning' })
      );
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('blocks messaging yourself', async () => {
      const useMessages = await importComposable();
      const { startConversation } = useMessages();
      const result = await startConversation({ listingId: 'listing-1', recipientId: 'test-user-id' });

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invalid Action',
          description: 'You cannot message yourself',
          color: 'error',
        })
      );
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns null and toasts when the insert errors', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

      const useMessages = await importComposable();
      const { startConversation, sending } = useMessages();
      const result = await startConversation({ listingId: 'listing-1', recipientId: 'seller-1' });

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
      expect(sending.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sendMessage()
  // ---------------------------------------------------------------------------
  describe('sendMessage()', () => {
    const okInsert = () => mockSupabase._mockSingle.mockResolvedValue({ data: { id: 'msg-1' }, error: null });

    it('returns false without sending when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'Hello there');

      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('inserts a trimmed message and returns true', async () => {
      okInsert();

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', '  Hello, is this still available?  ');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        conversation_id: 'conv-1',
        sender_id: 'test-user-id',
        content: 'Hello, is this still available?',
      });
    });

    it('captures message_sent with first-message context', async () => {
      okInsert();

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      await sendMessage('conv-1', 'Hello there', {
        conversation: { listing_id: 'listing-1' },
        existingMessageCount: 0,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'message_sent',
        expect.objectContaining({
          conversation_id: 'conv-1',
          listing_id: 'listing-1',
          is_first_message: true,
        })
      );
    });

    it('marks is_first_message=false when prior messages exist', async () => {
      okInsert();

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      await sendMessage('conv-1', 'Hello there', { existingMessageCount: 3 });

      expect(mockCapture).toHaveBeenCalledWith(
        'message_sent',
        expect.objectContaining({ is_first_message: false })
      );
    });

    it('rejects an empty message', async () => {
      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', '');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Invalid Message', color: 'error' })
      );
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('rejects a too-short message (< 2 chars)', async () => {
      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'a');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Invalid Message', color: 'error' })
      );
    });

    it('rejects a too-long message (> MAX_CONTENT_LENGTH)', async () => {
      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'a'.repeat(2001));

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Invalid Message', color: 'error' })
      );
    });

    it('warns about moderation issues (phone number) but still sends', async () => {
      okInsert();

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'Call me at 123-456-7890');

      expect(result).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Message Flagged', color: 'warning' })
      );
      expect(mockSupabase._mockInsert).toHaveBeenCalled();
    });

    it('queues a notification with the bearer token and a 200-char preview', async () => {
      okInsert();
      const longContent = 'x'.repeat(250);

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      await sendMessage('conv-1', longContent);

      expect($fetch).toHaveBeenCalledWith(
        '/api/exchange/notifications/queue-message',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer mock-access-token' },
          body: { conversationId: 'conv-1', messagePreview: 'x'.repeat(200) },
        })
      );
    });

    it('skips the notification fetch when there is no access token', async () => {
      okInsert();
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'Hello there');

      expect(result).toBe(true);
      expect($fetch).not.toHaveBeenCalled();
    });

    it('uploads attachments and captures message_image_uploaded', async () => {
      okInsert();
      const attachToMessage = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('useMessageAttachments', () => ({ attachToMessage }));

      const attachments = [{ file: new File(['x'], 'a.jpg', { type: 'image/jpeg' }), width: 100, height: 100 }];

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'Photo of the part', { attachments });

      expect(result).toBe(true);
      expect(attachToMessage).toHaveBeenCalledWith('conv-1', 'msg-1', attachments);
      expect(mockCapture).toHaveBeenCalledWith(
        'message_image_uploaded',
        expect.objectContaining({ conversation_id: 'conv-1', count: 1 })
      );
    });

    it('keeps the text message but warns when attachment upload fails', async () => {
      okInsert();
      const attachToMessage = vi.fn().mockRejectedValue(new Error('upload boom'));
      vi.stubGlobal('useMessageAttachments', () => ({ attachToMessage }));

      const attachments = [{ file: new File(['x'], 'a.jpg', { type: 'image/jpeg' }), width: 100, height: 100 }];

      const useMessages = await importComposable();
      const { sendMessage } = useMessages();
      const result = await sendMessage('conv-1', 'Photo of the part', { attachments });

      expect(result).toBe(true);
      expect(mockCapture).toHaveBeenCalledWith(
        'message_image_upload_failed',
        expect.objectContaining({ conversation_id: 'conv-1', error: 'upload boom' })
      );
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Images not attached', color: 'warning' })
      );
    });

    it('returns false, toasts, and captures message_failed when the insert errors', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

      const useMessages = await importComposable();
      const { sendMessage, sending } = useMessages();
      const result = await sendMessage('conv-1', 'Hello there');

      expect(result).toBe(false);
      expect(mockCapture).toHaveBeenCalledWith(
        'message_failed',
        expect.objectContaining({ conversation_id: 'conv-1', error_type: 'insert failed' })
      );
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
      expect(sending.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // markAsRead()
  // ---------------------------------------------------------------------------
  describe('markAsRead()', () => {
    it('calls the mark_messages_as_read RPC with conversation + user id', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      const useMessages = await importComposable();
      const { markAsRead } = useMessages();
      await markAsRead('conv-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_messages_as_read', {
        p_conversation_id: 'conv-1',
        p_user_id: 'test-user-id',
      });
    });

    it('does nothing when not authenticated', async () => {
      stubAuth(null);
      mockSupabase.rpc = vi.fn();

      const useMessages = await importComposable();
      const { markAsRead } = useMessages();
      await markAsRead('conv-1');

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('swallows errors silently (background op — no toast)', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: { message: 'rpc failed' } });

      const useMessages = await importComposable();
      const { markAsRead } = useMessages();
      await expect(markAsRead('conv-1')).resolves.toBeUndefined();
      expect(mockToast.add).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getUnreadCount()
  // ---------------------------------------------------------------------------
  describe('getUnreadCount()', () => {
    it('sums buyer_unread_count when the user is the buyer', async () => {
      const conversations = [
        { buyer_id: 'test-user-id', seller_id: 's1', buyer_unread_count: 3, seller_unread_count: 9 },
        { buyer_id: 'test-user-id', seller_id: 's2', buyer_unread_count: 2, seller_unread_count: 7 },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: conversations, error: null }));

      const useMessages = await importComposable();
      const { getUnreadCount } = useMessages();
      const count = await getUnreadCount();

      expect(count).toBe(5);
    });

    it('sums seller_unread_count when the user is the seller', async () => {
      const conversations = [
        { buyer_id: 'b1', seller_id: 'test-user-id', buyer_unread_count: 9, seller_unread_count: 4 },
        { buyer_id: 'b2', seller_id: 'test-user-id', buyer_unread_count: 7, seller_unread_count: 1 },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: conversations, error: null }));

      const useMessages = await importComposable();
      const { getUnreadCount } = useMessages();
      const count = await getUnreadCount();

      expect(count).toBe(5);
    });

    it('mixes buyer and seller roles across conversations', async () => {
      const conversations = [
        { buyer_id: 'test-user-id', seller_id: 's1', buyer_unread_count: 2, seller_unread_count: 99 },
        { buyer_id: 'b1', seller_id: 'test-user-id', buyer_unread_count: 99, seller_unread_count: 3 },
        // user is neither buyer nor seller — should contribute 0
        { buyer_id: 'b2', seller_id: 's2', buyer_unread_count: 50, seller_unread_count: 50 },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: conversations, error: null }));

      const useMessages = await importComposable();
      const { getUnreadCount } = useMessages();
      const count = await getUnreadCount();

      expect(count).toBe(5);
    });

    it('returns 0 when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { getUnreadCount } = useMessages();
      const count = await getUnreadCount();

      expect(count).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns 0 when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const useMessages = await importComposable();
      const { getUnreadCount } = useMessages();
      const count = await getUnreadCount();

      expect(count).toBe(0);
    });

    it('returns 0 on error', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'boom' } })
      );

      const useMessages = await importComposable();
      const { getUnreadCount } = useMessages();
      const count = await getUnreadCount();

      expect(count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getOtherParticipant()  (synchronous)
  // ---------------------------------------------------------------------------
  describe('getOtherParticipant()', () => {
    it('returns the seller when the current user is the buyer', async () => {
      const useMessages = await importComposable();
      const { getOtherParticipant } = useMessages();

      const result = getOtherParticipant({
        buyer_id: 'test-user-id',
        seller_id: 'seller-1',
        seller: { id: 'seller-1', display_name: 'John Seller', username: 'jseller' },
      } as any);

      expect(result).toEqual({ name: 'John Seller', id: 'seller-1' });
    });

    it('returns the buyer when the current user is the seller', async () => {
      const useMessages = await importComposable();
      const { getOtherParticipant } = useMessages();

      const result = getOtherParticipant({
        buyer_id: 'buyer-1',
        seller_id: 'test-user-id',
        buyer: { id: 'buyer-1', display_name: 'Jane Buyer', username: 'jbuyer' },
      } as any);

      expect(result).toEqual({ name: 'Jane Buyer', id: 'buyer-1' });
    });

    it('falls back to username when display_name is missing', async () => {
      const useMessages = await importComposable();
      const { getOtherParticipant } = useMessages();

      const result = getOtherParticipant({
        buyer_id: 'buyer-1',
        seller_id: 'test-user-id',
        buyer: { id: 'buyer-1', display_name: null, username: 'mini_fan_99' },
      } as any);

      expect(result).toEqual({ name: 'mini_fan_99', id: 'buyer-1' });
    });

    it('falls back to "Anonymous" and never leaks an email', async () => {
      const useMessages = await importComposable();
      const { getOtherParticipant } = useMessages();

      const result = getOtherParticipant({
        buyer_id: 'buyer-1',
        seller_id: 'test-user-id',
        buyer: { id: 'buyer-1', display_name: null, username: null, email: 'private@example.com' },
      } as any);

      expect(result).toEqual({ name: 'Anonymous', id: 'buyer-1' });
      expect(result?.name).not.toContain('@');
      expect(result?.name).not.toContain('private');
    });

    it('returns null when not authenticated', async () => {
      stubAuth(null);

      const useMessages = await importComposable();
      const { getOtherParticipant } = useMessages();

      const result = getOtherParticipant({ buyer_id: 'buyer-1', seller_id: 'seller-1' } as any);

      expect(result).toBeNull();
    });

    it('returns null when the matching participant record is absent', async () => {
      const useMessages = await importComposable();
      const { getOtherParticipant } = useMessages();

      // user is buyer but seller relation missing ⇒ no branch matches
      const result = getOtherParticipant({
        buyer_id: 'test-user-id',
        seller_id: 'seller-1',
        seller: undefined,
      } as any);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // reportMessage()
  // ---------------------------------------------------------------------------
  describe('reportMessage()', () => {
    it('calls the report_message RPC and returns true on success', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      const useMessages = await importComposable();
      const { reportMessage } = useMessages();
      const result = await reportMessage('msg-1', 'conv-1', 'spam');

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('report_message', {
        p_message_id: 'msg-1',
        p_reason: 'spam',
      });
      expect(mockCapture).toHaveBeenCalledWith(
        'message_reported',
        expect.objectContaining({ message_id: 'msg-1', conversation_id: 'conv-1' })
      );
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Message Reported', color: 'success' })
      );
    });

    it('returns false without RPC when not authenticated', async () => {
      stubAuth(null);
      mockSupabase.rpc = vi.fn();

      const useMessages = await importComposable();
      const { reportMessage } = useMessages();
      const result = await reportMessage('msg-1', 'conv-1', 'spam');

      expect(result).toBe(false);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('handles an "Already reported" error gracefully (info toast, returns false)', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: { message: 'Already reported by this user' } });

      const useMessages = await importComposable();
      const { reportMessage } = useMessages();
      const result = await reportMessage('msg-1', 'conv-1', 'spam');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Already Reported', color: 'info' })
      );
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('returns false and toasts on a generic error', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: { message: 'rpc exploded' } });

      const useMessages = await importComposable();
      const { reportMessage } = useMessages();
      const result = await reportMessage('msg-1', 'conv-1', 'spam');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
    });
  });
});
