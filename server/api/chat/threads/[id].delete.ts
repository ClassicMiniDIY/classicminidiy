import { requireChatThreadAccess } from '../../../utils/chatThreads';

/** Delete one conversation. Idempotent — a missing row is still a success. */
export default defineEventHandler(async (event) => {
  const { supabase } = await requireChatThreadAccess(event);
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thread id is required' });

  const { error } = await supabase.from('chat_threads').delete().eq('id', id);

  if (error) {
    console.error(`[Chat Threads] delete failed: ${error.message}`);
    throw createError({ statusCode: 502, statusMessage: 'Could not delete that conversation' });
  }

  // Deliberately not 404 on a miss. The client deletes locally first, so a
  // retry after a dropped connection must not surface as an error for work
  // that already succeeded.
  return { deleted: true };
});
