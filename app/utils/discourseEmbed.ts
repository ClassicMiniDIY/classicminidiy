/**
 * Discourse comment embed helpers for CommunityDiscussEmbed.
 * Design: docs/plans/2026-10-05-community-discuss-links.md ("Comment embeds").
 *
 * The forum's embed page (`/embed/comments`, script `embed-application.js`)
 * posts `{ type: 'discourse-resize', height }` on load and
 * `{ type: 'discourse-scroll', top }` when a post link is clicked, to the
 * parent with targetOrigin = the Referer it received. This is the receiving
 * half of Discourse's `public/javascripts/embed.js`, with a strict origin check
 * (embed.js uses a substring match) and a source check.
 */

const DEFAULT_FORUM_ORIGIN = 'https://community.classicminidiy.com';

/** Bounds for the iframe height, so a bad message cannot collapse or balloon the page. */
export const DISCOURSE_EMBED_MIN_HEIGHT = 120;
export const DISCOURSE_EMBED_MAX_HEIGHT = 8000;

export type DiscourseEmbedMessage = { type: 'resize'; height: number } | { type: 'scroll'; top: number };

/** The https origin of the configured forum URL, or the default forum origin. */
export function discourseEmbedOrigin(configured: unknown): string {
  if (typeof configured !== 'string' || !configured) return DEFAULT_FORUM_ORIGIN;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' ? url.origin : DEFAULT_FORUM_ORIGIN;
  } catch {
    return DEFAULT_FORUM_ORIGIN;
  }
}

/**
 * The comments iframe URL for a topic. `topic_id` only, never `embed_url`: an
 * unknown `embed_url` makes the forum queue a crawl that creates a topic.
 * `class_name` lands on the embed's `<html>`, so the forum's embedded theme
 * CSS can follow the site's light or dark mode.
 */
export function discourseEmbedSrc(origin: string, topicId: number, dark: boolean): string {
  const params = new URLSearchParams({
    topic_id: String(topicId),
    class_name: dark ? 'cmdiy-embed-dark' : 'cmdiy-embed-light',
  });
  return `${origin}/embed/comments?${params.toString()}`;
}

/**
 * A resize or scroll message from OUR comments iframe, or null. The origin must
 * equal the forum origin exactly, and the source must be the iframe's window.
 */
export function readDiscourseEmbedMessage(
  event: Pick<MessageEvent, 'origin' | 'data' | 'source'>,
  forumOrigin: string,
  frameWindow: unknown
): DiscourseEmbedMessage | null {
  if (event.origin !== forumOrigin) return null;
  if (!frameWindow || event.source !== frameWindow) return null;
  const data = event.data as { type?: unknown; height?: unknown; top?: unknown } | null;
  if (!data || typeof data !== 'object') return null;

  if (data.type === 'discourse-resize') {
    const height = Number(data.height);
    if (!Number.isFinite(height) || height <= 0) return null;
    return {
      type: 'resize',
      height: Math.round(Math.min(DISCOURSE_EMBED_MAX_HEIGHT, Math.max(DISCOURSE_EMBED_MIN_HEIGHT, height))),
    };
  }
  if (data.type === 'discourse-scroll') {
    const top = Number(data.top);
    if (!Number.isFinite(top) || top < 0 || top > DISCOURSE_EMBED_MAX_HEIGHT) return null;
    return { type: 'scroll', top };
  }
  return null;
}
