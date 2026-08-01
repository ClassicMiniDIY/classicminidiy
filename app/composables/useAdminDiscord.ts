/**
 * useAdminDiscord — admin-only read surface over the Discord guild roster
 * (classicminidiy-supabase migration 20260801000001_discord_roster_observability).
 *
 * The guild is members-only, but until the discord-audit cron shipped nothing
 * ever READ it: the entitlement fan-out only reconciles users it already holds
 * a discord_links row for. This composable exposes the reconciliation roster —
 * every present guild member plus every active link absent from the guild —
 * classified against user_has_subscription().
 *
 * OBSERVE ONLY. There is no enforcement RPC behind this; nothing here removes a
 * role or kicks anyone. Acting on `unlinked` in particular would remove paying
 * members, most of whom simply never completed the OAuth claim. See the design
 * doc (docs/plans/2026-08-01-discord-roster-reconciliation.md §5) before wiring
 * any action to these rows.
 *
 * admin_list_discord_roster enforces public.is_admin() server-side, so this is
 * called with the logged-in admin's Supabase client. Non-admins hit 42501.
 */

/** Roster classification, mirroring the SQL CASE in discord_roster_classified(). */
export type DiscordClassification =
  /** Linked, entitled, holds the paid role. Nothing to do. */
  | 'ok'
  /** Holds the paid role with no active subscription — the actual leak. */
  | 'role_without_entitlement'
  /** Holds the paid role but has no discord_links row at all; the role arrived
   *  some other way (hand-granted, or a deleted link). Unaccounted for. */
  | 'unlinked_with_role'
  /** Entitled and in the guild, but the paid role is missing. */
  | 'entitled_without_role'
  /** In the guild, no link, no role. Usually a payer who never claimed. */
  | 'unlinked'
  /** Linked and in the guild, not entitled, no role. Lapsed and correctly stripped. */
  | 'unentitled_no_role'
  /** Active link whose Discord account is not in the guild. */
  | 'linked_absent'
  /** Bot, moderator, or a manually exempted account. Never enforced against. */
  | 'exempt';

export interface DiscordRosterRow {
  discord_user_id: string;
  /** Discord @handle. Mutable — discord_user_id is the identity key. */
  username: string;
  /** Display name; null when the account never set one. */
  global_name: string | null;
  /** Per-guild nickname. */
  nick: string | null;
  in_guild: boolean;
  has_paid_role: boolean;
  exempt: boolean;
  guild_joined_at: string | null;
  last_seen_at: string | null;
  /** Supabase account, when the Discord account is linked to one. */
  user_id: string | null;
  email: string | null;
  link_status: string | null;
  is_entitled: boolean;
  classification: DiscordClassification;
}

export interface DiscordAuditRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  /** False means pagination never reached a confirmed final page — the run's
   *  roster is partial and its departures were deliberately not recorded. */
  complete: boolean;
  pages_fetched: number;
  members_seen: number;
  departed: number;
  counts: Record<string, number>;
  last_error: string | null;
}

/** Ordered worst-first, so the UI groups the rows that actually need attention. */
export const DISCORD_CLASSIFICATION_ORDER: DiscordClassification[] = [
  'role_without_entitlement',
  'unlinked_with_role',
  'entitled_without_role',
  'unlinked',
  'linked_absent',
  'unentitled_no_role',
  'ok',
  'exempt',
];

export const DISCORD_CLASSIFICATION_LABELS: Record<DiscordClassification, string> = {
  role_without_entitlement: 'Has role, not paying',
  unlinked_with_role: 'Has role, never linked',
  entitled_without_role: 'Paying, role missing',
  unlinked: 'In server, not linked',
  linked_absent: 'Linked, left the server',
  unentitled_no_role: 'Lapsed, role removed',
  ok: 'OK',
  exempt: 'Exempt',
};

/** daisyUI badge modifier per classification. */
export const DISCORD_CLASSIFICATION_BADGES: Record<DiscordClassification, string> = {
  role_without_entitlement: 'badge-error',
  unlinked_with_role: 'badge-error',
  entitled_without_role: 'badge-warning',
  unlinked: 'badge-warning',
  linked_absent: 'badge-info',
  unentitled_no_role: 'badge-ghost',
  ok: 'badge-success',
  exempt: 'badge-ghost',
};

export const useAdminDiscord = () => {
  const supabase = useSupabase();

  /** Full reconciliation roster, worst-first. */
  const listRoster = async (): Promise<DiscordRosterRow[]> => {
    const { data, error } = await supabase.rpc('admin_list_discord_roster');
    if (error) throw error;

    const rows = (data ?? []) as DiscordRosterRow[];
    const rank = (c: DiscordClassification) => {
      const i = DISCORD_CLASSIFICATION_ORDER.indexOf(c);
      return i === -1 ? DISCORD_CLASSIFICATION_ORDER.length : i;
    };
    return [...rows].sort(
      (a, b) => rank(a.classification) - rank(b.classification) || a.username.localeCompare(b.username)
    );
  };

  /**
   * Most recent audit run, for the "last checked" stamp and staleness warning.
   *
   * Goes through an RPC rather than selecting discord_audit_runs directly: that
   * table is REVOKEd from `authenticated`, so a PostgREST read would 42501 even
   * for an admin.
   */
  const latestRun = async (): Promise<DiscordAuditRun | null> => {
    const { data, error } = await supabase.rpc('admin_latest_discord_audit');
    if (error) throw error;
    const rows = (data ?? []) as DiscordAuditRun[];
    return rows[0] ?? null;
  };

  return { listRoster, latestRun };
};
