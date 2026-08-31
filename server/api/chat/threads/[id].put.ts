import type { Json } from '~~/types/database';
import { requireChatThreadAccess, toSummary } from '../../../utils/chatThreads';

/**
 * Create or update one conversation.
 *
 * The id is MINTED BY THE CLIENT, so this is an upsert rather than a POST — the
 * conversation already has an identity locally before it is ever synced, and
 * giving it a second server-side one would make the merge unable to tell the
 * two apart.
 */

/** Matches the client's own cap and the trigger's, so all three agree. */
const MAX_MESSAGES = 200;
const MAX_TITLE = 200;
/** A transcript far past anything the chat produces is a broken or hostile client. */
const MAX_BYTES = 512_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireChatThreadAccess(event);
  const id = getRouterParam(event, 'id');

  // The id becomes a primary key, so it is validated rather than trusted. RLS
  // stops cross-account writes; this stops a malformed key.
  if (!id || !UUID.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'A UUID thread id is required' });
  }

  // Typed as Json rather than unknown[]: the column is jsonb, and the client
  // owns the message shape (AI SDK UI messages), so this route deliberately
  // does not restate it — it validates size and count and passes it through.
  const body = await readBody<{ title?: string; messages?: Json[] }>(event);
  const messages = Array.isArray(body?.messages) ? body.messages : null;

  if (!messages) throw createError({ statusCode: 400, statusMessage: 'messages must be an array' });
  if (messages.length > MAX_MESSAGES) {
    throw createError({ statusCode: 413, statusMessage: 'Conversation too long to sync' });
  }

  const serialised = JSON.stringify(messages);
  if (serialised.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Conversation too large to sync' });
  }

  const { data, error } = await supabase
    .from('chat_threads')
    .upsert(
      {
        id,
        user_id: user.id,
        title: (body?.title ?? '').slice(0, MAX_TITLE),
        messages,
        message_count: messages.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, title, message_count, created_at, updated_at')
    .single();

  if (error) {
    console.error(`[Chat Threads] upsert failed: ${error.message}`);
    throw createError({ statusCode: 502, statusMessage: 'Could not save that conversation' });
  }

  return toSummary(data);
});
