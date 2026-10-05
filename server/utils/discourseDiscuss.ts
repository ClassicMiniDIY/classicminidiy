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
 * Every forum call counts against the forum's admin API limiter, which is ONE
 * counter shared by every admin key (the flair sync and the importers use it
 * too). The route caches results in KV so these calls are rare.
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
const FORUM_CALL_TIMEOUT_MS = 5000;
/** Budget for the whole find-or-create (up to three calls). */
export const FORUM_TOTAL_BUDGET_MS = 8000;

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

/** A timeout signal for the next call: the per-call limit or what is left of the budget. */
function callSignal(deadline: number): AbortSignal {
  const left = deadline - Date.now();
  if (left <= 0) throw new DiscourseDiscussError('forum time budget spent');
  return AbortSignal.timeout(Math.min(FORUM_CALL_TIMEOUT_MS, left));
}

/**
 * A topic URL on the configured forum origin from a Location header, with the
 * `.json` suffix, query and fragment removed. Only the host is compared: Rails
 * builds the Location from the request protocol, which can arrive as `http`
 * behind the tunnel, so the URL is rebuilt on the configured https origin.
 * Null when the host differs or the path is not a topic path.
 */
export function forumTopicUrl(location: string, forum: string): string | null {
  let url: URL;
  try {
    url = new URL(location, forum);
  } catch {
    return null;
  }
  if (url.host !== new URL(forum).host || !url.pathname.startsWith('/t/')) return null;
  return `${forum}${url.pathname.replace(/\.json$/, '')}`;
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
export async function findDiscussTopic(
  config: DiscourseDiscussConfig,
  externalId: string,
  deadline = Date.now() + FORUM_TOTAL_BUDGET_MS
): Promise<string | null> {
  const res = await fetch(`${config.forum}/t/external_id/${encodeURIComponent(externalId)}.json`, {
    headers: apiHeaders(config),
    redirect: 'manual',
    signal: callSignal(deadline),
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

/** The result of a create: the topic URL, or the forum's 422 reasons. */
export type CreateDiscussResult = { url: string } | { refused: string[] };

/** Discourse's `errors` array from a 422 body: strings only, bounded. */
function refusalReasons(body: unknown): string[] {
  const errors = (body as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .filter((e): e is string => typeof e === 'string')
    .slice(0, 5)
    .map((e) => e.slice(0, 200));
}

/**
 * Create the topic. Returns its URL, or the 422 reasons (for example, a
 * parallel request created it first, or the title is taken). Throws otherwise.
 */
export async function createDiscussTopic(
  config: DiscourseDiscussConfig,
  request: DiscussTopicRequest,
  deadline = Date.now() + FORUM_TOTAL_BUDGET_MS
): Promise<CreateDiscussResult> {
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
    signal: callSignal(deadline),
  });

  if (res.status === 422) {
    return { refused: refusalReasons(await res.json().catch(() => null)) };
  }
  if (!res.ok) throw new DiscourseDiscussError('create failed', res.status);

  const body = (await res.json().catch(() => null)) as {
    topic_id?: unknown;
    topic_slug?: unknown;
  } | null;
  // A post sent to the review queue answers 200 with `action: "enqueued"` and no topic.
  const url = body ? topicUrlFromIds(config.forum, body.topic_slug, body.topic_id) : null;
  if (!url) throw new DiscourseDiscussError('create answer has no topic id', res.status);
  return { url };
}

/**
 * Find the topic, create it when missing, and look again once after a 422.
 * The whole sequence shares one time budget.
 */
export async function findOrCreateDiscussTopic(
  config: DiscourseDiscussConfig,
  request: DiscussTopicRequest,
  budgetMs = FORUM_TOTAL_BUDGET_MS
): Promise<string> {
  const deadline = Date.now() + budgetMs;

  const existing = await findDiscussTopic(config, request.externalId, deadline);
  if (existing) return existing;

  const created = await createDiscussTopic(config, request, deadline);
  if ('url' in created) return created.url;

  const raced = await findDiscussTopic(config, request.externalId, deadline);
  if (raced) return raced;

  const reasons = created.refused.length ? created.refused.join('; ') : 'no reason given';
  throw new DiscourseDiscussError(`create refused and no topic found: ${reasons}`, 422);
}
