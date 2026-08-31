// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { blankComments, describeViolations, diffAgainstAllowlist, read, rel, walk } from './_scan';

/**
 * Every e2e spec must take `test` from `./_fixtures`, never `@playwright/test`.
 *
 * That fixture aborts `**\/api\/chat` on every page by default, so a spec which
 * drives the composer without installing its own stub fails loudly instead of
 * making a real, billed Anthropic call. Locally that matters: `bun run dev`
 * loads `.env`, which has the key, so the charge is otherwise silent.
 *
 * This check replaced one that tried to prove the same property by PARSING the
 * specs — deriving which helpers install a `page.route`, then asking whether
 * each test called one. That approach cannot work, and the way it failed is the
 * reason this file exists. A review found five shapes that passed it while
 * still billing:
 *
 *   - a helper declared between two describes was absorbed into the previous
 *     test's source slice, so its `page.route` counted as that test's stub;
 *   - a `beforeEach` that stubbed nothing matched a later test's stub call
 *     inside the search window, exempting the whole file;
 *   - a `page.route('**\/api\/chat\/threads')` stub prefix-matched the billed
 *     route, so stubbing the free sync endpoint counted;
 *   - a spec reaching the page by `` `/chat?prompt=${x}` `` or a nav click was
 *     never scanned at all;
 *   - a handler calling `route.continue()` forwarded to the real route while
 *     still reading as a stub.
 *
 * Every one ended identically: green check, real call, nothing said so. The
 * property is about what happens at RUN time, so it is now enforced at run
 * time, and what is left for a source check is the one question source can
 * answer without a heuristic: does this file import the fixture?
 *
 * Keeping the two-line rule rather than dropping the check entirely, because
 * the fixture only protects specs that use it, and `import { test } from
 * '@playwright/test'` is exactly what an editor auto-import writes.
 */

/** Shrink-only, and currently empty. Never add an entry to make this pass. */
const KNOWN_UNFIXTURED_SPECS: readonly string[] = [];

/** `test` or `expect` taken straight from Playwright. */
const RAW_PLAYWRIGHT_RUNTIME_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@playwright\/test'/g;

describe('e2e specs', () => {
  it('take test/expect from ./_fixtures, so an unstubbed chat call cannot bill', () => {
    const violations: string[] = [];

    for (const file of walk('tests/e2e', '.ts')) {
      const name = rel(file);
      // The fixture module itself is where `base` legitimately comes from, and
      // `auth.setup.ts` is a setup project rather than a spec: it mints the
      // session and never opens /chat.
      if (!name.endsWith('.spec.ts')) continue;

      // Comments first. This file's siblings quote `@playwright/test` in prose
      // when explaining why the runner is separate, and a doc comment must not
      // register as an import — the repo has been bitten by exactly this three
      // times over (see CLAUDE.md, "Any check that scans source for a call").
      const source = blankComments(read(file), 'script');

      const importsFixture = /from\s*'\.\/_fixtures'/.test(source);
      // A `import type {...}` line is fine: types carry no runtime behaviour.
      // Only a VALUE import of test/expect bypasses the fixture.
      const rawRuntime = [...source.matchAll(RAW_PLAYWRIGHT_RUNTIME_IMPORT)].some(([, names]) =>
        names
          .split(',')
          .map((n) => n.trim())
          .some((n) => /^(test|expect)\b/.test(n) && !n.startsWith('type '))
      );

      if (!importsFixture || rawRuntime) violations.push(name);
    }

    const { unexpected, stale } = diffAgainstAllowlist(violations, KNOWN_UNFIXTURED_SPECS);

    expect(
      unexpected,
      describeViolations(
        'e2e specs not using ./_fixtures — an unstubbed chat send in these makes a REAL, billed model call',
        unexpected
      )
    ).toEqual([]);
    expect(stale, describeViolations('allowlist entries that no longer reproduce', stale)).toEqual([]);
  });
});
