/**
 * Strip markup from legacy text so it can render as plain prose.
 *
 * Used on content migrated out of DynamoDB, which carries HTML comments and
 * stray tags from its previous life. These values render through `{{ }}`, which
 * Vue escapes — so this is a READABILITY pass, not a security boundary. Nothing
 * here should be trusted as sanitization; if a surface ever needs to render
 * markup, use DOMPurify.
 *
 * Two things the previous per-file versions got wrong, both visible to readers:
 *
 *   - `/<!--.*?-->/` without the `s` flag does not match across newlines, so a
 *     multi-line comment survived whole and displayed as literal text:
 *     "Nice car <!-- migrated from dynamo --> for sale".
 *   - A single pass leaves fragments when constructs nest —
 *     "a <!--<!-- x -->--> b" displayed as "a --> b".
 *
 * (CodeQL js/bad-tag-filter, js/incomplete-multi-character-sanitization —
 * issue #780.)
 */

/** Bounded so a pathological string cannot spin; real content converges in one pass. */
function stripUntilStable(input: string, patterns: RegExp[]): string {
  let current = input;
  for (let pass = 0; pass < 5; pass++) {
    let next = current;
    for (const pattern of patterns) next = next.replace(pattern, '');
    if (next === current) return next;
    current = next;
  }
  return current;
}

const MARKUP_PATTERNS = [
  /<!--[\s\S]*?-->/g, // HTML comments, including multi-line
  /<[^>]*>/g, // tags
];

/** Remove comments and tags, leaving whitespace as-is. */
export function stripMarkup(raw: string | null | undefined): string {
  if (!raw) return '';
  return stripUntilStable(raw, MARKUP_PATTERNS).trim();
}

/** `stripMarkup` plus markdown headings and collapsed whitespace, for a
 * one-line description or summary. */
export function toPlainSummary(raw: string | null | undefined): string {
  if (!raw) return '';
  return stripUntilStable(raw, MARKUP_PATTERNS)
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
