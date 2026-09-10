// @vitest-environment node
/**
 * Admin pages must reach admin APIs through the token-attaching wrappers.
 *
 * `server/utils/adminAuth.ts#requireAdminAuth` needs an
 * `Authorization: Bearer <access_token>` header. The Supabase session lives in
 * localStorage, so nothing attaches that header on its own: `useAdminFetch` and
 * `$adminFetch` read the session and set it, and `useAdminFetch` additionally
 * sets `server: false`, because an SSR render is always anonymous and would
 * spend a round trip earning a 401.
 *
 * A bare `useFetch`/`$fetch` at an `/api/admin/**` URL therefore does not fail
 * loudly at build time or in any unit test. It ships, and then every request
 * 401s and the page renders nothing but its own error branch. That is exactly
 * how `/admin/parts/correlations` reached production on 2026-09-10 — the queue
 * held 635 rows and the screen said "The correlation queue could not be
 * loaded."
 *
 * The failure is invisible to the author because the page shell renders fine:
 * the admin layout, the tabs and the signed-in header all come up, and only the
 * data is missing.
 */
import { describe, expect, it } from 'vitest';
import { blankComments, describeViolations, diffAgainstAllowlist, parseVue, rel, walk } from './_scan';

/**
 * Call sites still reaching an admin endpoint without the wrapper.
 * Shrink-only, per CLAUDE.md: an entry here is a promise to come back, never a
 * way to make this check pass.
 */
const KNOWN_UNAUTHENTICATED_ADMIN_FETCHES: readonly string[] = [];

/** `useFetch(` / `$fetch(` that is NOT `useAdminFetch(` / `$adminFetch(`. */
const BARE_USE_FETCH = /(?<![A-Za-z$])useFetch\s*(?:<[^(]*?>)?\s*\(/g;
const BARE_DOLLAR_FETCH = /(?<![A-Za-z$])\$fetch\s*(?:<[^(]*?>)?\s*\(/g;

/** An `/api/admin/...` string literal anywhere in the same call's vicinity. */
const ADMIN_ENDPOINT = /['"`]\/api\/admin\//;

/**
 * The call's full argument list, by balancing parentheses from the opening one.
 *
 * A fixed-width slice is not good enough in either direction. Too short and it
 * misses the `headers` block of a multi-line call; too long and it reads the
 * NEXT call's headers and clears a genuinely unauthenticated one. Quotes are
 * tracked so a paren inside a string literal cannot end the scan early.
 */
function callArgs(script: string, openParenIndex: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openParenIndex; i < script.length; i += 1) {
    const ch = script[i]!;
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return script.slice(openParenIndex, i + 1);
    }
  }
  return script.slice(openParenIndex);
}

/**
 * A call that sets the header itself is correct, just longer than it needs to
 * be — `app/pages/admin/exchange/promotions.vue` reads the session and passes
 * `Authorization` by hand. The contract this file enforces is that the request
 * CARRIES A TOKEN, not that one particular helper was used, so hand-rolling it
 * passes. Prefer the wrapper in new code.
 */
const ATTACHES_TOKEN = /Authorization\s*:/;

const adminPages = walk('app/pages/admin', '.vue');

describe('admin pages authenticate their API calls', () => {
  it('found the admin pages', () => {
    // A refactor that moves or renames the directory must not silently turn
    // this check into a no-op that passes over an empty list.
    expect(adminPages.length).toBeGreaterThan(5);
  });

  it('every /api/admin call from an admin page uses useAdminFetch or $adminFetch', () => {
    const violations: string[] = [];

    for (const abs of adminPages) {
      const script = blankComments(parseVue(abs).scriptText, 'script');

      for (const re of [BARE_USE_FETCH, BARE_DOLLAR_FETCH]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(script)) !== null) {
          const args = callArgs(script, m.index + m[0].length - 1);
          if (ADMIN_ENDPOINT.test(args) && !ATTACHES_TOKEN.test(args)) {
            violations.push(`${rel(abs)} — ${m[0].trim()} at an /api/admin endpoint, no token attached`);
          }
        }
      }
    }

    const { unexpected, stale } = diffAgainstAllowlist(violations, KNOWN_UNAUTHENTICATED_ADMIN_FETCHES);
    expect(unexpected, describeViolations('Admin API calls missing their Bearer token', unexpected)).toEqual([]);
    expect(stale, 'Allowlist entries that no longer match — delete them').toEqual([]);
  });
});
