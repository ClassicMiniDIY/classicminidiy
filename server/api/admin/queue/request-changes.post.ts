import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * "Ask for changes" — the third review outcome (design S12).
 *
 * Deliberately separate from reject: `changes_requested` touches none of the
 * contributor's counters (see handle_submission_approved), so the submission
 * stays alive, shows on their profile with the reviewer's note, and can come
 * back without a rejection on their record. A reviewer should never have to pick
 * between "penalise them" and "let it through".
 *
 * The note is the whole point of this action, so it is required.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { id, reviewerNotes } = body;

  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing submission id' });
  }

  const notes = typeof reviewerNotes === 'string' ? reviewerNotes.trim() : '';
  if (!notes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tell the contributor what needs changing — the note is what they act on',
    });
  }

  const { error } = await supabase
    .from('submission_queue')
    .update({
      status: 'changes_requested',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes.slice(0, 2000),
    })
    .eq('id', id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});
