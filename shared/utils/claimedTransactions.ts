/**
 * "Claimed transactions" on /admin/membership: store transactions that a
 * signed-in user verified while the row is bound to ANOTHER live account
 * (verify-subscription answers `code: 'TXN_CLAIMED'`).
 *
 * The web Worker reads `public.admin_list_claimed_transactions(p_days)` with
 * the service client after `requireAdminAuth`, and "Move to caller" calls
 * `public.admin_reassign_subscription(...)` the same way. Both are
 * service_role only. Contract and mechanism: classicminidiy-supabase
 * CLAUDE.md, the TXN_CLAIMED bullet.
 *
 * Contract, as the RPC returns it:
 * - One row per CASE: a (subscriptions row, caller) pair. Two accounts that
 *   verified the same transaction are two rows.
 * - Only open cases: the row is still owned by a live account that is not the
 *   caller. A moved, detached or deleted row drops out on its own.
 * - Latest attempt first; at most 101 rows (show 100, a 101st means "more").
 *
 * Client-safe: types, constants and pure helpers only.
 */

/** Rows shown. The RPC returns one more when there are more cases. */
export const CLAIMED_TRANSACTIONS_LIMIT = 100;
/** Look-back window in days. The backend keeps these attempts 180 days. */
export const CLAIMED_TRANSACTIONS_DAYS = 90;

export interface ClaimedTransactionRow {
  subscription_id: string;
  platform: string;
  caller_user_id: string;
  caller_email: string | null;
  owner_user_id: string;
  owner_email: string | null;
  status: string;
  expires_at: string | null;
  plan: string | null;
  attempts: number;
  first_attempt_at: string;
  last_attempt_at: string;
  /** True when the caller is a member through another row anyway. */
  caller_entitled_now: boolean;
  /**
   * The latest support move of this subscription (admin_audit_log), or null.
   * Set on a case means the row was moved by hand before and came back: two
   * accounts on one Apple ID both verify the same transaction. Talk to the
   * customer before moving it again.
   */
  last_reassigned_at: string | null;
  /** The admin who made that move: account email, else display name. */
  last_reassigned_by: string | null;
}

export interface ClaimedTransactionsResponse {
  results: ClaimedTransactionRow[];
  truncated: boolean;
}

/** Body of POST /api/admin/membership/reassign. */
export interface ReassignSubscriptionRequest {
  subscriptionId: string;
  /** The account the row moves to (the case's caller). */
  toUserId: string;
  /** The owner the admin saw. The move is refused if the row moved since. */
  expectedOwnerId: string;
}

/** Response of POST /api/admin/membership/reassign. */
export interface ReassignSubscriptionResponse {
  success: true;
  subscriptionId: string;
  userId: string;
  /** False when the row already belonged to `toUserId`: nothing changed. */
  moved: boolean;
}

/** Stable key for a case row: one row per (subscription, caller). */
export function claimedTransactionKey(row: Pick<ClaimedTransactionRow, 'subscription_id' | 'caller_user_id'>) {
  return `${row.subscription_id}:${row.caller_user_id}`;
}
