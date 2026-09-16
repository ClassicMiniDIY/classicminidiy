import { peekChatQuota } from '../../utils/chatQuota';
import { logNativeChatClient } from '../../utils/chatUsage';

/**
 * GET /api/chat/quota — the caller's chat allowance, read without spending it.
 *
 * Feeds the search palette's "Ask DIY Mini Bot" row (design
 * docs/plans/2026-09-14-unified-search.md §5). The tier comes from
 * `server/middleware/chat-auth.ts`, which lists this path beside `/api/chat`
 * so the answer is for the same caller the chat route would see.
 *
 * Public and unauthenticated like the chat itself; an anonymous caller learns
 * only their own opaque bucket's count. Never cached at the edge: the number
 * is per caller.
 *
 * The native apps peek on every chat-screen open (design §5.4.1). The
 * `x-cmdiy-client` header is read here for the log only; a peek is not a run
 * and gets no analytics event.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  logNativeChatClient(event, 'quota peek');
  return peekChatQuota(event);
});
