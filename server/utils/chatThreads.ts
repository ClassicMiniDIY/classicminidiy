import type { H3Event } from 'h3';
import { getServiceClient } from './supabase';
import { requireUserClient } from './userAuth';
import { SUSTAINING_PRODUCT_ID } from './chatTiers';

/**
 * Shared guard for the synced-history routes.
 *
 * ## These routes fail CLOSED, unlike `/api/chat`
 *
 * `/api/chat` must never require auth — it is a public assistant and a 401 from
 * it would break the surface's reason to exist. These are different: they read
 * and write an account's own saved conversations, so an unresolvable caller
 * must be refused, not degraded. Do not copy the fail-open posture across.
 *
 * ## RLS is the boundary, not a WHERE clause
 *
 * Every query runs under the CALLER's identity via `requireUserClient`, not the
 * service role, so `chat_threads`' own-row policies are what stop one account
 * reading another's transcripts. A service-role client plus
 * `.eq('user_id', user.id)` would work exactly as well right up until someone
 * adds a query and forgets the filter — and these rows are what people typed.
 */
export async function requireChatThreadAccess(event: H3Event) {
  const { user, supabase } = await requireUserClient(event);

  // Membership is checked with the SERVICE client rather than the caller's:
  // `subscriptions` is not readable under the visitor's own RLS, so asking as
  // them would report "no membership" for a paying member.
  const { data: isMember, error } = await getServiceClient().rpc('user_has_subscription', {
    p_user_id: user.id,
    p_product_id: SUSTAINING_PRODUCT_ID,
  });

  if (error) {
    // Unlike the chat gate, this one does NOT degrade: silently answering "you
    // have no synced history" to a member during an RPC blip would look exactly
    // like their conversations being gone, which is far worse than an error
    // their client can retry.
    console.error(`[Chat Threads] membership lookup failed: ${error.message}`);
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'Could not verify your membership. Please retry shortly.',
    });
  }

  if (isMember !== true) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Synced conversation history is a Sustaining Member benefit.',
    });
  }

  return { user, supabase };
}

/** Row shape the client consumes. `messages` is omitted from list responses. */
export interface ChatThreadSummary {
  threadId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toSummary(row: any): ChatThreadSummary {
  return {
    threadId: row.id,
    title: row.title ?? '',
    messageCount: row.message_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
