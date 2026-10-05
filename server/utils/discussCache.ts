/**
 * The page key → forum topic mapping for "Discuss this" links and the comment
 * embeds. Design: docs/plans/2026-10-05-community-discuss-links.md.
 *
 * It lives in the KV-backed `useStorage('cache')` (the `CACHE` binding), shared
 * by every isolate. Only GET /api/community/discuss writes it, after a forum
 * lookup or create. GET /api/community/discuss/topic only reads it, so a page
 * view never spends the forum's shared admin API limit and never creates a topic.
 */
import type { CommunityDiscussKey } from '../../shared/utils/communityDiscuss';

/** What the cache holds for a page key. */
export type DiscussCacheEntry = { url: string } | { failed: true };

/** Storage id for a page key's entry. Never change it: live entries use it. */
export function discussCacheId(key: CommunityDiscussKey): string {
  return `community-discuss:${key}`;
}

/** A cached entry, null on a miss or a malformed value. Throws when the store cannot be read. */
export async function readDiscussCache(key: CommunityDiscussKey): Promise<DiscussCacheEntry | null> {
  const entry = (await useStorage('cache').getItem(discussCacheId(key))) as DiscussCacheEntry | null;
  if (entry && typeof entry === 'object') {
    if ('url' in entry && typeof entry.url === 'string') return entry;
    if ('failed' in entry && entry.failed === true) return entry;
  }
  return null;
}

/** Best effort: a failed write costs one more forum call later, nothing else. */
export async function writeDiscussCache(
  key: CommunityDiscussKey,
  entry: DiscussCacheEntry,
  ttl: number
): Promise<void> {
  try {
    await useStorage('cache').setItem(discussCacheId(key), entry, { ttl });
  } catch (error) {
    console.error(`[community-discuss] ${key}: cache write failed: ${(error as Error).message}`);
  }
}

/** The numeric topic id from a cached topic URL (`…/t/<slug>/<id>`), or null. */
export function discussTopicIdFromUrl(url: string): number | null {
  const match = /\/t\/[^/]+\/(\d+)$/.exec(url);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
