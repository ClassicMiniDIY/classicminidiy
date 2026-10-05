/**
 * GET /api/community/discuss/topic?page=<key>  →  { topicId: number | null }
 *
 * The forum topic id for a knowledgebase page, for the comment embed
 * (CommunityDiscussEmbed). Design: docs/plans/2026-10-05-community-discuss-links.md.
 *
 * READ-ONLY. It reads the KV mapping that GET /api/community/discuss writes and
 * nothing else: it never calls the forum, so a page view never spends the
 * forum's shared admin API limit and never creates a topic. A miss, a cached
 * failure, an unknown key or an unreadable store is `{ topicId: null }`, and the
 * page shows only the "Discuss this" link.
 */
import { communityDiscussPage, type CommunityDiscussKey } from '../../../../shared/utils/communityDiscuss';
import { clientIp } from '../../../utils/clientIp';
import { discussTopicIdFromUrl, readDiscussCache } from '../../../utils/discussCache';
import { consumeRateLimit } from '../../../utils/rateLimit';

/** Per-IP: one read per page view; a loop gets nulls instead of KV reads. */
const RATE_LIMIT = { max: 60, windowMs: 60_000 };

export default defineEventHandler(async (event) => {
  const rawKey = getQuery(event).page;
  if (!communityDiscussPage(rawKey)) {
    setHeader(event, 'Cache-Control', 'public, max-age=3600');
    return { topicId: null };
  }

  if (consumeRateLimit(`community-discuss-topic:${clientIp(event)}`, RATE_LIMIT).limited) {
    setHeader(event, 'Cache-Control', 'no-store');
    return { topicId: null };
  }

  let topicId: number | null = null;
  try {
    const entry = await readDiscussCache(rawKey as CommunityDiscussKey);
    if (entry && 'url' in entry) topicId = discussTopicIdFromUrl(entry.url);
  } catch (error) {
    console.error(`[community-discuss] ${String(rawKey)}: topic read failed: ${(error as Error).message}`);
  }

  // Short browser cache: a new topic shows up within minutes, and a page that is
  // browsed back and forth does not re-read KV.
  setHeader(event, 'Cache-Control', topicId ? 'public, max-age=300' : 'public, max-age=60');
  return { topicId };
});
