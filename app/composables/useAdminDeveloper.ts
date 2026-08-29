/**
 * useAdminDeveloper — admin-side Developer API management.
 * Design doc: docs/plans/2026-08-29-developer-api-admin.md
 *
 * Two mechanisms, deliberately:
 *   - Comp grant/revoke go through the Supabase RPCs with the admin's own JWT
 *     (is_admin() is enforced in SQL), matching the existing comp-Sustaining UI.
 *   - Everything else goes through /api/admin/developer/** service-role routes,
 *     because issuing and revoking keys must also purge the worker's KV auth
 *     cache, which only the worker can reach.
 *
 * After any entitlement change, call refreshKeyCache(userId): the tier is
 * cached per key, so without it the change is invisible for up to the cache TTL.
 */

export interface AdminDeveloperSummary {
  is_active: boolean;
  platform: string | null;
  status: string | null;
  expires_at: string | null;
  billing_interval: string | null;
  has_active_comp: boolean;
  comp_note: string | null;
  comp_expires_at: string | null;
  active_key_count: number;
  calls_30d: number;
}

export interface AdminDeveloperKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface AdminUsageRow {
  key_id: string;
  tool: string;
  day: string;
  call_count: number;
}

export const DEVELOPER_PRODUCT_ID = 'developer';

export const useAdminDeveloper = () => {
  const supabase = useSupabase();

  /** One-round-trip Developer API snapshot for the admin user modal. */
  const getSummary = async (userId: string): Promise<AdminDeveloperSummary> => {
    const { data, error } = await supabase.rpc('admin_get_developer_summary', { p_user_id: userId }).single();
    if (error) throw error;
    return data as AdminDeveloperSummary;
  };

  /** Grant/refresh a complimentary Developer API subscription. null = permanent. */
  const grantComp = async (userId: string, note: string | null, expiresAt: string | null): Promise<void> => {
    const { error } = await supabase.rpc('grant_comp_membership', {
      p_user_id: userId,
      p_note: note,
      p_expires_at: expiresAt,
      p_product_id: DEVELOPER_PRODUCT_ID,
    });
    if (error) throw error;
    await refreshKeyCache(userId);
  };

  /** Revoke the comp. Never touches a real Stripe subscription. */
  const revokeComp = async (userId: string): Promise<void> => {
    const { error } = await supabase.rpc('revoke_comp_membership', {
      p_user_id: userId,
      p_product_id: DEVELOPER_PRODUCT_ID,
    });
    if (error) throw error;
    await refreshKeyCache(userId);
  };

  const listKeys = async (userId: string): Promise<AdminDeveloperKey[]> => {
    const res = await $authFetch<{ keys: AdminDeveloperKey[] }>(`/api/admin/developer/${userId}/keys`);
    return res.keys;
  };

  /** Issue a key for a user. The name is forced server-side to identify the
   *  issuing admin; the plaintext comes back exactly once. */
  const issueKey = async (userId: string): Promise<AdminDeveloperKey & { key: string }> =>
    $authFetch<AdminDeveloperKey & { key: string }>(`/api/admin/developer/${userId}/keys`, { method: 'POST' });

  const revokeKey = async (keyId: string): Promise<void> => {
    await $authFetch(`/api/admin/developer/keys/${keyId}`, { method: 'DELETE' });
  };

  const getUsage = async (userId: string): Promise<AdminUsageRow[]> => {
    const res = await $authFetch<{ rows: AdminUsageRow[] }>(`/api/admin/developer/${userId}/usage`);
    return res.rows;
  };

  /** Purge the worker's cached tier for every active key this user holds. */
  const refreshKeyCache = async (userId: string): Promise<void> => {
    try {
      await $authFetch(`/api/admin/developer/${userId}/refresh`, { method: 'POST' });
    } catch (err) {
      // Non-fatal: the cache TTL picks the change up regardless.
      console.error('Failed to refresh key cache:', err);
    }
  };

  const getOverview = async () => $authFetch<any>('/api/admin/developer/overview');

  return { getSummary, grantComp, revokeComp, listKeys, issueKey, revokeKey, getUsage, refreshKeyCache, getOverview };
};
