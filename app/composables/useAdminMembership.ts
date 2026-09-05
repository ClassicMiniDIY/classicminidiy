/**
 * useAdminMembership — admin-only helpers over the comp-membership RPCs
 * (classicminidiy-supabase migration 20260608000002_comp_membership).
 *
 * Each RPC enforces public.is_admin() server-side, so these are called with the
 * logged-in admin's Supabase client (their JWT carries admin). Non-admins hit a
 * 42501 exception. This is the shared contract that TheMiniExchange's admin comp
 * UI also calls — keep the names/shapes in sync.
 */
export interface AdminMembership {
  /** Overall membership (user_has_subscription) — true via any active channel. */
  is_member: boolean;
  /** Platform of the row currently granting membership, or null. */
  active_platform: 'apple' | 'google' | 'stripe' | 'comp' | null;
  /** Whether an active comp row exists (drives the Revoke action). */
  has_active_comp: boolean;
  /** Comp expiry (ISO) or null = permanent. */
  comp_expires_at: string | null;
  /** Admin-supplied reason on the comp row. */
  comp_note: string | null;
  /** discord_links lifecycle: pending | active | revoked | failed, or null when
   *  the user has never had a link row. */
  discord_status: 'pending' | 'active' | 'revoked' | 'failed' | null;
  /** Discord snowflake — the stable identity key. */
  discord_user_id: string | null;
  /** Discord @handle, captured at OAuth and refreshed daily by discord-audit. */
  discord_username: string | null;
  /** Discord display name; null when the account never set one. */
  discord_global_name: string | null;
  /** Present in the guild as of the last discord-audit run. FALSE also means
   *  "no audit has run yet" — check the Discord roster page's last-run stamp. */
  discord_in_guild: boolean;
  /** Holds the paid role as of the last discord-audit run. `is_member` false
   *  with this true is the drift case: still in the members-only server after
   *  going free. */
  discord_has_role: boolean;
}

/** One `subscriptions` row, joined to the member behind it. Every platform. */
export interface AdminSubscriptionRow {
  subscription_id: string;
  user_id: string;
  email: string | null;
  username: string | null;
  platform: MembershipPlatform;
  product_id: string;
  status: string;
  /** Mirrors user_has_subscription() — status is active/grace AND unexpired. */
  entitled: boolean;
  starts_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  comp_note: string | null;
  discord_link_status: string | null;
  discord_username: string | null;
}

/**
 * One member whose most recent verify-subscription attempt failed. Collapsed to
 * one row per user server-side: an app that retries on every launch produces
 * dozens of identical attempts, and this page needs the person.
 */
export interface AdminVerificationFailure {
  /** Never null: the RPC excludes attempts that never authenticated, since they
   *  name no account and would otherwise all fuse into one row. */
  user_id: string;
  email: string | null;
  username: string | null;
  /** Platform the client CLAIMED. Null means it never sent one — which is the
   *  whole diagnosis for the 2026 Android outage. */
  platform: string | null;
  outcome: string;
  error_code: string | null;
  http_status: number;
  detail: string | null;
  /** Top-level JSON keys the client sent. Keys, never values. */
  body_keys: string[] | null;
  user_agent: string | null;
  attempts: number;
  first_failure_at: string | null;
  last_failure_at: string | null;
  /** True when another channel (or a comp) covers them anyway — those rows are
   *  noise. An unentitled one is somebody who paid and got nothing. */
  entitled_now: boolean;
}

/** Daily verify-subscription tally, for the "is something broken now" strip. */
export interface AdminVerificationHealth {
  day: string;
  /** '(none sent)' when the client omitted the platform key. */
  platform: string;
  outcome: 'verified' | 'rejected' | 'upstream_error';
  attempts: number;
  distinct_users: number;
}

export type MembershipPlatform = 'apple' | 'google' | 'stripe' | 'comp' | 'ghost' | 'patreon';

export const useAdminMembership = () => {
  const supabase = useSupabase();

  /**
   * The three RPCs below ship in classicminidiy-supabase migration
   * 20260905000001 and are therefore absent from the generated `Database` type
   * until `bun run gen:types` is re-run against a project that has it. Calling
   * them through this narrowed signature keeps the typecheck ratchet flat
   * without an `any`; once the types are regenerated the cast is redundant and
   * should be deleted along with this comment.
   */
  type PendingRpc = (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const pendingRpc = supabase.rpc.bind(supabase) as unknown as PendingRpc;

  /** Snapshot of a user's membership for the admin UI. */
  const getMembership = async (userId: string): Promise<AdminMembership> => {
    const { data, error } = await supabase.rpc('admin_get_membership', { p_user_id: userId }).single();
    if (error) throw error;
    return data as AdminMembership;
  };

  /** Grant/refresh a complimentary membership. expiresAt null = permanent.
   *
   *  The RPCs became product-scoped with the Developer API admin surface
   *  (migration 20260829000001): p_product_id defaults to 'sustaining'
   *  server-side, so omitting it here keeps this composable's meaning exactly
   *  as it was. Developer API comps go through useAdminDeveloper instead,
   *  which passes the product explicitly and also purges the worker's key
   *  cache — a step this Sustaining path does not need. */
  const grantComp = async (userId: string, note: string | null, expiresAt: string | null): Promise<void> => {
    const { error } = await supabase.rpc('grant_comp_membership', {
      p_user_id: userId,
      p_note: note,
      p_expires_at: expiresAt,
    });
    if (error) throw error;
  };

  /** Revoke a user's comp membership (never touches paid apple/google/stripe rows). */
  const revokeComp = async (userId: string): Promise<void> => {
    const { error } = await supabase.rpc('revoke_comp_membership', { p_user_id: userId });
    if (error) throw error;
  };

  /**
   * Purchases for one product, newest first. Defaults to the Sustaining
   * membership: `subscriptions` also carries the Developer API tier, and an
   * unscoped list counts those rows as members. Pass null for every product.
   */
  const listSubscriptions = async (productId: string | null = 'sustaining'): Promise<AdminSubscriptionRow[]> => {
    const { data, error } = await pendingRpc('admin_list_subscriptions', { p_product_id: productId });
    if (error) throw error;
    return (data ?? []) as AdminSubscriptionRow[];
  };

  /**
   * Members whose verification is currently failing. Defaults to the last 30
   * days server-side; a user who has since verified drops off on their own, so
   * this list never needs dismissing.
   */
  const listVerificationFailures = async (since?: string): Promise<AdminVerificationFailure[]> => {
    const { data, error } = await pendingRpc('admin_list_verification_failures', {
      p_since: since ?? null,
    });
    if (error) throw error;
    return (data ?? []) as AdminVerificationFailure[];
  };

  /** Attempts per day/platform/outcome over the last `days`. */
  const verificationHealth = async (days = 7): Promise<AdminVerificationHealth[]> => {
    const { data, error } = await pendingRpc('admin_verification_health', { p_days: days });
    if (error) throw error;
    return (data ?? []) as AdminVerificationHealth[];
  };

  return {
    getMembership,
    grantComp,
    revokeComp,
    listSubscriptions,
    listVerificationFailures,
    verificationHealth,
  };
};
