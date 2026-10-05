/**
 * Find or create the forum topic for one knowledgebase page.
 * Design: docs/plans/2026-10-05-community-discuss-links.md.
 *
 * The lookup is by `external_id` (`GET /t/external_id/<id>.json`), because the
 * granular API scope `topics:read` covers it and no granular scope covers
 * `/embed/info.json`. The create (`POST /posts.json`, scope `topics:write`)
 * sends `external_id` and `embed_url` together. The forum keeps `external_id`
 * unique, so a parallel create fails with a 422 and the lookup runs once more.
 *
 * Every function here throws on any failure. The caller turns a throw into a
 * redirect to the forum search. Never log the API key.
 */

export interface DiscourseDiscussConfig {
  /** Forum origin, https, no trailing slash. */
  forum: string;
  apiKey: string;
  apiUsername: string;
  categoryId: number;
}

export interface DiscussTopicRequest {
  externalId: string;
  title: string;
  /** Canonical page URL on this site. */
  pageUrl: string;
}

/** Per-call timeout for forum requests. */
const FORUM_TIMEOUT_MS = 5000;

export class DiscourseDiscussError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'DiscourseDiscussError';
  }
}

function apiHeaders(config: DiscourseDiscussConfig): Record<string, string> {
  return {
    'Api-Key': config.apiKey,
    'Api-Username': config.apiUsername,
    Accept: 'application/json',
  };
}

/**
 * A topic URL on the forum origin from a Location header or a path, with the
 * `.json` suffix, query and fragment removed. Null when it leaves the origin
 * or is not a topic path.
 */
export function forumTopicUrl(location: string, forum: string): string | null {
  let url: URL;
  try {
    url = new URL(location, forum);
  } catch {
    return null;
  }
  if (url.origin !== forum || !url.pathname.startsWith('/t/')) return null;
  return `${url.origin}${url.pathname.replace(/\.json$/, '')}`;
}

function topicUrlFromIds(forum: string, slug: unknown, id: unknown): string | null {
  const topicId = Number(id);
  if (!Number.isInteger(topicId) || topicId <= 0) return null;
  const safeSlug = typeof slug === 'string' && /^[\w-]+$/.test(slug) ? slug : 'topic';
  return `${forum}/t/${safeSlug}/${topicId}`;
}

/**
 * The topic URL for `externalId`, or null when the forum has no such topic
 * (404). Throws on any other answer.
 */
export async function findDiscussTopic(config: DiscourseDiscussConfig, externalId: string): Promise<string | null> {
  const res = await fetch(`${config.forum}/t/external_id/${encodeURIComponent(externalId)}.json`, {
    headers: apiHeaders(config),
    redirect: 'manual',
    signal: AbortSignal.timeout(FORUM_TIMEOUT_MS),
  });

  if (res.status === 404) return null;

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    const url = location ? forumTopicUrl(location, config.forum) : null;
    if (!url) throw new DiscourseDiscussError('lookup redirect is not a forum topic', res.status);
    return url;
  }

  if (res.ok) {
    // A runtime that followed the redirect anyway: read the topic JSON.
    const body = (await res.json().catch(() => null)) as { id?: unknown; slug?: unknown } | null;
    const url = body ? topicUrlFromIds(config.forum, body.slug, body.id) : null;
    if (!url) throw new DiscourseDiscussError('lookup answer has no topic id', res.status);
    return url;
  }

  throw new DiscourseDiscussError('lookup failed', res.status);
}

/** The first post of a page topic. English, like the forum. */
export function discussTopicBody(request: DiscussTopicRequest): string {
  return [
    `This topic is for the **${request.title}** page on Classic Mini DIY:`,
    request.pageUrl,
    '',
    'Ask questions about it, share what you know, and point out anything that looks wrong. ' +
      'To correct a value on the page itself, use "Suggest a correction" on the page.',
  ].join('\n');
}

/**
 * Create the topic. Returns its URL, or null when the forum refused it with a
 * 422 (for example, a parallel request created it first). Throws otherwise.
 */
export async function createDiscussTopic(
  config: DiscourseDiscussConfig,
  request: DiscussTopicRequest
): Promise<string | null> {
  const res = await fetch(`${config.forum}/posts.json`, {
    method: 'POST',
    headers: { ...apiHeaders(config), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: request.title,
      raw: discussTopicBody(request),
      category: config.categoryId,
      embed_url: request.pageUrl,
      external_id: request.externalId,
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(FORUM_TIMEOUT_MS),
  });

  if (res.status === 422) return null;
  if (!res.ok) throw new DiscourseDiscussError('create failed', res.status);

  const body = (await res.json().catch(() => null)) as {
    topic_id?: unknown;
    topic_slug?: unknown;
    action?: unknown;
  } | null;
  // A post sent to the review queue answers 200 with `action: "enqueued"` and no topic.
  const url = body ? topicUrlFromIds(config.forum, body.topic_slug, body.topic_id) : null;
  if (!url) throw new DiscourseDiscussError('create answer has no topic id', res.status);
  return url;
}

/** Find the topic, create it when missing, and look again once after a 422. */
export async function findOrCreateDiscussTopic(
  config: DiscourseDiscussConfig,
  request: DiscussTopicRequest
): Promise<string> {
  const existing = await findDiscussTopic(config, request.externalId);
  if (existing) return existing;

  const created = await createDiscussTopic(config, request);
  if (created) return created;

  const raced = await findDiscussTopic(config, request.externalId);
  if (raced) return raced;
  throw new DiscourseDiscussError('create refused and no topic found', 422);
}
