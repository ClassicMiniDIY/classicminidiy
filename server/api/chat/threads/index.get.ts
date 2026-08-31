import { requireChatThreadAccess, toSummary } from '../../../utils/chatThreads';

/**
 * List this member's synced conversations, newest first.
 *
 * Deliberately WITHOUT `messages`. The history dialog only needs titles and
 * counts, and twenty transcripts is easily over a megabyte — sending them all
 * to render a list would make opening the dialog slower than the chat itself.
 * A transcript is fetched by id when a conversation is actually opened.
 */
export default defineEventHandler(async (event) => {
  const { supabase } = await requireChatThreadAccess(event);

  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, title, message_count, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(`[Chat Threads] list failed: ${error.message}`);
    throw createError({ statusCode: 502, statusMessage: 'Could not load your conversations' });
  }

  return { threads: (data ?? []).map(toSummary) };
});
