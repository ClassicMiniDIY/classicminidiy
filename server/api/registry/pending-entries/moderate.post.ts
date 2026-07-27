import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * Approve or reject a pending row that lives directly on `registry_entries`.
 *
 * Scope is deliberately narrow: this only handles the legacy imports that have
 * no submitter account (`submitted_by IS NULL`). See list.ts for why those rows
 * exist outside submission_queue.
 *
 * A pending row WITH a submitter is refused rather than approved here. Every
 * human-reviewed approval surface owes the trust pipeline three things —
 * increment the profiles counters, write a `contributions` ledger row, and call
 * `recalculate_trust_level()` — which the submission_queue trigger does and this
 * endpoint does not. Approving a real user's entry here would silently deny them
 * contribution credit and recreate the "everyone stuck at `new`" bug. Those must
 * go through the queue flow. (Contract:
 * classicminidiy-supabase/docs/plans/2026-07-13-unified-trust-pipeline.md.)
 */
export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);

  const body = await readBody(event);
  const { id, action } = body ?? {};

  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing entry id' });
  }
  if (action !== 'approve' && action !== 'reject') {
    throw createError({ statusCode: 400, statusMessage: "action must be 'approve' or 'reject'" });
  }

  const supabase = getServiceClient();

  const { data: entry, error: fetchError } = await supabase
    .from('registry_entries')
    .select('id, status, submitted_by')
    .eq('id', id)
    .single();

  if (fetchError || !entry) {
    throw createError({ statusCode: 404, statusMessage: 'Register entry not found' });
  }

  if (entry.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: `Entry is already ${entry.status}` });
  }

  if (entry.submitted_by) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'This entry has a submitter account. Approve it through the submission queue so the contributor gets trust credit.',
    });
  }

  const { error: updateError } = await supabase
    .from('registry_entries')
    .update({ status: action === 'approve' ? 'approved' : 'rejected' })
    .eq('id', id)
    // Re-assert both guards in the write itself: without this, two admins acting
    // at once could both pass the checks above and the second would silently
    // re-decide an entry the first already resolved.
    .eq('status', 'pending')
    .is('submitted_by', null);

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  return { success: true, id, status: action === 'approve' ? 'approved' : 'rejected' };
});
