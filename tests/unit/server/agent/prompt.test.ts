// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { MEMBERSHIP_URL } from '~~/shared/utils/chatTiers';

vi.hoisted(() => {
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = (data: any) => data;
  (globalThis as any).errorResult = (message: string) => ({ error: message });
});

const { AGENT_TOOL_NAMES, staticPrompt, dynamicPrompt, buildSystemPrompt } = await import('~~/server/agent/prompt');
const { buildAgentTools } = await import('~~/server/agent/tools');

describe('the system prompt', () => {
  const prompt = staticPrompt();

  it('names every tool the agent is given', () => {
    // This is the whole reason the prompt was rewritten. The prompt it replaced
    // ran for fifteen months without naming a single tool, and the agent reached
    // for them in 11 of 473 conversations.
    for (const name of AGENT_TOOL_NAMES) {
      expect(prompt, `the prompt never mentions the ${name} tool`).toContain(name);
    }
  });

  it('forbids answering a specification from memory', () => {
    expect(prompt.toLowerCase()).toContain('never state a specification from memory');
  });

  it('keeps the safety guidance', () => {
    expect(prompt).toMatch(/brakes|steering|suspension/i);
    expect(prompt).toMatch(/qualified mechanic|professional/i);
  });

  it('points at the first-party membership, not Patreon', () => {
    // Cole's call: the Sustaining Member subscription is the first-party
    // product and already CONTAINS what the old prompt sold Patreon for — the
    // members-only Discord. Patreon still exists as a fallback, but the
    // assistant must not volunteer it over the membership.
    expect(prompt).toContain(MEMBERSHIP_URL);
    expect(prompt.toLowerCase()).toContain('discord');
    // Bans a Patreon LINK, not the word. Patreon is live on the site
    // (`PatreonCard.vue`, the homepage, `/maps`), so a blanket ban on the
    // string would also forbid ever telling an existing supporter something
    // true — and this file would be the thing standing in the way.
    expect(prompt.toLowerCase(), 'the assistant must not volunteer Patreon over the membership').not.toMatch(
      /patreon\.com/
    );
  });

  it('does not hardcode the membership URL', () => {
    // Same constant the quota panel renders, so the two cannot drift.
    expect(MEMBERSHIP_URL).toMatch(/^https:\/\//);
    // Any absolute or bare classicminidiy URL, however it is spelled — the
    // narrow `https://...membership` form missed a scheme-less link and a
    // renamed path, which is exactly how a second URL drifts in unnoticed.
    const hardcoded = (staticPrompt().match(/(?:https?:\/\/)?(?:www\.)?classicminidiy\.com\/[^\s)\]]*/gi) ?? []).filter(
      (url) => url !== MEMBERSHIP_URL
    );
    expect(hardcoded, 'a membership URL that is not MEMBERSHIP_URL').toEqual([]);
  });

  it('keeps the upsell off answered and safety-critical questions', () => {
    // The three limits are the whole point of the section: an unconditional
    // pitch is how the old prompt read as a shop bot, and a pitch attached to
    // a brake question sends someone to a chat room instead of a mechanic.
    const heading = '## When the archive falls short';
    // `slice(-1)` on a missing heading would leave one character and make all
    // three assertions below fail confusingly rather than naming the cause.
    expect(prompt, 'the membership section heading was renamed').toContain(heading);
    const section = prompt.slice(prompt.indexOf(heading));
    const lower = section.toLowerCase();
    // No pitch when anything was answered — including the partial case, which
    // an earlier wording left genuinely ambiguous.
    expect(lower).toMatch(/only when you answered nothing/);
    expect(lower).toMatch(/any part of your reply answers any part/);

    // The safety list must match the Safety section's, which includes major
    // engine work. An earlier version omitted it, so a knocking big-end — a
    // mechanic-grade fault the tools cannot diagnose — fell outside the ban.
    for (const topic of ['brakes', 'steering', 'suspension', 'structural', 'engine']) {
      expect(lower, `the no-pitch limit does not cover ${topic}`).toContain(topic);
    }

    // And the limit must govern the MENTION only. Worded as a topic rule it
    // read as "brakes -> mechanic and nothing else", which would suppress an
    // answerable brake torque lookup — breaking the assistant's core job in
    // the name of safety.
    expect(lower).toMatch(/governs the mention only/);
    expect(lower).toMatch(/never stops you answering/);

    expect(lower).toMatch(/never a salesperson/);
  });

  it('does not resurrect the shop-bot framing', () => {
    // The replaced prompt was a store assistant: product lookups, UTM tags for
    // the shop, upsell/cross-sell, and an "ALWAYS save new knowledge" rule that
    // wrote to a shared store across 170+ threads for a site with no catalogue.
    for (const banned of ['utm_source', 'upsell', 'cross_sell', 'save_product_info', 'save_website_faq']) {
      expect(prompt, `the prompt reintroduces "${banned}" from the old shop-bot prompt`).not.toContain(banned);
    }
  });

  it('says which Mini it is about', () => {
    expect(prompt).toMatch(/1959|classic mini/i);
    expect(prompt).toMatch(/not the modern BMW MINI/i);
  });

  it('describes exactly the tools the agent is actually given', () => {
    // AGENT_TOOL_NAMES is partly hand-written — `site-search` and
    // `store-search` live in server/agent/tools.ts, not under server/mcp/tools/,
    // so `tests/static/agent-tool-registry.test.ts` cannot see them. Without
    // this pin the prompt could describe a tool the model does not have, or stay
    // silent about one it does, and neither fails anywhere else.
    expect(AGENT_TOOL_NAMES).toEqual(Object.keys(buildAgentTools()).sort());
  });

  it('scopes store-search by INTENT, not by topic', () => {
    // The single behaviour this change is judged on. Scoping by topic ("wheels"
    // -> search the store) is what turns every technical answer into an advert,
    // and is what the shop-bot prompt this one replaced actually did.
    const line = prompt.split('\n').find((l) => l.startsWith('- `store-search`'));
    expect(line, 'store-search has no catalogue entry').toBeTruthy();
    expect(line!.toLowerCase()).toMatch(/buy|purchas/);
    expect(line!.toLowerCase()).toContain('not asking a specification');

    // Not keyed to any product category — a topic list here is the regression.
    for (const topic of ['wheel', 'needle', 'gasket', 'oil', 'tyre']) {
      expect(line!.toLowerCase(), `store-search guidance is scoped by topic ("${topic}")`).not.toContain(topic);
    }
  });

  it('states the restraint on store-search as a rule, not only a catalogue line', () => {
    // One line among thirteen in the catalogue is thin protection for the thing
    // most likely to go wrong, so the rules block says it again and plainly.
    expect(prompt).toMatch(/`store-search` only when someone is asking to buy/i);
    expect(prompt.toLowerCase()).toContain('never volunteer the shop in an answer nobody asked for');
  });

  it('still never mentions a UTM parameter, now that there are store links', () => {
    // Covered by the shop-bot test above too, and deliberately restated here:
    // adding a store tool is exactly the moment someone would be tempted to
    // "helpfully" tell the model how to tag a link. The tagging is in code —
    // see storeProductUrl() in server/utils/shopifyCatalog.ts.
    expect(prompt).not.toContain('utm_');
  });
});

describe('the static/dynamic split', () => {
  it('adds nothing per-request for a default English visitor', () => {
    // Anything here would be pure overhead on the common path.
    expect(dynamicPrompt()).toBe('');
    expect(dynamicPrompt({ locale: 'en' })).toBe('');
    expect(buildSystemPrompt()).toBe(staticPrompt());
  });

  it('instructs a non-English reply without translating the data', () => {
    const dynamic = dynamicPrompt({ locale: 'de' });
    expect(dynamic).toContain('"de"');
    expect(dynamic).toMatch(/never translate|never the data itself/i);
  });

  it('tells the prompt when the reader already pays for the membership', () => {
    // The pointer lives in the STATIC half, which is identical for everyone, so
    // without this a paying member asking an unanswerable question is sold the
    // subscription they already hold. The tier was already resolved per request
    // by chat-auth; it just was not reaching the prompt.
    const dynamic = dynamicPrompt({ isMember: true });
    expect(dynamic).toMatch(/already a Sustaining Member/i);
    expect(dynamic).toMatch(/never mention the subscription/i);

    // And nothing extra for everyone else, so the common case stays cache-clean.
    expect(dynamicPrompt({ isMember: false })).toBe('');
    expect(dynamicPrompt()).toBe('');
  });

  it('keeps the member note in the dynamic half, never the cache prefix', () => {
    // Static is the Anthropic cache prefix. A per-reader line placed there
    // would give every member a different prefix and silently cost the cache.
    expect(staticPrompt()).not.toMatch(/already a Sustaining Member/i);
    expect(buildSystemPrompt({ isMember: true })).toContain(staticPrompt());
  });

  it('passes page context through when the client sends it', () => {
    expect(dynamicPrompt({ pageSlug: '/technical/torque' })).toContain('/technical/torque');
  });

  it('puts the invariant half FIRST so it can become a cache prefix', () => {
    // Anthropic's cache matches on a prefix. Any per-request text placed before
    // the static block means the cache never hits, at 10x the token price, with
    // no visible symptom.
    const combined = buildSystemPrompt({ locale: 'fr', pageSlug: '/archive' });
    expect(combined.startsWith(staticPrompt())).toBe(true);
  });
});
