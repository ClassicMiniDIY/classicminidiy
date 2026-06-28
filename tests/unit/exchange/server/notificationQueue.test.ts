/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the service-role Supabase client.
//
// notificationQueue.ts imports `getServiceClient` from '../supabase' (relative);
// the `~~/` alias resolves to the same absolute module, so this mock intercepts
// it. The query builder is chainable: select/eq return `this`, insert resolves
// to { error } and the profiles select resolves via the awaited builder (.then).
// ---------------------------------------------------------------------------

// notification_queue.insert(...) — resolves to { error } by default (success).
const mockInsert = vi.fn().mockResolvedValue({ error: null });

// profiles select chain: .select().eq().eq() then awaited -> { data, error }.
// We control the awaited result via mockAdminThen.
const mockAdminThen = vi.fn((resolve: (v: any) => any) => resolve({ data: [], error: null }));
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();

const profilesBuilder: Record<string, any> = {
  select: mockSelect,
  eq: mockEq,
  then: mockAdminThen,
};

const notificationBuilder: Record<string, any> = {
  insert: mockInsert,
};

// `from('notification_queue')` returns the insert builder; `from('profiles')`
// returns the chainable select builder.
const mockFrom = vi.fn((table: string) => (table === 'profiles' ? profilesBuilder : notificationBuilder));

const mockSupabase = { from: mockFrom };

vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

import { buildBatchKey, queueNotification, queueAdminNotification } from '~~/server/utils/exchange/notificationQueue';
import type { EventType } from '~~/server/utils/exchange/notificationQueue';

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish default resolved values cleared by clearAllMocks.
  mockInsert.mockResolvedValue({ error: null });
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockAdminThen.mockImplementation((resolve: (v: any) => any) => resolve({ data: [], error: null }));
});

// ===========================================================================
// buildBatchKey — pure, every EventType branch
// ===========================================================================
describe('buildBatchKey', () => {
  it.each<[EventType, Record<string, string>, string]>([
    ['new_message', { conversationId: 'c1' }, 'msg:c1'],
    ['new_comment', { listingId: 'l1' }, 'comment:l1'],
    ['comment_reply', { parentCommentId: 'p1' }, 'reply:p1'],
    ['listing_status', { listingId: 'l2' }, 'status:l2'],
    ['saved_search_match', { userId: 'u1' }, 'saved_search:u1'],
    ['listing_submitted', { listingId: 'l3' }, 'listing_submitted:l3'],
    ['seller_inquiry', { inquiryId: 'i1' }, 'seller_inquiry:i1'],
    ['watchlist_sold', { listingId: 'l4' }, 'watchlist_sold:l4'],
    ['price_drop', { listingId: 'l5' }, 'price_drop:l5'],
  ])('maps %s to the correct prefixed key', (eventType, context, expected) => {
    expect(buildBatchKey(eventType, context)).toBe(expected);
  });

  it('covers every documented EventType (no branch missed)', () => {
    const all: EventType[] = [
      'new_message',
      'new_comment',
      'comment_reply',
      'listing_status',
      'saved_search_match',
      'listing_submitted',
      'seller_inquiry',
      'watchlist_sold',
      'price_drop',
    ];
    // Each produces a unique, defined key with the documented prefix shape.
    const keys = all.map((t) => buildBatchKey(t, { conversationId: 'x', listingId: 'x', parentCommentId: 'x', userId: 'x', inquiryId: 'x' }));
    expect(keys).toHaveLength(9);
    keys.forEach((k) => expect(typeof k).toBe('string'));
    // All distinct prefixes -> distinct keys for the same context.
    expect(new Set(keys).size).toBe(9);
  });

  describe('boundary / edge context values', () => {
    it('emits "undefined" literal when the expected context field is missing', () => {
      // Template literal interpolation of undefined -> the string "undefined".
      expect(buildBatchKey('new_message', {})).toBe('msg:undefined');
      expect(buildBatchKey('new_comment', {})).toBe('comment:undefined');
      expect(buildBatchKey('seller_inquiry', {})).toBe('seller_inquiry:undefined');
    });

    it('ignores unrelated context fields and uses only the relevant one', () => {
      expect(buildBatchKey('listing_status', { listingId: 'L', conversationId: 'NOPE', userId: 'NOPE' })).toBe('status:L');
    });

    it('preserves empty-string ids verbatim', () => {
      expect(buildBatchKey('price_drop', { listingId: '' })).toBe('price_drop:');
    });

    it('preserves unicode and very long ids verbatim', () => {
      const long = 'a'.repeat(500);
      expect(buildBatchKey('comment_reply', { parentCommentId: long })).toBe(`reply:${long}`);
      expect(buildBatchKey('watchlist_sold', { listingId: '日本-🚗' })).toBe('watchlist_sold:日本-🚗');
    });

    it('seller_inquiry keys are unique per inquiry (never collide across inquiries)', () => {
      const a = buildBatchKey('seller_inquiry', { inquiryId: 'inq-1' });
      const b = buildBatchKey('seller_inquiry', { inquiryId: 'inq-2' });
      expect(a).not.toBe(b);
      expect(a).toBe('seller_inquiry:inq-1');
    });
  });
});

// ===========================================================================
// queueNotification — single-recipient insert
// ===========================================================================
describe('queueNotification', () => {
  it('inserts a row with the correct payload shape into notification_queue', async () => {
    await queueNotification({
      userId: 'user-1',
      eventType: 'new_message',
      payload: { foo: 'bar' },
      channel: 'push',
      batchKey: 'msg:c1',
    });

    expect(mockFrom).toHaveBeenCalledWith('notification_queue');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      event_type: 'new_message',
      payload: { foo: 'bar' },
      channel: 'push',
      batch_key: 'msg:c1',
    });
  });

  it('defaults channel to "email" when omitted', async () => {
    await queueNotification({
      userId: 'user-2',
      eventType: 'price_drop',
      payload: { price: 100 },
      batchKey: 'price_drop:l5',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email', user_id: 'user-2', event_type: 'price_drop', batch_key: 'price_drop:l5' })
    );
  });

  it.each<['email' | 'push' | 'both']>([['email'], ['push'], ['both']])(
    'passes through the explicit channel "%s"',
    async (channel) => {
      await queueNotification({
        userId: 'u',
        eventType: 'listing_status',
        payload: {},
        channel,
        batchKey: 'status:l',
      });
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ channel }));
    }
  );

  it('forwards an empty payload object as-is', async () => {
    await queueNotification({ userId: 'u', eventType: 'new_comment', payload: {}, batchKey: 'comment:l1' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ payload: {} }));
  });

  it('returns void (resolves to undefined) on success', async () => {
    const result = await queueNotification({ userId: 'u', eventType: 'new_message', payload: {}, batchKey: 'k' });
    expect(result).toBeUndefined();
  });

  describe('fire-and-forget error handling', () => {
    it('logs but does not throw when insert resolves with an error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInsert.mockResolvedValueOnce({ error: { message: 'db boom' } });

      await expect(
        queueNotification({ userId: 'u', eventType: 'new_message', payload: {}, batchKey: 'k' })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Failed to insert notification:', { message: 'db boom' });
      spy.mockRestore();
    });

    it('swallows a thrown error from insert (never rejects)', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInsert.mockRejectedValueOnce(new Error('network down'));

      await expect(
        queueNotification({ userId: 'u', eventType: 'new_message', payload: {}, batchKey: 'k' })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Unexpected error queueing notification:', expect.any(Error));
      spy.mockRestore();
    });

    it('swallows a synchronous throw from getServiceClient (never rejects)', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getServiceClient } = await import('~~/server/utils/supabase');
      vi.mocked(getServiceClient).mockImplementationOnce(() => {
        throw new Error('no service key');
      });

      await expect(
        queueNotification({ userId: 'u', eventType: 'new_message', payload: {}, batchKey: 'k' })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Unexpected error queueing notification:', expect.any(Error));
      spy.mockRestore();
    });
  });
});

// ===========================================================================
// queueAdminNotification — admin fan-out
// ===========================================================================
describe('queueAdminNotification', () => {
  const setAdmins = (admins: Array<{ id: string }> | null, error: any = null) => {
    mockAdminThen.mockImplementation((resolve: (v: any) => any) => resolve({ data: admins, error }));
  };

  it('queries active (non-banned) admins from profiles', async () => {
    setAdmins([{ id: 'a1' }]);
    await queueAdminNotification({ eventType: 'admin_listing_pending', payload: { x: 1 } });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockEq).toHaveBeenCalledWith('is_admin', true);
    expect(mockEq).toHaveBeenCalledWith('is_banned', false);
  });

  it('fans out one row per admin, all sharing the default batch key (= eventType)', async () => {
    setAdmins([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);
    await queueAdminNotification({ eventType: 'admin_wanted_pending', payload: { listingId: 'L' } });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const rows = mockInsert.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    expect(rows).toEqual([
      { user_id: 'a1', event_type: 'admin_wanted_pending', payload: { listingId: 'L' }, channel: 'email', batch_key: 'admin_wanted_pending' },
      { user_id: 'a2', event_type: 'admin_wanted_pending', payload: { listingId: 'L' }, channel: 'email', batch_key: 'admin_wanted_pending' },
      { user_id: 'a3', event_type: 'admin_wanted_pending', payload: { listingId: 'L' }, channel: 'email', batch_key: 'admin_wanted_pending' },
    ]);
    // Shared batch key across all rows.
    expect(new Set(rows.map((r: any) => r.batch_key)).size).toBe(1);
  });

  it('always uses the "email" channel for admin rows', async () => {
    setAdmins([{ id: 'a1' }, { id: 'a2' }]);
    await queueAdminNotification({ eventType: 'admin_find_pending', payload: {} });
    const rows = mockInsert.mock.calls[0][0];
    rows.forEach((r: any) => expect(r.channel).toBe('email'));
  });

  it('uses a custom batchKey when provided (overrides the eventType default)', async () => {
    setAdmins([{ id: 'a1' }, { id: 'a2' }]);
    await queueAdminNotification({ eventType: 'admin_listing_pending', payload: {}, batchKey: 'custom-window-key' });
    const rows = mockInsert.mock.calls[0][0];
    rows.forEach((r: any) => expect(r.batch_key).toBe('custom-window-key'));
  });

  it('inserts into notification_queue (not profiles)', async () => {
    setAdmins([{ id: 'a1' }]);
    await queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} });
    // from() called for both profiles (select) and notification_queue (insert).
    expect(mockFrom).toHaveBeenCalledWith('notification_queue');
  });

  describe('no-op short circuits', () => {
    it('does NOT insert when there are no admins (empty array)', async () => {
      setAdmins([]);
      await queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} });
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('does NOT insert when admins is null', async () => {
      setAdmins(null);
      await queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} });
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('fire-and-forget error handling', () => {
    it('logs and returns without inserting when the admin lookup errors', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAdmins(null, { message: 'select failed' });

      await expect(
        queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Failed to resolve admins:', { message: 'select failed' });
      expect(mockInsert).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logs but does not throw when the fan-out insert errors', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAdmins([{ id: 'a1' }]);
      mockInsert.mockResolvedValueOnce({ error: { message: 'insert failed' } });

      await expect(
        queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Failed to insert admin notifications:', { message: 'insert failed' });
      spy.mockRestore();
    });

    it('swallows a thrown error from the admin query (never rejects)', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAdminThen.mockImplementationOnce(() => {
        throw new Error('query exploded');
      });

      await expect(
        queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Unexpected error queueing admin notification:', expect.any(Error));
      spy.mockRestore();
    });

    it('swallows a synchronous throw from getServiceClient (never rejects)', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getServiceClient } = await import('~~/server/utils/supabase');
      vi.mocked(getServiceClient).mockImplementationOnce(() => {
        throw new Error('no service key');
      });

      await expect(
        queueAdminNotification({ eventType: 'admin_listing_pending', payload: {} })
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith('[NotificationQueue] Unexpected error queueing admin notification:', expect.any(Error));
      spy.mockRestore();
    });
  });
});
