/**
 * Guard for social-image meta tags before nuxt-og-image's `tags:afterResolve`
 * hook runs. That hook calls `.replaceAll()` on the `content` of every
 * `og:image` / `twitter:image` / `twitter:image:src` meta tag and only skips
 * falsy values — a truthy non-string crashes SSR with a 500.
 *
 * Non-strings reach that hook more easily than you'd expect: unhead's flat-meta
 * unpacking (useSeoMeta) coerces an empty-string value to boolean `true`, and a
 * numeric value stays a number. This normalizes both cases: numbers are
 * stringified, everything else non-string is emptied so nuxt-og-image's own
 * falsy guard drops the tag.
 */

interface HeadTagLike {
  tag: string;
  props?: Record<string, unknown>;
}

const SOCIAL_IMAGE_NAMES = new Set(['twitter:image', 'twitter:image:src']);

export function isSocialImageMetaTag(tag: HeadTagLike): boolean {
  if (tag.tag !== 'meta' || !tag.props) return false;
  return tag.props.property === 'og:image' || SOCIAL_IMAGE_NAMES.has(tag.props.name as string);
}

export function normalizeSocialImageContent<T extends HeadTagLike>(tags: T[]): T[] {
  for (const tag of tags) {
    if (!isSocialImageMetaTag(tag)) continue;
    const content = tag.props!.content;
    if (typeof content === 'string' || content == null) continue;
    tag.props!.content = typeof content === 'number' && Number.isFinite(content) ? String(content) : '';
  }
  return tags;
}
