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

export const useAdminMembership = () => {
  const supabase = useSupabase();

  /** Snapshot of a user's membership for the admin UI. */
  const getMembership = async (userId: string): Promise<AdminMembership> => {
    const { data, error } = await supabase.rpc('admin_get_membership', { p_user_id: userId }).single();
    if (error) throw error;
    return data as AdminMembership;
  };

  /** Grant/refresh a complimentary membership. expiresAt null = permanent. */
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

  return { getMembership, grantComp, revokeComp };
};
