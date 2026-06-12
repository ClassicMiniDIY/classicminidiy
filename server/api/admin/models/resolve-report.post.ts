/**
 * POST /api/admin/models/resolve-report  (keystone §8, §9)
 *
 * Admin resolves a model_report. Service-role so it can, in one shot:
 *   - mark the report resolved/dismissed with the chosen resolution_action,
 *   - on `takedown`, unpublish the model (status='removed' — S3 objects are
 *     retained 90d for disputes per §8; entitlement/download stop immediately),
 *   - enqueue the reporter's `model_report_resolved` notification,
 *   - write the admin_audit_log entry.
 *
 *   body: { reportId, action: 'none'|'takedown'|'warning'|'edit_required',
 *           status?: 'resolved'|'dismissed', notes? }
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

const ACTIONS = ['none', 'takedown', 'warning', 'edit_required'];

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ reportId?: string; action?: string; status?: string; notes?: string }>(event);

  const reportId = body?.reportId;
  const action = body?.action ?? 'none';
  const status = body?.status === 'dismissed' ? 'dismissed' : 'resolved';
  if (!reportId) throw createError({ statusCode: 400, statusMessage: 'Missing reportId' });
  if (!ACTIONS.includes(action)) throw createError({ statusCode: 400, statusMessage: 'Invalid resolution action' });

  const db = getServiceClient();

  const { data: report, error: rErr } = await db
    .from('model_reports')
    .select('id, model_id, reporter_id, reason, status')
    .eq('id', reportId)
    .single();
  if (rErr || !report) throw createError({ statusCode: 404, statusMessage: 'Report not found' });

  const { error: upErr } = await db
    .from('model_reports')
    .update({
      status,
      resolution_action: action,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message });

  let modelRemoved = false;
  if (action === 'takedown') {
    const { error: mErr } = await db.from('models').update({ status: 'removed' }).eq('id', report.model_id);
    if (mErr) throw createError({ statusCode: 500, statusMessage: mErr.message });
    modelRemoved = true;
  }

  // Registered reporters get a notification; DMCA email intake has no user row.
  if (report.reporter_id) {
    await db.from('notification_queue').insert({
      user_id: report.reporter_id,
      event_type: 'model_report_resolved',
      payload: { model_id: report.model_id, report_id: report.id, action, status },
      channel: 'email',
      batch_key: `model_report:${report.id}`,
    });
  }

  await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: action === 'takedown' ? 'model_takedown' : 'model_report_resolved',
    target_type: 'model_report',
    target_id: report.id,
    details: { model_id: report.model_id, reason: report.reason, action, status, notes: body?.notes ?? null },
  });

  return { ok: true, modelRemoved };
});
