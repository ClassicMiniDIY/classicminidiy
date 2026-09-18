import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';
import type { Json } from '~~/types/database';

/**
 * POST /api/admin/typesafe/part-gate  { sourceId, source, confidence, margin? }
 *
 * Move one part source's correlation gate: which score it reads (`trigram` |
 * `model`) and the confidence it auto-approves at. The gate function itself
 * still refuses 1.000, so that value keeps "review everything". Audited.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ sourceId?: unknown; source?: unknown; confidence?: unknown; margin?: unknown }>(event);
  const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : '';
  const source = body?.source === 'model' || body?.source === 'trigram' ? body.source : '';
  const confidence = Number(body?.confidence);
  const margin = body?.margin === undefined || body?.margin === null ? null : Number(body.margin);
  if (!sourceId || !source) throw createError({ statusCode: 400, statusMessage: 'Missing source' });
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
    throw createError({ statusCode: 400, statusMessage: 'Confidence must be in (0, 1]' });
  }
  if (margin !== null && (!Number.isFinite(margin) || margin < 0 || margin > 1)) {
    throw createError({ statusCode: 400, statusMessage: 'Margin must be in [0, 1]' });
  }

  const db = getServiceClient();
  const { data, error } = await db.rpc('set_part_source_auto_approve', {
    p_source_id: sourceId,
    p_source: source,
    p_confidence: confidence,
    p_margin: margin ?? undefined,
  });
  if (error) throw createError({ statusCode: 400, statusMessage: error.message });

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'part_source_gate_set',
    target_type: 'part_source',
    target_id: sourceId,
    details: (data ?? {}) as Json,
  });

  return { success: true, result: data };
});
