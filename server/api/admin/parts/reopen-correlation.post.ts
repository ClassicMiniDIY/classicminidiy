/**
 * POST /api/admin/parts/reopen-correlation  (admin — undo "no factory equivalent")
 *
 * A record closed with `noEquivalent` leaves the scorer's view. Reopening is a
 * SQL function, not a column edit from here, because two things must happen
 * together: the state and the scoring watermark are cleared so the next scorer
 * pass proposes again, and the record's superseded rows are deleted, or the
 * scorer's conflict guard would refuse to propose those same parts a second
 * time. Approved and rejected verdicts are kept.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ recordId?: string }>(event);

  const recordId = body?.recordId;
  if (!recordId || !/^[0-9a-f-]{36}$/i.test(recordId)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recordId' });
  }

  const db = getServiceClient();

  const { data: existing, error: readError } = await db
    .from('part_source_records')
    .select('id, title, part_number_as_listed, correlation_state')
    .eq('id', recordId)
    .maybeSingle();
  if (readError || !existing) {
    throw createError({ statusCode: 404, statusMessage: 'Record not found' });
  }
  if (existing.correlation_state !== 'no_factory_equivalent') {
    throw createError({ statusCode: 409, statusMessage: 'Record is not closed' });
  }

  const { error } = await db.rpc('reopen_part_correlation', { p_record_id: recordId });
  if (error) {
    console.error('[admin/parts/reopen-correlation] failed:', error.message);
    throw createError({ statusCode: 502, statusMessage: 'Could not reopen the record' });
  }

  const { error: auditError } = await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: 'part_correlation_reopened',
    target_type: 'part_source_record',
    target_id: recordId,
    details: {
      listed_number: existing.part_number_as_listed ?? null,
      listed_as: existing.title ?? null,
    },
  });
  if (auditError) console.warn('[admin/parts/reopen-correlation] audit write failed:', auditError.message);

  return { ok: true, recordId };
});
