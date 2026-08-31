import { isMarkdownSanitizerReady, renderMessageMarkdown } from './markdown';

/**
 * Memoizes rendered message markdown by message id, and ONLY caches final
 * output.
 *
 * `renderMessageMarkdown` sanitizes with DOMPurify, which is a lazy dynamic
 * import. Until it resolves, the renderer falls back to a regex sanitizer and
 * returns provisional output, planning to produce the real thing on the next
 * render. A cache that stores that provisional result keyed by message id
 * defeats the plan outright: the next render is a cache hit, so the weaker
 * sanitizer's output is what every message rendered before the import landed
 * keeps, permanently. That was the defect this exists to prevent.
 *
 * So: read the readiness flag first, and skip the cache entirely — both the
 * lookup and the store — while output is provisional. Rendering uncached for
 * the short window before the import resolves costs one `marked.parse` per
 * message per render; caching the wrong string costs correctness for the life
 * of the page.
 *
 * `isMarkdownSanitizerReady()` is backed by a ref, so calling this from a
 * component render also registers the dependency that re-renders those messages
 * once the sanitizer arrives.
 *
 * The two dependencies are injectable so the pre-import path can be tested
 * without racing a real dynamic import; production always uses the defaults.
 */
export function createMessageRenderCache(
  render: (content: string) => string = renderMessageMarkdown,
  isFinal: () => boolean = isMarkdownSanitizerReady
): (id: string, content: string) => string {
  const cache = new Map<string, string>();

  return (id: string, content: string): string => {
    const final = isFinal();
    if (final) {
      const cached = cache.get(id);
      if (cached !== undefined) return cached;
    }

    const html = render(content);
    if (final) cache.set(id, html);
    return html;
  };
}
