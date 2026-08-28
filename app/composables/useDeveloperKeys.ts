/**
 * State + API for the Developer API key management surface
 * (/dashboard/api-keys). All key CRUD goes through /api/developer/* server
 * routes with a Bearer token ($authFetch) — RLS deliberately grants no writes
 * on api_keys. Design doc: docs/plans/2026-08-28-developer-api-subscription.md
 */

export interface DeveloperKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface DeveloperUsageRow {
  key_id: string;
  tool: string;
  day: string;
  call_count: number;
}

export interface DeveloperSubscription {
  is_active: boolean;
  platform: string | null;
  status: string | null;
  expires_at: string | null;
  billing_interval: 'month' | 'year' | null;
}

export const MAX_DEVELOPER_KEYS = 5;

export function useDeveloperKeys() {
  const supabase = useSupabase();

  const keys = useState<DeveloperKey[]>('developer-keys', () => []);
  const usage = useState<DeveloperUsageRow[]>('developer-usage', () => []);
  const subscription = useState<DeveloperSubscription | null>('developer-subscription', () => null);
  const loading = ref(false);
  const usageLoading = ref(false);

  const fetchKeys = async (): Promise<void> => {
    loading.value = true;
    try {
      const res = await $authFetch<{ keys: DeveloperKey[] }>('/api/developer/keys');
      keys.value = res.keys;
    } finally {
      loading.value = false;
    }
  };

  /** Create a key. The returned `key` is the plaintext, shown once, never
   *  retrievable again. */
  const createKey = async (name: string): Promise<DeveloperKey & { key: string }> => {
    const created = await $authFetch<DeveloperKey & { key: string }>('/api/developer/keys', {
      method: 'POST',
      body: { name },
    });
    keys.value = [...keys.value, { ...created, last_used_at: null }];
    return created;
  };

  const renameKey = async (id: string, name: string): Promise<void> => {
    const updated = await $authFetch<DeveloperKey>(`/api/developer/keys/${id}`, {
      method: 'PATCH',
      body: { name },
    });
    keys.value = keys.value.map((k) => (k.id === id ? { ...k, name: updated.name } : k));
  };

  const revokeKey = async (id: string): Promise<void> => {
    await $authFetch(`/api/developer/keys/${id}`, { method: 'DELETE' });
    keys.value = keys.value.filter((k) => k.id !== id);
  };

  const fetchUsage = async (): Promise<void> => {
    usageLoading.value = true;
    try {
      const res = await $authFetch<{ rows: DeveloperUsageRow[] }>('/api/developer/usage');
      usage.value = res.rows;
    } finally {
      usageLoading.value = false;
    }
  };

  /** Own developer-subscription snapshot (get_my_subscription RPC). Errors
   *  resolve to "not subscribed" — the badge is informational, never a gate. */
  const fetchSubscription = async (): Promise<void> => {
    try {
      // Cast drops once the post-migration `bun run gen:types` lands
      // get_my_subscription in the generated Database type.
      const { data, error } = await (supabase.rpc as any)('get_my_subscription', {
        p_product_id: 'developer',
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      subscription.value = row ?? null;
    } catch (err) {
      console.error('Failed to load developer subscription:', err);
      subscription.value = null;
    }
  };

  /** Purge the server-side auth cache for the caller's keys so a tier change
   *  (post-checkout upgrade) applies immediately. */
  const refreshEntitlement = async (): Promise<void> => {
    try {
      await $authFetch('/api/developer/refresh', { method: 'POST' });
    } catch (err) {
      // Non-fatal: the cache TTL (5 min) picks the change up regardless.
      console.error('Failed to refresh key entitlements:', err);
    }
  };

  return {
    keys,
    usage,
    subscription,
    loading,
    usageLoading,
    fetchKeys,
    createKey,
    renameKey,
    revokeKey,
    fetchUsage,
    fetchSubscription,
    refreshEntitlement,
  };
}
