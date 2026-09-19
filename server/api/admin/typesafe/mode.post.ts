import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';
import { _resetTypesafeModesCache } from '../../../utils/typesafeModes';
import { _resetScreenSettingsCache } from '../../../utils/exchange/screen';
import { _resetReviewSettingsCache } from '../../../utils/review/card';

/**
 * POST /api/admin/typesafe/mode  { key, value }
 *
 * Flip one TypeSafe switch. The private repo's `set_typesafe_mode()` is the
 * only writer and checks the key and the value; `value: null` removes a
 * `typesafe_*` row so the surface falls back to the Worker env. Every flip is
 * an admin_audit_log row. Other isolates pick the change up within a minute
 * (the settings cache TTL); this one drops its cache now.
 */
const KEYS = new Set([
  'typesafe_chat_mode',
  'typesafe_models_mode',
  'typesafe_search_mode',
  'typesafe_queue_mode',
  'typesafe_mcp_mode',
  'message_screen_mode',
  'saved_search_semantic_mode',
  'review_gate_listings',
  'review_gate_finds',
  'review_gate_wanted',
  'review_gate_archive',
  'review_gate_models',
]);

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ key?: unknown; value?: unknown }>(event);
  const key = typeof body?.key === 'string' ? body.key : '';
  const value = body?.value === null ? null : typeof body?.value === 'string' ? body.value.trim().toLowerCase() : '';
  if (!KEYS.has(key)) throw createError({ statusCode: 400, statusMessage: 'Unknown switch' });
  if (value === '') throw createError({ statusCode: 400, statusMessage: 'Missing value' });

  const db = getServiceClient();
  // The generated type wants a string; a JSON null reaches the function as
  // SQL NULL, which is the "delete the row" case it documents.
  const { data, error } = await db.rpc('set_typesafe_mode', { p_key: key, p_value: value as unknown as string });
  if (error) throw createError({ statusCode: 400, statusMessage: error.message });

  _resetTypesafeModesCache();
  _resetScreenSettingsCache();
  _resetReviewSettingsCache();

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'typesafe_mode_set',
    target_type: 'platform_setting',
    target_id: null,
    details: { key, ...((data ?? {}) as Record<string, unknown>) },
  });

  return { success: true, result: data };
});
