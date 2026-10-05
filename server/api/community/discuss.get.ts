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
 *   a crawler, over the per-IP limit, or any forum failure: the forum search
 *   for the page title. It never answers with an error page.
 * - Never log the API key.
 */
import {
  communityDiscussExternalId,
  communityDiscussPage,
  type CommunityDiscussKey,
} from '../../../shared/utils/communityDiscuss';
import { matchBot } from '../../utils/aiBots';
import { getCached, setCache } from '../../utils/cache';
import { clientIp } from '../../utils/clientIp';
import { type DiscourseDiscussConfig, findOrCreateDiscussTopic } from '../../utils/discourseDiscuss';
import { consumeRateLimit } from '../../utils/rateLimit';
import { serverRuntimeConfig } from '../../utils/runtimeConfig';

const DEFAULT_FORUM = 'https://community.classicminidiy.com';
const DEFAULT_SITE = 'https://www.classicminidiy.com';

/** Per-IP: a person clicks this a few times; a loop clicks it hundreds of times. */
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

/** Page key → topic URL, per isolate. Topics do not move. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Generic crawler words, for bots that `matchBot` does not name. */
const CRAWLER_UA = /bot\b|bot\/|crawl|spider|slurp|headless/i;

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

  const cacheKey = `community-discuss:${key}`;
  const cached = await getCached<string>(cacheKey);
  if (cached) return sendRedirect(event, cached, 302);

  if (consumeRateLimit(`community-discuss:${clientIp(event)}`, RATE_LIMIT).limited) {
    return sendRedirect(event, searchUrl, 302);
  }

  const site = httpsOrigin(config.public?.siteUrl) ?? DEFAULT_SITE;
  try {
    const topicUrl = await findOrCreateDiscussTopic(forumConfig, {
      externalId: communityDiscussExternalId(key),
      title: page.title,
      pageUrl: `${site}${page.path}`,
    });
    await setCache(cacheKey, topicUrl, CACHE_TTL_SECONDS);
    return sendRedirect(event, topicUrl, 302);
  } catch (error) {
    const status = (error as { status?: number }).status;
    console.error(`[community-discuss] ${key}: ${(error as Error).message}${status ? ` (${status})` : ''}`);
    return sendRedirect(event, searchUrl, 302);
  }
});
