import { requireChatThreadAccess, toSummary } from '../../../utils/chatThreads';

/** One conversation, with its transcript. */
export default defineEventHandler(async (event) => {
  const { supabase } = await requireChatThreadAccess(event);
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thread id is required' });

  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, title, messages, message_count, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`[Chat Threads] fetch failed: ${error.message}`);
    throw createError({ statusCode: 502, statusMessage: 'Could not load that conversation' });
  }

  // RLS already scopes this to the caller, so a miss is indistinguishable from
  // someone else's id — which is the correct answer to give either way.
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });

  return { ...toSummary(data), messages: data.messages ?? [] };
});
