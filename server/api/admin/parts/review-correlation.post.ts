/**
 * POST /api/admin/parts/review-correlation  (admin — decide one correlation)
 *
 * THE ONLY DOOR. Approving here is what writes `part_source_records.part_id` for
 * a source that publishes its own catalogue numbering, and that is what puts a
 * retailer's buy link on a factory part's page. Nothing else writes it for such a
 * source — not the ingest, which cannot match a Moss `114-403` to anything, and
 * not the scorer, which only proposes.
 *
 * The write itself is `review_part_correlation`, a SQL function, so the three
 * things that must happen together do: the decision is recorded, the losing
 * candidates for that record are superseded rather than deleted, and the record's
 * `part_id` is set. Doing that as three statements from here would leave a
 * half-applied decision behind any failure between them.
 *
 * REJECTING ALSO UNDOES. A correlation that had been approved — by a human or by
 * the threshold — and is now rejected clears the `part_id` it set. Otherwise
 * "reject" would remove the row from the queue and leave the wrong buy link on
 * the page, which is the failure the queue exists to prevent, made permanent.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ id?: string; approve?: boolean; note?: string }>(event);

  const id = body?.id;
  const approve = body?.approve;
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  if (typeof approve !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'approve must be true or false' });
  }
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : null;

  const db = getServiceClient();

  // Read it first, so the audit entry can say WHAT was decided rather than just
  // that something was. A correlation id means nothing in a log six months on.
  const { data: existing, error: readError } = await db
    .from('part_number_correlations')
    .select(
      `id, status, confidence,
       part_source_records!inner ( part_number_as_listed, title ),
       parts!inner ( part_number_display )`
    )
    .eq('id', id)
    .maybeSingle();

  if (readError || !existing) {
    throw createError({ statusCode: 404, statusMessage: 'Correlation not found' });
  }

  const { error } = await db.rpc('review_part_correlation', {
    p_correlation_id: id,
    p_approve: approve,
    // The generated signature has `p_note?: string`, so a null has to become an
    // absent argument rather than an explicit null — the SQL default handles it.
    ...(note ? { p_note: note } : {}),
  });

  if (error) {
    console.error('[admin/parts/review-correlation] failed:', error.message);
    throw createError({ statusCode: 502, statusMessage: 'Could not record the decision' });
  }

  const record = existing.part_source_records as unknown as {
    part_number_as_listed: string | null;
    title: string | null;
  };
  const part = existing.parts as unknown as { part_number_display: string | null };

  // Audited like every other moderation action. This one attaches a commercial
  // link to an archive record on a human's say-so, which is exactly the kind of
  // decision that gets questioned later.
  const { error: auditError } = await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: approve ? 'part_correlation_approved' : 'part_correlation_rejected',
    target_type: 'part_correlation',
    target_id: id,
    details: {
      listed_number: record?.part_number_as_listed ?? null,
      listed_as: record?.title ?? null,
      part_number: part?.part_number_display ?? null,
      confidence: Number(existing.confidence),
      previous_status: existing.status,
      note,
    },
  });
  if (auditError) console.warn('[admin/parts/review-correlation] audit write failed:', auditError.message);

  return { ok: true, id, status: approve ? 'approved' : 'rejected' };
});
