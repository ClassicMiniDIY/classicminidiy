/**
 * Support lookup on /admin/membership (classicminidiy-supabase
 * docs/plans/2026-09-26-membership-clarity.md §8).
 *
 * The web Worker calls `public.admin_find_member(p_query text)` with the
 * service client after `requireAdminAuth`. The row shape is restated here
 * (types/database.ts types its jsonb columns as Json) so the client can render
 * it. Client-safe: types, constants and pure helpers only.
 *
 * Contract, as the RPC returns it:
 * - Case-insensitive substring match on the account email, a pending claim
 *   email, the Discord username, the Ghost email, a subscription external_ref,
 *   the Stripe customer id, or the user id; exact match on a Discord user id
 *   (claim link or linked Discord identity, `discord_user_id`, from the YouTube
 *   member bridge). **Never on a name** (decision 13:
 *   names differ across platforms, and Patreon masks them). Do not add a name
 *   filter here or in the UI.
 * - A query shorter than 3 characters is refused with SQLSTATE 22023.
 * - At most 26 rows: 25 to show, and a 26th that only says "there are more".
 * - Order: accounts, then unclaimed payers, then detached (deleted-account)
 *   subscription rows. Callers keep that order.
 * - Three kinds of row, told apart by `user_id` and `email`:
 *   - account: `user_id` set.
 *   - unclaimed payer: `user_id` NULL, `email` = the pending stage email. A
 *     stage whose email belongs to an existing account is NOT a row of its own;
 *     it appears only in that account's `pending_claims`.
 *   - deleted account: `user_id` NULL and `email` NULL. A `subscriptions` row
 *     kept after account deletion; one entry in `subscriptions`, no claims.
 * - `plan` and `platform` are per subscription row. Show each row with its own
 *   platform, plan, status and expiry: that is what answers "why does this
 *   person have Pro".
 */

export const MEMBER_LOOKUP_MIN_QUERY = 3;
/** Longer than any email, ref or snowflake; stops a pasted essay reaching the DB. */
export const MEMBER_LOOKUP_MAX_QUERY = 200;
/** Rows shown. The RPC returns one more when there are more matches. */
export const MEMBER_LOOKUP_LIMIT = 25;

export type MemberLookupMatch =
  | 'account_email'
  | 'pending_email'
  | 'discord_username'
  | 'discord_user_id'
  | 'ghost_email'
  | 'external_ref'
  | 'stripe_customer_id'
  | 'user_id';

export interface MemberLookupSubscription {
  platform: string;
  product_id: string;
  status: string;
  plan: string | null;
  expires_at: string | null;
  external_ref: string | null;
  updated_at: string | null;
}

export interface MemberLookupPendingClaim {
  provider: string;
  external_ref: string | null;
  email: string | null;
  status: string;
  plan: string | null;
  claim_issued_at: string | null;
}

export interface MemberLookupDiscord {
  status: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
}

export interface MemberLookupRow {
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  matched_on: MemberLookupMatch[];
  subscriptions: MemberLookupSubscription[];
  pending_claims: MemberLookupPendingClaim[];
  discord: MemberLookupDiscord | null;
}

export interface MemberLookupResponse {
  results: MemberLookupRow[];
  /** True when the RPC matched more rows than are shown. */
  truncated: boolean;
}

export type MemberLookupKind = 'account' | 'unclaimed' | 'deleted';

export function memberLookupKind(row: Pick<MemberLookupRow, 'user_id' | 'email'>): MemberLookupKind {
  if (row.user_id) return 'account';
  return row.email ? 'unclaimed' : 'deleted';
}

/** The trimmed query, or null when it is too short or too long to send. */
export function normaliseMemberLookupQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const q = raw.trim();
  if (q.length < MEMBER_LOOKUP_MIN_QUERY || q.length > MEMBER_LOOKUP_MAX_QUERY) return null;
  return q;
}

/** jsonb columns can arrive as null; the UI iterates them, so make them arrays. */
export function normaliseMemberLookupRow(row: Partial<MemberLookupRow>): MemberLookupRow {
  return {
    user_id: row.user_id ?? null,
    email: row.email ?? null,
    display_name: row.display_name ?? null,
    matched_on: Array.isArray(row.matched_on) ? row.matched_on : [],
    subscriptions: Array.isArray(row.subscriptions) ? row.subscriptions : [],
    pending_claims: Array.isArray(row.pending_claims) ? row.pending_claims : [],
    discord: row.discord ?? null,
  };
}
