import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { cleanupGlobalMocks } from '../../../setup/testHelpers';

// useBlockedUsers depends on:
//  - useAuth        (stubbed — user drives the per-user storage key)
//  - usePostHog     (stubbed for capture spying)
//  - useState       (global stub from vitest.setup; reset via __resetNuxtState)
//  - localStorage   (happy-dom)

const mockUser = ref<{ id: string } | null>({ id: 'me-123' });
const mockCapture = vi.fn();

const getUseBlockedUsers = async () => {
  vi.resetModules();
  vi.stubGlobal('useAuth', () => ({ user: mockUser }));
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
  const module = await import('~/app/composables/useBlockedUsers');
  return module.useBlockedUsers;
};

describe('useBlockedUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__resetNuxtState?.();
    localStorage.clear();
    mockUser.value = { id: 'me-123' };
  });

  afterEach(() => {
    cleanupGlobalMocks();
  });

  it('reports a user as not blocked by default', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { isBlocked } = useBlockedUsers();
    expect(isBlocked('someone')).toBe(false);
  });

  it('blocks and unblocks a user', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { isBlocked, blockUser, unblockUser } = useBlockedUsers();

    blockUser('scammer-1');
    expect(isBlocked('scammer-1')).toBe(true);

    unblockUser('scammer-1');
    expect(isBlocked('scammer-1')).toBe(false);
  });

  it('treats a null/undefined id as not blocked', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { isBlocked } = useBlockedUsers();
    expect(isBlocked(null)).toBe(false);
    expect(isBlocked(undefined)).toBe(false);
  });

  it('does not add the same user twice', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { blockUser, blockedIds } = useBlockedUsers();

    blockUser('dup');
    blockUser('dup');

    expect(blockedIds.value.filter((id) => id === 'dup')).toHaveLength(1);
  });

  it('captures block/unblock analytics events', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { blockUser, unblockUser } = useBlockedUsers();

    blockUser('scammer-1');
    expect(mockCapture).toHaveBeenCalledWith('user_blocked', { blocked_user_id: 'scammer-1' });

    unblockUser('scammer-1');
    expect(mockCapture).toHaveBeenCalledWith('user_unblocked', { blocked_user_id: 'scammer-1' });
  });

  it('persists the block list under a per-user storage key', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { blockUser } = useBlockedUsers();

    blockUser('scammer-1');

    // vitest.setup's localStorage is a bare mock — assert the write itself.
    expect(localStorage.setItem).toHaveBeenCalledWith('cmdiy_blocked_users:me-123', JSON.stringify(['scammer-1']));
  });

  it('tolerates corrupted localStorage payloads (non-array / non-string members)', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { load, isBlocked, blockedIds } = useBlockedUsers();

    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"not-an-array"');
    load();
    expect(blockedIds.value).toEqual([]);

    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('[1, "real-id", null]');
    load();
    expect(blockedIds.value).toEqual(['real-id']);
    expect(isBlocked('real-id')).toBe(true);

    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('{{{not json');
    load();
    expect(blockedIds.value).toEqual([]);
  });

  it('reloads per-user state when the signed-in user changes (no leakage)', async () => {
    const useBlockedUsers = await getUseBlockedUsers();
    const { isBlocked, blockUser } = useBlockedUsers();

    // User A blocks someone within the same client session.
    blockUser('scammer-1');
    expect(isBlocked('scammer-1')).toBe(true);

    // A different user signs in without a full page reload. The shared
    // useState singleton must not carry A's block list into B's session —
    // the user-id watcher re-loads from B's (empty) per-user storage key.
    mockUser.value = { id: 'other-456' };
    await nextTick();

    expect(isBlocked('scammer-1')).toBe(false);
  });
});
