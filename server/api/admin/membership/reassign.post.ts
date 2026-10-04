/**
 * POST /api/admin/membership/reassign
 *   { subscriptionId, toUserId, expectedOwnerId }  →  { success, subscriptionId, userId, moved }
 *
 * "Move to caller" on the Claimed transactions list (/admin/membership). Moves
 * a subscriptions row to the account that verified it.
 *
 * Service client after `requireAdminAuth`, like every server-side admin write:
 * `admin_reassign_subscription` is EXECUTE for `service_role` only. It takes
 * the admin's id and re-checks it, writes the audit row in the same
 * transaction as the move, and enqueues the entitlement sync for both users.
 * `expectedOwnerId` is the owner the admin saw in the confirm dialog; the
 * function refuses the move if the row has changed hands since. `moved` is
 * false when the row already belonged to `toUserId` (nothing changed).
 *
 * Header-only: this write moves a paid membership, so the cookie path of
 * requireAdminAuth is refused, like the reference-data publish. A cross-site
 * form post cannot reach it.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { isUuid } from '../../../utils/validation';
import type {
  ReassignSubscriptionRequest,
  ReassignSubscriptionResponse,
} from '../../../../shared/utils/claimedTransactions';

// `admin_reassign_subscription` is not in types/database.ts until it deploys
// and the types are regenerated, so the typed `rpc` refuses its name. Drop
// this cast after `bun run gen:types`.
type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { code?: string; message: string; hint?: string | null } | null }>;

/** SQLSTATE from the function → HTTP status and the message the admin sees. */
const ERRORS: Record<string, { statusCode: number; statusMessage: string }> = {
  '42501': { statusCode: 403, statusMessage: 'Admin access required' },
  P0002: { statusCode: 404, statusMessage: 'That subscription no longer exists' },
  '55000': {
    statusCode: 409,
    statusMessage: 'This subscription changed owner since the list loaded. Refresh and check again.',
  },
  '23503': { statusCode: 400, statusMessage: 'The target account does not exist' },
  '22004': { statusCode: 400, statusMessage: 'Missing subscription or account id' },
};

/** Platforms the 23505 HINT may name; anything else gets the generic wording. */
const PLATFORMS = new Set(['apple', 'google', 'stripe', 'comp', 'ghost', 'patreon', 'youtube']);

/** 23505: the target already holds this platform's per-user row. */
function slotTaken(hint: string | null | undefined) {
  const platform = hint && PLATFORMS.has(hint) ? hint : null;
  return {
    statusCode: 409,
    statusMessage: platform
      ? `That account already has a ${platform} membership`
      : 'That account already has a membership on this platform',
  };
}

export default defineEventHandler(async (event): Promise<ReassignSubscriptionResponse> => {
  const { user, tokenSource } = await requireAdminAuth(event);
  if (tokenSource !== 'header') {
    throw createError({ statusCode: 401, statusMessage: 'Authorization header required' });
  }

  const body = await readBody<Partial<ReassignSubscriptionRequest> | null>(event);
  const subscriptionId = body?.subscriptionId;
  const toUserId = body?.toUserId;
  const expectedOwnerId = body?.expectedOwnerId;
  if (!isUuid(subscriptionId) || !isUuid(toUserId) || !isUuid(expectedOwnerId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'subscriptionId, toUserId and expectedOwnerId must be UUIDs',
    });
  }
  if (toUserId.toLowerCase() === expectedOwnerId.toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'The subscription already belongs to that account' });
  }

  const db = getServiceClient();
  const { data, error } = await (db.rpc as unknown as UntypedRpc).call(db, 'admin_reassign_subscription', {
    p_subscription_id: subscriptionId,
    p_new_user_id: toUserId,
    p_admin_id: user.id,
    p_expected_owner: expectedOwnerId,
  });
  if (error) {
    if (error.code === '23505') throw createError(slotTaken(error.hint));
    const mapped = error.code ? ERRORS[error.code] : undefined;
    if (mapped) throw createError(mapped);
    console.error('[admin/membership/reassign] failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not move the subscription' });
  }

  // RETURNS TABLE: one row, (subscription_id, user_id, previous_user_id, moved).
  const row = (Array.isArray(data) ? data[0] : data) as
    { subscription_id?: string; user_id?: string | null; moved?: boolean } | null | undefined;
  return {
    success: true,
    subscriptionId: row?.subscription_id ?? subscriptionId,
    userId: row?.user_id ?? toUserId,
    // Only an explicit false is the no-op; a missing flag is reported as a move.
    moved: row?.moved !== false,
  };
});
