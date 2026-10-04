/**
 * GET /api/admin/membership/claimed  →  { results, truncated }
 *
 * Open TXN_CLAIMED cases for /admin/membership: a store transaction a user
 * verified while it is bound to another live account. One row per
 * (subscriptions row, caller), latest attempt first. Contract:
 * `shared/utils/claimedTransactions.ts`.
 *
 * Service client after `requireAdminAuth`: `admin_list_claimed_transactions`
 * is EXECUTE for `service_role` only, and it reads `auth.users`.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import {
  CLAIMED_TRANSACTIONS_DAYS,
  CLAIMED_TRANSACTIONS_LIMIT,
  type ClaimedTransactionRow,
  type ClaimedTransactionsResponse,
} from '../../../../shared/utils/claimedTransactions';

// `admin_list_claimed_transactions` is not in types/database.ts until it
// deploys and the types are regenerated, so the typed `rpc` refuses its name.
// Drop this cast after `bun run gen:types`.
type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

export default defineEventHandler(async (event): Promise<ClaimedTransactionsResponse> => {
  await requireAdminAuth(event);

  const db = getServiceClient();
  const { data, error } = await (db.rpc as unknown as UntypedRpc).call(db, 'admin_list_claimed_transactions', {
    p_days: CLAIMED_TRANSACTIONS_DAYS,
  });
  if (error) {
    // Logged, not returned: a database message is not for the browser.
    console.error('[admin/membership/claimed] failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not load claimed transactions' });
  }

  const rows = Array.isArray(data) ? (data as ClaimedTransactionRow[]) : [];
  return {
    results: rows.slice(0, CLAIMED_TRANSACTIONS_LIMIT),
    truncated: rows.length > CLAIMED_TRANSACTIONS_LIMIT,
  };
});
