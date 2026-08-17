import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/** Make the `conversations` select resolve with these rows. */
const resolveConversationsWith = (rows: any[]) => {
  mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));
};

beforeEach(async () => {
  vi.resetModules();
  (global as any).__resetNuxtState();
  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useToast', () => ({ add: vi.fn(), remove: vi.fn() }));
  // Auto-imported at runtime, so it has to be provided here. The REAL one, not
  // a fake: the buyer-vs-seller column choice is the thing under test, and it
  // lives in useMessages().getUnreadCount().
  const { useMessages } = await import('~/app/composables/useMessages');
  vi.stubGlobal('useMessages', useMessages);
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.restoreAllMocks();
});

describe('useUnreadMessages', () => {
  it('stays at zero and issues no query when signed out', async () => {
    vi.stubGlobal('useAuth', () => createMockAuth(null));

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    const { unreadCount, refresh } = useUnreadMessages();
    await refresh();

    expect(unreadCount.value).toBe(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('counts the buyer column on conversations where the user is the buyer', async () => {
    const user = createMockUser();
    vi.stubGlobal('useAuth', () => createMockAuth(user));
    resolveConversationsWith([
      { buyer_id: user.id, seller_id: 'someone-else', buyer_unread_count: 3, seller_unread_count: 9 },
    ]);

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    const { unreadCount, refresh } = useUnreadMessages();
    await refresh();

    expect(unreadCount.value).toBe(3);
  });

  it('counts the seller column on conversations where the user is the seller', async () => {
    const user = createMockUser();
    vi.stubGlobal('useAuth', () => createMockAuth(user));
    resolveConversationsWith([
      { buyer_id: 'someone-else', seller_id: user.id, buyer_unread_count: 9, seller_unread_count: 4 },
    ]);

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    const { unreadCount, refresh } = useUnreadMessages();
    await refresh();

    expect(unreadCount.value).toBe(4);
  });

  it('sums across both roles', async () => {
    const user = createMockUser();
    vi.stubGlobal('useAuth', () => createMockAuth(user));
    resolveConversationsWith([
      { buyer_id: user.id, seller_id: 'a', buyer_unread_count: 2, seller_unread_count: 100 },
      { buyer_id: 'b', seller_id: user.id, buyer_unread_count: 100, seller_unread_count: 5 },
    ]);

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    const { unreadCount, refresh } = useUnreadMessages();
    await refresh();

    expect(unreadCount.value).toBe(7);
  });

  it('shares one count between callers, so the header and the drawer never disagree', async () => {
    const user = createMockUser();
    vi.stubGlobal('useAuth', () => createMockAuth(user));
    resolveConversationsWith([{ buyer_id: user.id, seller_id: 'a', buyer_unread_count: 6, seller_unread_count: 0 }]);

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    const header = useUnreadMessages();
    const drawer = useUnreadMessages();
    await header.refresh();

    expect(drawer.unreadCount.value).toBe(6);
  });

  it('opens exactly one realtime channel for the signed-in user', async () => {
    const user = createMockUser();
    vi.stubGlobal('useAuth', () => createMockAuth(user));
    resolveConversationsWith([]);

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    useUnreadMessages().start();
    useUnreadMessages().start();
    await nextTick();

    expect(mockSupabase._mockChannel).toHaveBeenCalledTimes(1);
    expect(mockSupabase._mockChannel).toHaveBeenCalledWith(`unread-messages:${user.id}`);
    // One subscription per role — a conversation can reach the user either way.
    expect(mockSupabase._mockChannelOn).toHaveBeenCalledTimes(2);
  });

  it('drops the channel and zeroes the count on sign-out', async () => {
    const user = createMockUser();
    const auth = createMockAuth(user);
    vi.stubGlobal('useAuth', () => auth);
    resolveConversationsWith([{ buyer_id: user.id, seller_id: 'a', buyer_unread_count: 6, seller_unread_count: 0 }]);

    const { useUnreadMessages } = await import('~/app/composables/useUnreadMessages');
    const { unreadCount, start } = useUnreadMessages();
    start();
    // The watcher's refresh() is async — a tick is not enough to settle it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unreadCount.value).toBe(6);

    auth.user.value = null;
    await nextTick();

    expect(unreadCount.value).toBe(0);
    expect(mockSupabase._mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});
