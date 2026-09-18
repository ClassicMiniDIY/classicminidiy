import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';
import type { Json } from '~~/types/database';

/**
 * POST /api/admin/typesafe/part-gate  { sourceId, source, confidence, margin?, closeConfidence?, closeNoneFit? }
 *
 * Move one part source's two dials: the gate (which score it reads, `trigram`
 * | `model`, and the confidence it auto-approves at; 1.000 stays "review
 * everything") and the floor (the best score under which a record the model
 * also calls "none fit" is closed as no factory equivalent; 0 is off). The
 * private repo's set_part_source_gate() checks the numbers and sweeps the
 * source's backlog at once; the counts come back. Audited.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{
    sourceId?: unknown;
    source?: unknown;
    confidence?: unknown;
    margin?: unknown;
    closeConfidence?: unknown;
    closeNoneFit?: unknown;
  }>(event);
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
  const optional = (v: unknown, lo: number, hi: number, name: string): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi)
      throw createError({ statusCode: 400, statusMessage: `${name} must be in [${lo}, ${hi}]` });
    return n;
  };
  const closeConfidence = optional(body?.closeConfidence, 0, 0.999, 'Floor');
  const closeNoneFit = optional(body?.closeNoneFit, 0.05, 1, 'None-fit');

  const db = getServiceClient();
  const { data, error } = await db.rpc('set_part_source_gate', {
    p_source_id: sourceId,
    p_source: source,
    p_confidence: confidence,
    p_margin: margin ?? undefined,
    p_close_confidence: closeConfidence ?? undefined,
    p_close_none_fit: closeNoneFit ?? undefined,
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
