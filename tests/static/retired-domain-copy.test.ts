// @vitest-environment node
/**
 * RETIRED domains must not appear in copy a visitor reads.
 *
 * `theminiexchange.com`: the marketplace was consolidated into this repo at the
 * 2026-07-13 cutover and lives at `/exchange`; the old host now only 301s here via
 * `server/middleware/tme-redirects.ts`. The BRAND "The Mini Exchange" survives
 * as the section label — that is a locked decision in
 * `docs/plans/2026-06-17-theminiexchange-consolidation.md` and is deliberately
 * NOT what this test polices. What went stale is the DOMAIN: copy that presents
 * theminiexchange.com as a live, separate site users visit or sign in to.
 *
 * `news.classicminidiy.com`: the Ghost blog, retired 2026-10-06. Its articles
 * live in the forum's News category (`community.classicminidiy.com/c/news/16`),
 * and the newsletter signup is `/newsletter`. The host will only redirect to the
 * forum, so a link to it is a link through a redirect at best.
 *
 * Why this is a test. The stale TME strings were spread across `/login`,
 * `/welcome` and `/profile/edit` in all 10 locales — 30 messages that no unit
 * test rendered and no build check read, so they survived the cutover by seven
 * weeks. i18n values are especially prone to this: `i18n.config.ts` sets
 * `missingWarn: false`, nothing type-checks a message's CONTENT, and a
 * translator adding a new locale copies the English sentence including whatever
 * domain it names.
 *
 * Scope note: this checks user-facing surfaces only — `<i18n>` message values,
 * template text and `<script>` code (comments blanked; nav link arrays live
 * there) under `app/`. Redirect maps, middleware and tests must keep naming the
 * domains, because routing the old hosts here is the whole point of
 * `server/utils/tmeRedirects.ts`.
 */
import { describe, expect, it } from 'vitest';
import { appVueFiles, blankComments, describeViolations, diffAgainstAllowlist, parseVue, rel } from './_scan';

interface RetiredDomain {
  domain: string;
  /**
   * Matched as a case-insensitive pattern rather than `String.includes`, for
   * two reasons. Copy is prose, so `TheMiniExchange.com` at the start of a
   * sentence must count. And a bare `.includes('<hostname>')` is the shape
   * CodeQL's js/incomplete-url-substring-sanitization rule flags: that rule is
   * about origin allowlists, where a substring match is a real bypass
   * (`theminiexchange.com.evil.test`). Nothing here gates a request — this is a
   * text scan over source files, and matching the domain ANYWHERE in a sentence
   * is precisely the intent.
   */
  pattern: RegExp;
  /** Where the content lives now; printed in the failure message. */
  replacement: string;
  /**
   * Known surfaces that still name the retired domain. `file::location`.
   *
   * Shrink-only, like every allowlist in this suite: a NEW entry fails as a
   * regression, and an entry that stops reproducing ALSO fails, so a fix cannot
   * land without deleting its own line.
   */
  known: readonly string[];
}

const RETIRED_DOMAINS: readonly RetiredDomain[] = [
  {
    domain: 'theminiexchange.com',
    pattern: /theminiexchange\.com/i,
    replacement:
      'The brand "The Mini Exchange" is fine; the DOMAIN is not — the marketplace lives at /exchange on this site now',
    // The one seeded entry is the marketplace terms page, which uses
    // `hello@theminiexchange.com` as its contact address in four places. That
    // mailbox still forwards (the domain's ForwardEmail MX is live), so those
    // links work — but they point at a domain that otherwise only redirects,
    // and the address should move to `classicminidiy.com` when the TME infra
    // is torn down.
    known: ['app/pages/legal/marketplace-terms.vue::template'],
  },
  {
    domain: 'news.classicminidiy.com',
    pattern: /news\.classicminidiy\.com/i,
    replacement:
      'The Ghost blog is retired — link the forum News category (community.classicminidiy.com/c/news/16), or /newsletter for the signup',
    known: [],
  },
];

/** Walk an <i18n> message tree, yielding `locale.dotted.key` -> value. */
function flattenMessages(node: unknown, path: string, out: Map<string, string>) {
  if (typeof node === 'string') {
    out.set(path, node);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flattenMessages(value, path ? `${path}.${key}` : key, out);
    }
  }
}

for (const retired of RETIRED_DOMAINS) {
  describe(`retired ${retired.domain} domain`, () => {
    it('never appears in user-facing copy', () => {
      const violations: string[] = [];

      for (const file of appVueFiles()) {
        const sfc = parseVue(file);
        const name = rel(file);

        for (const block of sfc.i18n) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(block.content);
          } catch {
            // Invalid JSON is i18n-locale-completeness.test.ts's failure to
            // report, not ours. Skip rather than double-fail on one defect.
            continue;
          }
          const messages = new Map<string, string>();
          flattenMessages(parsed, '', messages);
          for (const [key, value] of messages) {
            if (retired.pattern.test(value)) violations.push(`${name}::i18n::${key}`);
          }
        }

        // Comments are blanked first: this file's own explanatory notes name the
        // domain, and prose must not count as copy. Same rule as the Worker env
        // registry and the component-resolution check.
        if (sfc.template && retired.pattern.test(blankComments(sfc.template.content, 'template'))) {
          violations.push(`${name}::template`);
        }

        // `scriptText` already has its comments blanked. Link arrays (the nav,
        // the footer) are script, and they are the most likely place for a
        // retired host to linger.
        if (retired.pattern.test(sfc.scriptText)) violations.push(`${name}::script`);
      }

      const { unexpected, stale } = diffAgainstAllowlist(violations, retired.known);

      expect(
        unexpected,
        describeViolations(`user-facing strings name the retired ${retired.domain}. ${retired.replacement}`, unexpected)
      ).toEqual([]);

      expect(
        stale,
        describeViolations(
          `allowlist entries no longer name the retired ${retired.domain} — delete them from RETIRED_DOMAINS`,
          stale
        )
      ).toEqual([]);
    });
  });
}
