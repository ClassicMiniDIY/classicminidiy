/**
 * POST /api/admin/parts/set-licence  (admin — the per-source kill switch)
 *
 * Moves one part source between licence states:
 *   none | requested | granted   -> normal operation
 *   declined                     -> every row that source contributed drops out
 *                                   of the public archive at once
 *
 * Enforcement is NOT here. `declined` is read by the RLS policies on all seven
 * public part tables, so the MCP lookup tool, the archive pages, the mobile apps
 * and any future feed go dark together the moment this writes. This route only
 * flips the flag, records why, and stops the crawler.
 *
 * DECLINING ALSO DISABLES THE CRAWL. Hiding a source's rows while continuing to
 * fetch its pages would be the worst of both: we would still be taking the
 * traffic that prompted the complaint, and getting no archive value for it.
 *
 * This is a dedicated route rather than an entry in a generic edit allowlist.
 * `licence_status` is a moderation control, and ADMIN_EDITABLE_COLUMNS /
 * EDIT_TARGETS never gain moderation columns — same reasoning as
 * users/toggle-admin and models/set-status.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

const ALLOWED = ['none', 'requested', 'granted', 'declined'] as const;
type Status = (typeof ALLOWED)[number];

const MIN_REASON = 4;
const MAX_REASON = 500;

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody<{ sourceId?: string; status?: string; reason?: string }>(event);

  const sourceId = body?.sourceId;
  const status = body?.status as Status | undefined;
  const reason = (body?.reason ?? '').trim();

  if (!sourceId) throw createError({ statusCode: 400, statusMessage: 'Missing sourceId' });
  if (!status || !ALLOWED.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: `status must be one of: ${ALLOWED.join(', ')}` });
  }
  // A takedown is the thing most likely to be asked about months later — by the
  // retailer, or by us trying to remember what was agreed. An unattributed
  // status flip answers none of those questions, so the reason is required.
  if (reason.length < MIN_REASON) {
    throw createError({ statusCode: 400, statusMessage: 'A reason is required for a licence change' });
  }
  if (reason.length > MAX_REASON) {
    throw createError({ statusCode: 400, statusMessage: `Reason must be ${MAX_REASON} characters or fewer` });
  }

  const db = getServiceClient();

  const { data: source, error: readError } = await db
    .from('part_sources')
    .select('id, slug, name, licence_status')
    .eq('id', sourceId)
    .single();

  if (readError || !source) throw createError({ statusCode: 404, statusMessage: 'Part source not found' });
  if (source.licence_status === status) return { ok: true, unchanged: true };

  const { error: updateError } = await db
    .from('part_sources')
    .update({ licence_status: status, last_reviewed_at: new Date().toISOString() })
    .eq('id', sourceId);

  if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message });

  // The private half carries the attribution. Upsert rather than update: a
  // source seeded without a private row must not silently lose the note.
  const privatePatch: {
    source_id: string;
    licence_note: string;
    licence_changed_by: string;
    licence_changed_at: string;
    crawl_enabled?: boolean;
  } = {
    source_id: sourceId,
    licence_note: reason,
    licence_changed_by: user.id,
    licence_changed_at: new Date().toISOString(),
  };
  // Only on a decline. Re-granting must not silently restart a crawl that was
  // deliberately switched off.
  if (status === 'declined') privatePatch.crawl_enabled = false;

  const { error: privateError } = await db
    .from('part_source_private')
    .upsert(privatePatch, { onConflict: 'source_id' });

  if (privateError) {
    // The status change already landed and is the part that matters for a
    // takedown, so this does not roll back — but it must be loud, because the
    // record of WHY is what went missing.
    throw createError({
      statusCode: 500,
      statusMessage: `Licence status changed to ${status}, but the reason could not be saved: ${privateError.message}`,
    });
  }

  // Checked, not fire-and-forget. The whole reason this route insists on a
  // reason is that a takedown gets asked about months later; an audit row that
  // silently failed to write answers that question no better than none at all.
  // Handled like the licence-note failure above and for the same reason: the
  // status change stands, but the gap is reported rather than swallowed.
  const { error: auditError } = await db.from('admin_audit_log').insert({
    admin_id: user.id,
    action: status === 'declined' ? 'part_source_declined' : 'part_source_licence_changed',
    target_type: 'part_source',
    target_id: sourceId,
    details: { from: source.licence_status, to: status, slug: source.slug, name: source.name, reason },
  });

  if (auditError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Licence status changed to ${status}, but the audit entry could not be written: ${auditError.message}`,
    });
  }

  return { ok: true, from: source.licence_status, to: status };
});
