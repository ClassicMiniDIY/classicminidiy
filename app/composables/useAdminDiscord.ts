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
  | 'exempt'
  /** Client-side fallback for a classification the UI doesn't recognise — the
   *  SQL never emits this. Shown rather than hidden, so a roster change that
   *  outpaces the frontend is visible instead of silently dropping rows. */
  | 'unknown';

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
  'unknown',
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
  unknown: 'Unrecognized',
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
  unknown: 'badge-error',
};

export const useAdminDiscord = () => {
  const supabase = useSupabase();

  /**
   * Normalize one raw RPC row.
   *
   * `discord_roster_row` is a Postgres COMPOSITE type, and composites cannot
   * express NOT NULL — so `bun run gen:types` marks every field nullable even
   * though the SQL guarantees `discord_user_id`, `username`, and
   * `classification` are always populated (the guild branch reads NOT NULL
   * columns; the absent-link branch COALESCEs the handle and filters on
   * `discord_user_id IS NOT NULL`).
   *
   * Rather than assert that with a cast, coerce here. A row that somehow
   * arrives without an identity is dropped (returns null) instead of crashing
   * the page mid-render, and an unrecognized classification degrades to a
   * labelled unknown rather than an invisible one. This keeps the page standing
   * if the SQL ever changes shape.
   */
  const normalizeRow = (raw: Record<string, unknown>): DiscordRosterRow | null => {
    const discordUserId = typeof raw.discord_user_id === 'string' ? raw.discord_user_id : null;
    if (!discordUserId) return null;

    const classification = (
      typeof raw.classification === 'string' &&
      (DISCORD_CLASSIFICATION_ORDER as string[]).includes(raw.classification)
        ? raw.classification
        : 'unknown'
    ) as DiscordClassification;

    return {
      discord_user_id: discordUserId,
      username: typeof raw.username === 'string' && raw.username ? raw.username : '(unknown)',
      global_name: typeof raw.global_name === 'string' ? raw.global_name : null,
      nick: typeof raw.nick === 'string' ? raw.nick : null,
      in_guild: raw.in_guild === true,
      has_paid_role: raw.has_paid_role === true,
      exempt: raw.exempt === true,
      guild_joined_at: typeof raw.guild_joined_at === 'string' ? raw.guild_joined_at : null,
      last_seen_at: typeof raw.last_seen_at === 'string' ? raw.last_seen_at : null,
      user_id: typeof raw.user_id === 'string' ? raw.user_id : null,
      email: typeof raw.email === 'string' ? raw.email : null,
      link_status: typeof raw.link_status === 'string' ? raw.link_status : null,
      is_entitled: raw.is_entitled === true,
      classification,
    };
  };

  /** Full reconciliation roster, worst-first. */
  const listRoster = async (): Promise<DiscordRosterRow[]> => {
    const { data, error } = await supabase.rpc('admin_list_discord_roster');
    if (error) throw error;

    const raw = (data ?? []) as unknown as Record<string, unknown>[];
    const rows = raw.map(normalizeRow).filter((r): r is DiscordRosterRow => r !== null);
    if (rows.length !== raw.length) {
      console.warn(`[useAdminDiscord] dropped ${raw.length - rows.length} roster row(s) with no Discord id`);
    }

    const rank = (c: DiscordClassification) => {
      const i = DISCORD_CLASSIFICATION_ORDER.indexOf(c);
      return i === -1 ? DISCORD_CLASSIFICATION_ORDER.length : i;
    };
    return rows.sort(
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
