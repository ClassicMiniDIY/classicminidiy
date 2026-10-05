/**
 * GET /api/community/discuss?page=<key>
 *
 * "Discuss this on the community": sends the browser to the ONE forum topic for
 * a knowledgebase page, and creates that topic on first use.
 * Design: docs/plans/2026-10-05-community-discuss-links.md.
 *
 * - `page` is only a key. The title and the page URL come from the allowlist
 *   (`shared/utils/communityDiscuss.ts`) and runtime config, never from the
 *   request, so this route cannot create a topic for anything else.
 * - It always answers with a 302. Unknown key: the forum home. Not configured,
 *   a crawler, over the per-IP limit, a cached failure, or any forum failure:
 *   the forum search for the page title. It never answers with an error page.
 * - Forum calls spend the forum's SHARED admin API limit (the flair sync and the
 *   importers use the same counter). Results, failures included, are cached in
 *   the KV-backed `cache` storage, shared by every isolate. If KV cannot be
 *   read, the route sends the user to search rather than call the forum.
 * - Never log the API key.
 */
import {
  communityDiscussExternalId,
  communityDiscussPage,
  communityDiscussTopicTitle,
  type CommunityDiscussKey,
} from '../../../shared/utils/communityDiscuss';
import { matchBot } from '../../utils/aiBots';
import { clientIp } from '../../utils/clientIp';
import { type DiscourseDiscussConfig, findOrCreateDiscussTopic } from '../../utils/discourseDiscuss';
import { consumeRateLimit } from '../../utils/rateLimit';
import { type DiscussCacheEntry, readDiscussCache, writeDiscussCache } from '../../utils/discussCache';
import { serverRuntimeConfig } from '../../utils/runtimeConfig';

const DEFAULT_FORUM = 'https://community.classicminidiy.com';
const DEFAULT_SITE = 'https://www.classicminidiy.com';

/** Per-IP: a person clicks this a few times; a loop clicks it hundreds of times. */
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

/**
 * A found topic does not move: keep the mapping for a year. The comment embeds
 * read only this mapping, so a short TTL would hide a page's discussion until
 * someone clicked "Discuss this" again. If a moderator deletes a page topic,
 * delete its KV key (docs/plans/2026-10-05-community-discuss-links.md).
 */
const DISCUSS_TOPIC_TTL_SECONDS = 365 * 24 * 60 * 60;
/** A failure (forum down, create refused) is retried after 10 minutes. KV's minimum TTL is 60 s. */
const DISCUSS_FAILURE_TTL_SECONDS = 10 * 60;

/** Generic crawler words, for bots that `matchBot` does not name. `\bbot\b` so "CUBOT" phones pass. */
const CRAWLER_UA = /\bbot\b|bot\/|crawl|spider|slurp|headless/i;

/** The https origin of a configured URL, or null. */
function httpsOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return true;
  return matchBot(userAgent) !== null || CRAWLER_UA.test(userAgent);
}

/** The forum config, or null when any value is missing or malformed. */
function discussConfig(config: Record<string, any>, forum: string): DiscourseDiscussConfig | null {
  const apiKey = typeof config.DISCOURSE_API_KEY === 'string' ? config.DISCOURSE_API_KEY.trim() : '';
  const apiUsername = typeof config.DISCOURSE_API_USERNAME === 'string' ? config.DISCOURSE_API_USERNAME.trim() : '';
  const categoryId = Number(String(config.DISCOURSE_DISCUSS_CATEGORY_ID ?? '').trim());
  if (!apiKey || !apiUsername || !Number.isInteger(categoryId) || categoryId <= 0) return null;
  return { forum, apiKey, apiUsername, categoryId };
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow');

  const config = serverRuntimeConfig(event) as unknown as Record<string, any>;
  const forum = httpsOrigin(config.public?.discourseUrl) ?? DEFAULT_FORUM;

  const rawKey = getQuery(event).page;
  const page = communityDiscussPage(rawKey);
  if (!page) return sendRedirect(event, `${forum}/`, 302);
  const key = rawKey as CommunityDiscussKey;

  const searchUrl = `${forum}/search?q=${encodeURIComponent(page.title)}`;

  const forumConfig = discussConfig(config, forum);
  if (!forumConfig) return sendRedirect(event, searchUrl, 302);

  if (isCrawler(getHeader(event, 'user-agent'))) return sendRedirect(event, searchUrl, 302);

  let cached: DiscussCacheEntry | null;
  try {
    cached = await readDiscussCache(key);
  } catch (error) {
    // Without the shared cache every click would reach the forum's shared limiter.
    console.error(`[community-discuss] ${key}: cache read failed: ${(error as Error).message}`);
    return sendRedirect(event, searchUrl, 302);
  }
  if (cached) return sendRedirect(event, 'url' in cached ? cached.url : searchUrl, 302);

  if (consumeRateLimit(`community-discuss:${clientIp(event)}`, RATE_LIMIT).limited) {
    return sendRedirect(event, searchUrl, 302);
  }

  const site = httpsOrigin(config.public?.siteUrl) ?? DEFAULT_SITE;
  try {
    const topicUrl = await findOrCreateDiscussTopic(forumConfig, {
      externalId: communityDiscussExternalId(key),
      title: communityDiscussTopicTitle(page),
      pageUrl: `${site}${page.path}`,
    });
    await writeDiscussCache(key, { url: topicUrl }, DISCUSS_TOPIC_TTL_SECONDS);
    return sendRedirect(event, topicUrl, 302);
  } catch (error) {
    const status = (error as { status?: number }).status;
    console.error(`[community-discuss] ${key}: ${(error as Error).message}${status ? ` (${status})` : ''}`);
    await writeDiscussCache(key, { failed: true }, DISCUSS_FAILURE_TTL_SECONDS);
    return sendRedirect(event, searchUrl, 302);
  }
});
