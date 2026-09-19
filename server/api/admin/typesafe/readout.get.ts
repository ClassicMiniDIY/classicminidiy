import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';
import { TYPESAFE_SURFACES, typesafeEnvMode, typesafeSettingKey } from '../../../utils/typesafeModes';

/**
 * GET /api/admin/typesafe/readout?days=7
 *
 * One document for `/admin/typesafe`: the private repo's `typesafe_readout()`
 * (cost per caller and the numbers behind each graduation decision) plus the
 * effective mode per surface, which only the Worker knows because the env
 * fallback lives here. The page grades; nothing here decides.
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const raw = Number(getQuery(event).days);
  const days = raw === 30 || raw === 90 ? raw : 7;

  const db = getServiceClient();
  const [{ data, error }, reviewRes] = await Promise.all([
    db.rpc('typesafe_readout', { p_days: days }),
    db.rpc('typesafe_review_readout', { p_days: days }),
  ]);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  if (reviewRes.error) console.warn('[typesafe] review readout failed:', reviewRes.error.message);
  const readout: Record<string, unknown> = {
    ...((data ?? {}) as Record<string, unknown>),
    review: reviewRes.data ?? null,
  };
  const settings = (readout.settings ?? {}) as Record<string, { value: unknown; updated_at: string }>;

  const modes = TYPESAFE_SURFACES.map((surface) => {
    const key = typesafeSettingKey(surface);
    const row = settings[key];
    const rowValue = typeof row?.value === 'string' ? row.value : null;
    const env = typesafeEnvMode(event, surface);
    return { surface, key, row: rowValue, env, effective: rowValue ?? env, updatedAt: row?.updated_at ?? null };
  });
  const screenRow = settings.message_screen_mode;
  const savedRow = settings.saved_search_semantic_mode;

  return {
    days,
    modes,
    screenMode: typeof screenRow?.value === 'string' ? screenRow.value : 'off',
    savedSearchMode: typeof savedRow?.value === 'string' ? savedRow.value : 'off',
    readout,
  };
});
