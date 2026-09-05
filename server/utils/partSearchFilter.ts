/**
 * Building a safe PostgREST `or()` filter for part search.
 *
 * Shared by the public search route and the parts-lookup MCP tool, which had
 * the same two bugs independently — the sort of drift that happens when the
 * same three lines are written twice.
 *
 * WHY AN ALLOWLIST AND NOT AN ESCAPE LIST. PostgREST's `or()` is parsed as
 * text: commas separate conditions, parentheses group them, and dots separate
 * column from operator from value. A value carrying any of those changes the
 * filter's SHAPE rather than failing, and one that leaves the parse
 * unbalanced 500s the request. Escaping the characters you thought of leaves
 * the ones you did not; keeping only characters known to be safe does not.
 *
 * Separately, the value lands inside an `ilike` pattern, where `%` and `_` are
 * SQL wildcards. Left alone, a search for `%` matched all 10,073 parts.
 */

/** Canonical part-number form, matching the CHECK on parts.part_number_norm. */
export function normalisePartNumber(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-.]/g, '');
}

/**
 * The normalised number, reduced to the characters a part number can contain.
 * Anything else is dropped rather than escaped — a part number is `[A-Z0-9]+`
 * by construction, so nothing legitimate is lost.
 */
export function safePartNumberPattern(raw: string): string {
  return normalisePartNumber(raw).replace(/[^A-Z0-9]/g, '');
}

/**
 * Free text for a description match: keep letters, digits, spaces and the few
 * punctuation marks that appear inside real descriptions, then neutralise the
 * LIKE wildcards so they match themselves.
 */
export function safeDescriptionPattern(raw: string): string {
  // Letters, digits, spaces, slash and hyphen. Nothing else.
  //
  // The first cut of this also allowed ' " # + &, on the reasoning that they
  // appear in real descriptions — and `'; drop table parts;--` still returned
  // a 500, because a value carrying a quote can still leave PostgREST's parse
  // unbalanced. That was the allowlist principle stated in the header and then
  // not followed. Dropping them costs nothing: `ilike` is a contains match, so
  // searching `1/4" washer` still finds `WASHER-PLAIN - 1/4"` via `1/4`.
  return raw
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The `or()` expression matching either half, or null when the input reduces to
 * nothing usable — in which case the caller should return no results rather
 * than an unfiltered query.
 */
export function buildPartSearchFilter(raw: string): string | null {
  const number = safePartNumberPattern(raw);
  const words = safeDescriptionPattern(raw);

  const clauses: string[] = [];
  if (number.length >= 2) clauses.push(`part_number_norm.ilike.*${number}*`);
  if (words.length >= 2) clauses.push(`description.ilike.*${words}*`);

  return clauses.length > 0 ? clauses.join(',') : null;
}
