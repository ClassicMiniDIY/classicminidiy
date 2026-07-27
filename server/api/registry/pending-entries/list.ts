import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * Pending rows that live directly on `registry_entries`, as opposed to the
 * submissions in `submission_queue` that /api/registry/queue/list returns.
 *
 * These exist because the DynamoDB MiniRegisterQueue held submissions that were
 * never approved and never migrated. They could not be replayed through
 * submission_queue — `submitted_by` there is NOT NULL and references profiles,
 * and none of those submitters ever had an account (see
 * classicminidiy-supabase migration 20260727000004). So they were imported
 * straight onto registry_entries with status 'pending', where the RLS policy
 * keeps them invisible to the public until reviewed.
 *
 * Service client: `legacy_submitted_by_email` is revoked from anon and
 * authenticated, so the submitter's contact details are only reachable here.
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);

  // No caching: this is a moderation queue, and a stale list means double-review.
  setResponseHeaders(event, { 'Cache-Control': 'no-store' });

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('registry_entries')
    .select(
      'id, year, model, body_number, engine_number, engine_size, body_type, color, trim, notes, legacy_submitted_by, legacy_submitted_by_email, legacy_id, submitted_by, created_at'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    year: row.year,
    model: row.model || '',
    bodyNum: row.body_number || '',
    engineNum: row.engine_number || '',
    engineSize: row.engine_size || 0,
    bodyType: row.body_type || '',
    color: row.color || '',
    trim: row.trim || '',
    notes: row.notes || '',
    submittedBy: row.legacy_submitted_by || '',
    submittedByEmail: row.legacy_submitted_by_email || '',
    legacyId: row.legacy_id || null,
    // Non-null means a real account submitted it, which the moderate endpoint
    // refuses to act on — those belong in the trust-tracked queue flow.
    ownerId: row.submitted_by || null,
    createdAt: row.created_at,
  }));
});
