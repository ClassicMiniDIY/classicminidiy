/**
 * POST /api/admin/models/toggle-seller  (keystone §8)
 *
 * Admin kill switch for a seller. `seller_accounts` writes are service-role only
 * (RLS), so the toggle runs here. `selling_disabled` overrides everything —
 * onboarding, submit, and checkout all re-check it — so flipping it on
 * immediately stops the seller from taking new payments (existing buyers keep
 * access). Used for the 3-strikes repeat-infringer policy (manual v1).
 *
 *   body: { userId, sellingDisabled: boolean }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ userId?: string; sellingDisabled?: boolean }>(event);

  const userId = body?.userId;
  const sellingDisabled = !!body?.sellingDisabled;
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Missing userId' });

  const db = getServiceClient();
  const { data, error } = await db
    .from('seller_accounts')
    .update({ selling_disabled: sellingDisabled })
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  if (!data || data.length === 0) throw createError({ statusCode: 404, statusMessage: 'Seller account not found' });

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: sellingDisabled ? 'seller_selling_disabled' : 'seller_selling_enabled',
    target_type: 'seller_account',
    target_id: userId,
    details: { selling_disabled: sellingDisabled },
  });

  return { ok: true };
});
