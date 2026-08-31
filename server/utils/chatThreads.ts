import type { H3Event } from 'h3';
import { getServiceClient } from './supabase';
import { requireUserClient } from './userAuth';
import { CHAT_TIER_CACHE_TTL_SECONDS, SUSTAINING_PRODUCT_ID, chatTierCacheId } from './chatTiers';

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

  // Cached, the same way chat-auth caches the identical lookup. A push happens
  // after every answer and a pull on every page load, so without this an active
  // member generates a steady stream of identical RPCs — and a reader seeing
  // the cached version next door would reasonably assume this one was too.
  const cacheStorage = useStorage('cache');
  const cacheId = chatTierCacheId(`member:${user.id}`);
  const cached = (await cacheStorage.getItem(cacheId).catch(() => null)) as { member: boolean } | null;

  if (cached?.member === true) return { user, supabase };
  if (cached?.member === false) throw notAMemberError();

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

  // Only a resolved answer is cached. An RPC error above already threw, so a
  // transient failure is never written as "not a member" and held for the TTL.
  const write = cacheStorage
    .setItem(cacheId, { member: isMember === true }, { ttl: CHAT_TIER_CACHE_TTL_SECONDS })
    .catch(() => {});
  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(write);

  if (isMember !== true) throw notAMemberError();

  return { user, supabase };
}

function notAMemberError() {
  return createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Synced conversation history is a Sustaining Member benefit.',
  });
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
