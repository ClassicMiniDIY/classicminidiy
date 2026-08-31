// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeViolations, diffAgainstAllowlist, rel, searchableSource, walk } from './_scan';

/**
 * No server route may answer with `Access-Control-Allow-Origin: '*'`.
 *
 * The chat stream route carried one until 2026-08-31. Every site on the
 * internet could therefore call our LangGraph proxy from a browser and bill
 * the runs to us — the route is unauthenticated by design, so the wildcard was
 * the only thing standing between an anonymous cross-origin caller and metered
 * LLM spend, and it was standing aside.
 *
 * Same-origin is the correct posture for everything this app serves: the web
 * client is the same origin, and the native iOS/Android clients are not
 * browsers, so they never send an Origin and never enforce CORS. Emitting no
 * CORS header at all is what restores the browser's own protection.
 *
 * If a second web origin is ever genuinely needed, the fix is an explicit
 * allowlist plus `Vary: Origin` — never `*`, and never on a route that spends
 * money or reads a session.
 *
 * NOTE the comment-blanking. `searchableSource()` strips comments before
 * matching, which is required rather than tidy: `stream.post.ts` documents this
 * very rule in prose that quotes the header and the wildcard verbatim. Three
 * earlier checks in this repo were wrong because prose counted as code (see
 * "Any check that scans source for a call must blank comments first" in
 * CLAUDE.md).
 */

/** Shrink-only, and currently empty — every violation has been fixed. */
const KNOWN_WILDCARD_CORS: readonly string[] = [];

/**
 * `Access-Control-Allow-Origin` followed by a `*` inside the same expression.
 * The window covers both spellings in use — `setHeader(event, 'Access-Control-Allow-Origin', '*')`
 * and an object literal `'Access-Control-Allow-Origin': '*'` — without matching
 * a genuine allowlist value on a later line.
 */
const WILDCARD_ORIGIN = /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"`]\*['"`]/g;

describe('no wildcard CORS on server routes', () => {
  it('no handler under server/ sets Access-Control-Allow-Origin to *', () => {
    const violations: string[] = [];

    for (const file of walk('server', '.ts')) {
      const source = searchableSource(file);
      WILDCARD_ORIGIN.lastIndex = 0;
      if (WILDCARD_ORIGIN.test(source)) violations.push(rel(file));
    }

    const { unexpected, stale } = diffAgainstAllowlist(violations, KNOWN_WILDCARD_CORS);

    expect(unexpected, describeViolations('routes newly answering with wildcard CORS', unexpected)).toEqual([]);
    expect(stale, describeViolations('KNOWN_WILDCARD_CORS entries that no longer reproduce', stale)).toEqual([]);
  });
});
