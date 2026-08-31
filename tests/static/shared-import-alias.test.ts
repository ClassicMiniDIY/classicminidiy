// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeViolations, diffAgainstAllowlist, rel, searchableSource, walk } from './_scan';

/**
 * Client code must reach `shared/` through the `~~/` alias, never a relative path.
 *
 * A relative `../../shared/utils/x` resolves happily in dev, in vitest and under
 * `vue-tsc` — and then fails the PRODUCTION build, where Rollup cannot resolve
 * the specifier from a client chunk:
 *
 *   RollupError: Could not resolve "../../../../../shared/utils/chatTiers.ts"
 *   from ".nuxt/dist/server/_nuxt/chat-CM26o58_.js"
 *
 * That is the whole reason this check exists. It shipped once: the unit suite,
 * the typecheck, the format check and every PR gate were green, the PR merged,
 * and the deploy died at the bundling step — so `main` carried code that could
 * not be built and production silently stayed on the previous commit while
 * everything looked fine.
 *
 * Every other app file already uses the alias; this pins the convention rather
 * than relying on people noticing it.
 */

/** Shrink-only, and currently empty. */
const KNOWN_RELATIVE_SHARED_IMPORTS: readonly string[] = [];

/** `from '../…/shared/…'` — any number of leading `../` segments. */
const RELATIVE_SHARED = /from\s+['"](?:\.\.\/)+shared\//;

describe('shared/ imports from client code', () => {
  it('use the ~~/ alias, never a relative path', () => {
    const violations = [...walk('app', '.ts'), ...walk('app', '.vue')]
      .filter((file) => RELATIVE_SHARED.test(searchableSource(file)))
      .map(rel)
      .sort();

    const { unexpected, stale } = diffAgainstAllowlist(violations, KNOWN_RELATIVE_SHARED_IMPORTS);

    expect(
      unexpected,
      describeViolations('app files reaching shared/ by relative path — these break the Cloudflare build', unexpected)
    ).toEqual([]);
    expect(stale, describeViolations('allowlist entries that no longer reproduce', stale)).toEqual([]);
  });
});
