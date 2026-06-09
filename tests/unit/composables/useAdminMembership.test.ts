import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * useAdminMembership wraps the is_admin()-gated comp RPCs. These tests pin the
 * RPC names + argument shapes (the contract shared with TheMiniExchange).
 */

// A supabase.rpc(...) return value that is both awaitable (grant/revoke) and
// has .single() (admin_get_membership).
function rpcResult(resolved: { data: any; error: any }) {
  return {
    single: vi.fn().mockResolvedValue(resolved),
    then: (onF: any, onR: any) => Promise.resolve(resolved).then(onF, onR),
  };
}

let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  rpc = vi.fn();
  vi.stubGlobal('useSupabase', () => ({ rpc }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAdminMembership', () => {
  it('getMembership calls admin_get_membership and returns the snapshot', async () => {
    const snapshot = {
      is_member: true,
      active_platform: 'comp',
      has_active_comp: true,
      comp_expires_at: null,
      comp_note: 'press',
    };
    rpc.mockReturnValue(rpcResult({ data: snapshot, error: null }));

    const { useAdminMembership } = await import('~/app/composables/useAdminMembership');
    const result = await useAdminMembership().getMembership('user-1');

    expect(rpc).toHaveBeenCalledWith('admin_get_membership', { p_user_id: 'user-1' });
    expect(result).toEqual(snapshot);
  });

  it('grantComp forwards note + expiry to grant_comp_membership', async () => {
    rpc.mockReturnValue(rpcResult({ data: {}, error: null }));

    const { useAdminMembership } = await import('~/app/composables/useAdminMembership');
    await useAdminMembership().grantComp('user-1', 'Press comp', '2026-12-31T23:59:59.000Z');

    expect(rpc).toHaveBeenCalledWith('grant_comp_membership', {
      p_user_id: 'user-1',
      p_note: 'Press comp',
      p_expires_at: '2026-12-31T23:59:59.000Z',
    });
  });

  it('grantComp sends nulls for a permanent, note-less comp', async () => {
    rpc.mockReturnValue(rpcResult({ data: {}, error: null }));

    const { useAdminMembership } = await import('~/app/composables/useAdminMembership');
    await useAdminMembership().grantComp('user-1', null, null);

    expect(rpc).toHaveBeenCalledWith('grant_comp_membership', {
      p_user_id: 'user-1',
      p_note: null,
      p_expires_at: null,
    });
  });

  it('revokeComp calls revoke_comp_membership', async () => {
    rpc.mockReturnValue(rpcResult({ data: {}, error: null }));

    const { useAdminMembership } = await import('~/app/composables/useAdminMembership');
    await useAdminMembership().revokeComp('user-1');

    expect(rpc).toHaveBeenCalledWith('revoke_comp_membership', { p_user_id: 'user-1' });
  });

  it('throws when the RPC returns an error (e.g. non-admin)', async () => {
    rpc.mockReturnValue(rpcResult({ data: null, error: { message: 'Not authorized' } }));

    const { useAdminMembership } = await import('~/app/composables/useAdminMembership');
    await expect(useAdminMembership().revokeComp('user-1')).rejects.toMatchObject({ message: 'Not authorized' });
  });
});
