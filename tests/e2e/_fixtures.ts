import { test as base, expect } from '@playwright/test';

/**
 * The `test` every e2e spec must import, instead of `@playwright/test`.
 *
 * `/api/chat` is the one route in this app that spends money: it calls
 * Anthropic with the private `NUXT_ANTHROPIC_API_KEY`. A spec that drives the
 * composer without intercepting the request makes a real, billed model call —
 * and locally that is silent, because `bun run dev` loads `.env`, which has the
 * key. CI happens to be safe only because it passes no key at all.
 *
 * So the default here is DENY. Every page starts with the billed route aborted,
 * and a spec that wants a reply installs its own stub. Playwright matches route
 * handlers in reverse registration order, so a `page.route` registered inside a
 * test body wins over this one, which is registered during fixture setup.
 * Nothing already-stubbed changes behaviour; only the forgotten case does, and
 * it turns from a silent charge into a loud failure in the exact test at fault.
 *
 * This replaces a static check that tried to prove the same property by reading
 * the source. It could not: a review found five distinct shapes that passed it
 * while still billing — a helper declared between two describes being absorbed
 * into the previous test's slice, a non-stubbing `beforeEach` swallowing a
 * later stub call, a `/api/chat/threads` stub prefix-matching the billed route,
 * a spec reaching the page by a template-literal URL or a nav click, and a
 * handler calling `route.continue()`. Each ended the same way: green check,
 * real call. The property is about what happens at RUN time, so it is enforced
 * at run time, where no parsing heuristic can be wrong about it.
 *
 * `**\/api\/chat` is exact: the sibling `/api/chat/threads/**` sync endpoints do
 * not match it and are left alone. They are free — they touch Postgres, not a
 * model.
 */
export const test = base.extend<{ denyRealModelCalls: void }>({
  denyRealModelCalls: [
    async ({ page }, use) => {
      await page.route('**/api/chat', (route) => route.abort('blockedbyclient'));
      await use();
    },
    { auto: true },
  ],
});

export { expect };
