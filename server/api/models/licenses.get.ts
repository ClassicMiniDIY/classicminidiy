/**
 * GET /api/models/licenses  (keystone §7)
 *
 * Active licenses for the upload wizard's license picker, with the flags the UI
 * needs to filter by pricing (free/tips → CC family; pwyw/fixed → CMDIY paid)
 * and render the badge. Public; static segment so no `[modelId]` collision.
 */
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async () => {
  const service = getServiceClient();
  const { data, error } = await service
    .from('model_licenses')
    .select(
      'code, name, url, is_paid_license, allows_commercial_use, allows_derivatives, requires_attribution, requires_share_alike, allows_file_redistribution'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[models/licenses] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load licenses' });
  }

  return { licenses: data ?? [] };
});
