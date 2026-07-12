/**
 * Blocked Users (client-side mute)
 *
 * The shared Supabase backend does not (yet) expose a server-side block table —
 * the platform's anti-abuse enforcement lives in messaging probation, the
 * fan-out cap, link-holding, and admin "ban-at-source" driven by message
 * Reports. This composable provides a complementary, user-controlled *mute*:
 * a blocked user's messages are hidden from the current user's threads and the
 * composer is disabled for that conversation.
 *
 * Scope and honesty: a client-side mute hides the other person from *your*
 * view on this device; it does not stop them sending or reach other devices.
 * To have the platform act on a bad actor, users should also Report the message
 * (which feeds admin moderation / ban-at-source). The block list is namespaced
 * per signed-in user so it never leaks between accounts on a shared device.
 *
 * If a server-side `blocked_users` table + `block_user()`/`unblock_user()` RPCs
 * are added later, swap the persistence here for those calls — the public API
 * (isBlocked / blockUser / unblockUser / blockedIds) is designed to stay stable.
 */

const STORAGE_PREFIX = 'cmdiy_blocked_users';

export const useBlockedUsers = () => {
  const { user } = useAuth();
  const { capture } = usePostHog();

  // Shared reactive state so every component (thread, composer) stays in sync.
  const blockedIds = useState<string[]>('blocked-users', () => []);

  const storageKey = () => `${STORAGE_PREFIX}:${user.value?.id ?? 'anon'}`;

  const load = () => {
    if (!import.meta.client) return;
    try {
      const raw = localStorage.getItem(storageKey());
      blockedIds.value = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      blockedIds.value = [];
    }
  };

  // `blockedIds` is a client-side useState singleton, so without this it would
  // retain the previous user's list across a logout→login that doesn't trigger a
  // full page reload (state leakage between accounts on a shared device). Re-load
  // from the per-user storage key whenever the signed-in user changes so the
  // shared state always reflects the current account.
  if (import.meta.client) {
    watch(() => user.value?.id, load, { immediate: true });
  }

  const persist = () => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(storageKey(), JSON.stringify(blockedIds.value));
    } catch {
      // Ignore quota / serialization errors — muting is best-effort.
    }
  };

  const isBlocked = (userId: string | null | undefined): boolean => {
    if (!userId) return false;
    return blockedIds.value.includes(userId);
  };

  const blockUser = (userId: string) => {
    if (!userId || isBlocked(userId)) return;
    blockedIds.value = [...blockedIds.value, userId];
    persist();
    capture('user_blocked', { blocked_user_id: userId });
  };

  const unblockUser = (userId: string) => {
    if (!isBlocked(userId)) return;
    blockedIds.value = blockedIds.value.filter((id) => id !== userId);
    persist();
    capture('user_unblocked', { blocked_user_id: userId });
  };

  return {
    blockedIds: readonly(blockedIds),
    load,
    isBlocked,
    blockUser,
    unblockUser,
  };
};
