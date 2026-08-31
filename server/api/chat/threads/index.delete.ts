import { requireChatThreadAccess } from '../../../utils/chatThreads';

/**
 * Delete every synced conversation for this member.
 *
 * Backs the history dialog's "Clear all". These rows are what people typed, so
 * a real delete path matters more than the convenience of the feature — this is
 * what makes syncing something a member can undo rather than something that
 * quietly accumulates.
 */
export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireChatThreadAccess(event);

  // The filter is redundant under RLS and stated anyway: a DELETE with no
  // predicate is one policy change away from being a very bad day.
  const { error } = await supabase.from('chat_threads').delete().eq('user_id', user.id);

  if (error) {
    console.error(`[Chat Threads] clear failed: ${error.message}`);
    throw createError({ statusCode: 502, statusMessage: 'Could not clear your conversations' });
  }

  return { cleared: true };
});
