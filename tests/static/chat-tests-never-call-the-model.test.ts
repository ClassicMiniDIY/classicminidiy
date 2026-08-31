// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { blankComments, describeViolations, diffAgainstAllowlist, read, rel, walk } from './_scan';

/**
 * No test may reach the real `/api/chat`, because reaching it spends money.
 *
 * `/api/chat` is the one route in this app that bills per request: it calls
 * Anthropic with the private `NUXT_ANTHROPIC_API_KEY`. A Playwright spec that
 * drives the composer and does NOT intercept the request makes a real model
 * call, on a real key, every run.
 *
 * CI is safe by accident rather than by design — `pr-check.yml` and
 * `e2e-nightly.yml` pass no Anthropic key, so an unstubbed test there fails
 * instead of billing. A LOCAL run is the exposure: `bun run dev` loads `.env`,
 * which does have the key, so the same test quietly spends tokens on the
 * developer's account and nothing anywhere says so.
 *
 * The protection is `page.route('**\/api\/chat', ...)`, which intercepts inside
 * the BROWSER, so the request never reaches Nitro and the handler never runs.
 * `chat.spec.ts` states "Every spec stubs `/api/chat`" in its header; this is
 * what makes that sentence true rather than aspirational.
 *
 * Verified the claim rather than assuming it: with a `throw` planted at the top
 * of the handler, the whole E2E suite (96 passed) and unit suite (5230 passed)
 * were unaffected — nothing reaches it — and removing a single stub made that
 * test fail immediately.
 *
 * Deliberately requires a stub in EVERY test of a chat-touching spec, not only
 * the ones that look like they send. Deciding "does this test send a message?"
 * from source needs a heuristic, and a heuristic that guesses wrong here costs
 * real money silently. A test that never sends loses nothing by stubbing.
 */

/** Shrink-only, and currently empty. Never add an entry to make this pass. */
const KNOWN_UNSTUBBED_CHAT_TESTS: readonly string[] = [];

/** A `page.route(...)` whose pattern names the chat route. */
const INSTALLS_CHAT_ROUTE = /page\.route\(\s*['"`][^'"`]*\/api\/chat/;

/** `test('name'` / `test.skip('name'` / `test.only('name'`. */
const TEST_DECL = /\btest(?:\.(?:skip|only|fixme))?\s*\(\s*['"`]([^'"`]+)['"`]/g;

/** `async function stubFoo(` or `const stubFoo = async (`. */
const HELPER_DECL = /(?:async\s+function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\()/g;

/**
 * The body of the declaration starting at `start`, by balancing delimiters.
 *
 * The obvious shortcut — slice from this declaration to the next one — is
 * WRONG, and wrong in the unsafe direction. `const transcript = (page) => …`
 * has no further helper declaration until `quotaBody` inside the quota
 * describe, so its "body" swallowed `stubQuota`'s `page.route` call and
 * `transcript` was classified as a stub installer. Any unstubbed test that
 * merely called `transcript(page)` then counted as stubbed and passed. Verified
 * before this was fixed: such a test slipped through silently.
 */
function declarationBody(source: string, start: number): string {
  const open = source.indexOf('(', start);
  if (open === -1) return '';

  // Balance the parameter list.
  let i = open;
  let depth = 0;
  do {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    i++;
  } while (i < source.length && depth > 0);

  // Then either a `{ … }` block body, or an expression body ending at `;`.
  while (i < source.length && /[\s=>:]/.test(source[i]!)) i++;
  if (source[i] === '{') {
    let braces = 0;
    const bodyStart = i;
    do {
      if (source[i] === '{') braces++;
      else if (source[i] === '}') braces--;
      i++;
    } while (i < source.length && braces > 0);
    return source.slice(bodyStart, i);
  }
  const semi = source.indexOf(';', i);
  return source.slice(i, semi === -1 ? source.length : semi);
}

/**
 * Names of helpers in this file that install a chat-route stub.
 *
 * Derived from the source, never hardcoded: `stubChat` and `stubQuota` are the
 * two today, and a third added tomorrow is recognised without editing this
 * check. A hardcoded list would be a second registry, and it would drift.
 */
function stubInstallerNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(HELPER_DECL)) {
    const name = match[1] ?? match[2];
    if (!name) continue;
    if (INSTALLS_CHAT_ROUTE.test(declarationBody(source, match.index))) names.add(name);
  }
  return names;
}

/** Every `test(...)` block, as `[name, body]`. */
function testBlocks(source: string): Array<[string, string]> {
  const decls = [...source.matchAll(TEST_DECL)];
  return decls.map((match, index) => [match[1]!, source.slice(match.index, decls[index + 1]?.index ?? source.length)]);
}

describe('e2e specs that touch the chat route', () => {
  it('stub /api/chat in every test, so no test can call the model', () => {
    const violations: string[] = [];

    for (const file of walk('tests/e2e', '.ts')) {
      // Comments first — this file's own prose says "Every spec stubs
      // `/api/chat`", and `chat.spec.ts` documents the rule in its header. Both
      // would register as code. Three checks in this repo have already been
      // wrong for exactly this reason; see CLAUDE.md.
      const source = blankComments(read(file), 'script');
      if (!/\/api\/chat|['"`]\/chat['"`]/.test(source)) continue;

      const installers = stubInstallerNames(source);
      // A file-level or describe-level `beforeEach` that stubs covers every
      // test under it, so the per-test check would be a false positive.
      const stubbedInBeforeEach =
        /beforeEach\(/.test(source) &&
        [...installers].some((name) => new RegExp(`beforeEach\\([\\s\\S]{0,400}?\\b${name}\\s*\\(`).test(source));
      if (stubbedInBeforeEach) continue;

      for (const [name, body] of testBlocks(source)) {
        const stubbed =
          INSTALLS_CHAT_ROUTE.test(body) || [...installers].some((n) => new RegExp(`\\b${n}\\s*\\(`).test(body));
        if (!stubbed) violations.push(`${rel(file)} :: ${name}`);
      }
    }

    const { unexpected, stale } = diffAgainstAllowlist(violations, KNOWN_UNSTUBBED_CHAT_TESTS);

    expect(
      unexpected,
      describeViolations(
        'chat tests with no /api/chat stub — each one makes a REAL, billed model call on a local run',
        unexpected
      )
    ).toEqual([]);
    expect(stale, describeViolations('allowlist entries that no longer reproduce', stale)).toEqual([]);
  });
});
