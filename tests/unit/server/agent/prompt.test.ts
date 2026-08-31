// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).defineMcpTool = (config: any) => config;
  (globalThis as any).jsonResult = (data: any) => data;
  (globalThis as any).errorResult = (message: string) => ({ error: message });
});

const { AGENT_TOOL_NAMES, staticPrompt, dynamicPrompt, buildSystemPrompt } = await import('~~/server/agent/prompt');

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
