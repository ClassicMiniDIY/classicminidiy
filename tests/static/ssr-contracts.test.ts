// @vitest-environment node
/**
 * SSR-time contracts that no unit test can see, because no unit test renders a
 * route.
 *
 * 1. Dynamic routes must 404 on a miss. Until 2026-07 the site-wide catch-all
 *    answered HTTP 200 with `<title>undefined …</title>` for every unknown URL
 *    on the domain — an unbounded soft-404 space that Google indexes and burns
 *    crawl budget on.
 *
 * 2. `useFetch` must never take a getter URL. Under Nuxt 4.5 the getter form
 *    stops blocking async setup, so SSR renders the pending branch and
 *    hydration never settles. On a detail page that also reads `error.value`
 *    to throw its 404, the getter form silently disables the 404 as well —
 *    setup does not wait, so `error.value` is still null when it is read.
 *    Pass a plain string, or a `computed()` ref when the URL must react
 *    (see the comment in app/components/models/ModelComments.vue).
 */
import { describe, expect, it } from 'vitest';
import { blankComments, describeViolations, diffAgainstAllowlist, parseVue, read, rel, walk } from './_scan';

/**
 * Dynamic pages that answer 200 on a miss instead of throwing a 404.
 * All three carry `noindex`, so the SEO blast radius is contained — but the
 * status code is still wrong and a missing record renders a broken page.
 */
const KNOWN_SOFT_404_PAGES: readonly string[] = [
  'app/pages/users/[id].vue',
  'app/pages/admin/threads/[id].vue',
  'app/pages/exchange/messages/[conversationId].vue',
];

/**
 * The one documented exception. An SSR miss on a listing can also be a
 * *pending* listing whose RLS row only the signed-in owner can read, and SSR
 * has no session — so this page sets a 404 status + noindex and still renders,
 * letting the onMounted retry recover it for the owner. See CLAUDE.md.
 */
const DOCUMENTED_404_EXCEPTIONS: readonly string[] = ['app/pages/exchange/listings/[slug]/index.vue'];

/** Remaining getter-form `useFetch` call sites. */
const KNOWN_GETTER_FORM_USEFETCH: readonly string[] = [
  'app/pages/models/[slug].vue',
  'app/pages/models/external/[slug].vue',
  'app/components/NeedleTable.vue',
];

const dynamicPages = walk('app/pages', '.vue').filter((abs) => /\[[^\]]+\]/.test(rel(abs)));

describe('dynamic routes 404 on a miss', () => {
  it('found the dynamic pages', () => {
    expect(dynamicPages.length).toBeGreaterThan(10);
  });

  it('every dynamic page throws a fatal 404 when the record is missing', () => {
    const actual = dynamicPages
      .filter((abs) => !DOCUMENTED_404_EXCEPTIONS.includes(rel(abs)))
      .filter((abs) => {
        const script = blankComments(parseVue(abs).script?.content ?? '', 'script');
        // `createError({ statusCode: 404 … })` in any formatting, or a
        // pass-through of an upstream status alongside a 404 fallback.
        return !/createError\s*\(\s*\{[^}]*statusCode[^}]*\}/s.test(script);
      })
      .map(rel);

    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_SOFT_404_PAGES);
    expect(
      unexpected,
      describeViolations('dynamic pages with no 404 — they will answer 200 for any id', unexpected)
    ).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_SOFT_404_PAGES entries (the 404 landed — drop them)', stale)).toEqual(
      []
    );
  });
});

describe('useFetch blocks SSR', () => {
  it('no useFetch takes a getter URL', () => {
    const files = [...walk('app', '.vue'), ...walk('app', '.ts')];
    // First argument is an arrow function: `useFetch(() => ...)`. The generic
    // parameter is optional and `useLazyFetch` has the same signature.
    const getterForm = /\buse(?:Lazy)?Fetch\s*(?:<[^>]*>)?\s*\(\s*\(\s*\)\s*=>/;
    const actual = files.filter((abs) => getterForm.test(blankComments(read(abs), 'script'))).map(rel);

    const { unexpected, stale } = diffAgainstAllowlist(actual, KNOWN_GETTER_FORM_USEFETCH);
    expect(
      unexpected,
      describeViolations('getter-form useFetch — SSR renders the pending branch and hydration hangs', unexpected)
    ).toEqual([]);
    expect(stale, describeViolations('stale KNOWN_GETTER_FORM_USEFETCH entries', stale)).toEqual([]);
  });
});
