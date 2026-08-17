/**
 * Global unread-message count for the header inbox button.
 *
 * The marketplace inbox (`/exchange/messages`) had no entry point anywhere in
 * the shell — it was reachable only by deep link — so this exists to put one
 * number in the header and keep it honest.
 *
 * Shared through `useState` and a module-level channel so the header button,
 * the account dropdown and the mobile drawer read ONE count and open ONE
 * realtime subscription between them, however many of them are mounted.
 *
 * The count itself is derived by `useMessages().getUnreadCount()` — do not
 * reimplement the buyer/seller column choice here, it drifts.
 */

/**
 * Kept outside `useState` on purpose: a Supabase channel is not serializable,
 * so it must never end up in the SSR payload.
 */
let channel: ReturnType<ReturnType<typeof useSupabase>['channel']> | null = null;
let channelUserId: string | null = null;

export const useUnreadMessages = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { getUnreadCount } = useMessages();

  const unreadCount = useState<number>('messages:unread', () => 0);

  const refresh = async () => {
    if (!user.value) {
      unreadCount.value = 0;
      return;
    }
    unreadCount.value = await getUnreadCount();
  };

  const teardown = () => {
    if (!channel) return;
    supabase.removeChannel(channel);
    channel = null;
    channelUserId = null;
  };

  /**
   * Subscribe to this user's conversation rows. `buyer_unread_count` /
   * `seller_unread_count` are columns on `conversations`, so both a new message
   * and `mark_messages_as_read` arrive as an UPDATE here — the badge clears
   * itself when the thread is opened in another tab.
   */
  const subscribe = () => {
    if (!import.meta.client) return;
    const userId = user.value?.id;
    if (!userId) {
      teardown();
      return;
    }
    if (channel && channelUserId === userId) return;

    teardown();
    channelUserId = userId;
    channel = supabase
      .channel(`unread-messages:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${userId}` },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${userId}` },
        () => refresh()
      )
      .subscribe();
  };

  /**
   * Call once from the header. Safe to call from several components — the
   * watcher is per-instance but the channel and the count are shared.
   */
  const start = () => {
    if (!import.meta.client) return;

    watch(
      () => user.value?.id,
      (id) => {
        if (!id) {
          unreadCount.value = 0;
          teardown();
          return;
        }
        refresh();
        subscribe();
      },
      { immediate: true }
    );
  };

  return { unreadCount, refresh, start };
};
