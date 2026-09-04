// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TRUSTED_SOURCES, TRUSTED_DOMAINS, trustedSourceCatalogue } from '~~/data/trustedSources';

/**
 * The `allowed_domains` allowlist, checked here rather than in production.
 *
 * Anthropic rejects the WHOLE REQUEST when one entry is malformed, not the bad
 * entry — so a stray `https://` or a trailing slash added to `data/trustedSources.ts`
 * does not degrade web search, it 400s every chat message on the site. That is
 * an outage, from a one-line edit to a data file, with nothing in the diff to
 * suggest it. These rules exist so the mistake fails in CI instead.
 *
 * The list is EXPECTED to grow — that is the point of the registry — so nothing
 * here pins its contents. Only its shape.
 */
describe('the trusted source allowlist', () => {
  it('has at least one source and no more than the API accepts', () => {
    expect(TRUSTED_DOMAINS.length).toBeGreaterThan(0);
    // Anthropic's cap on allowed_domains.
    expect(TRUSTED_DOMAINS.length).toBeLessThanOrEqual(64);
  });

  it.each(TRUSTED_SOURCES.map((source) => [source.id, source] as const))(
    '%s is a bare hostname the API will accept',
    (_id, source) => {
      const { domain } = source;

      expect(domain, 'domains must be lowercase').toBe(domain.toLowerCase());
      expect(domain, 'no scheme — the API takes a hostname, not a URL').not.toMatch(/^[a-z]+:\/\//);
      expect(domain, 'no path, query, port or wildcard').not.toMatch(/[/?#:*\s]/);
      // Two labels minimum. A bare TLD, `localhost`, and any single-label name
      // are all rejected by the API.
      expect(domain.split('.').length, `"${domain}" needs at least two labels`).toBeGreaterThanOrEqual(2);
      // An IPv4 literal is rejected too, and would not be caught by the label
      // count above — 1.2.3.4 has four.
      expect(domain, 'IP addresses are not accepted').not.toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(domain).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/);
    }
  );

  it('carries no `www.` prefix, because subdomains are already covered', () => {
    // Adding both `minispares.com` and `www.minispares.com` wastes an allowlist
    // slot and reads as though the two were somehow different.
    for (const domain of TRUSTED_DOMAINS) {
      expect(domain, `"${domain}" is redundant — the API covers subdomains`).not.toMatch(/^www\./);
    }
  });

  it('has no duplicate ids or domains', () => {
    expect(new Set(TRUSTED_SOURCES.map((s) => s.id)).size).toBe(TRUSTED_SOURCES.length);
    expect(new Set(TRUSTED_SOURCES.map((s) => s.domain)).size).toBe(TRUSTED_SOURCES.length);
  });

  it('is sorted, so the tool definition is a stable cache prefix', () => {
    // The tool definitions are the FIRST thing in Anthropic's cache prefix
    // (tools -> system -> messages). An array whose order varied per request
    // would invalidate the prefix on every turn — a 10x price rise with no
    // visible symptom, which is the same trap documented in server/agent/prompt.ts.
    expect(TRUSTED_DOMAINS).toEqual([...TRUSTED_DOMAINS].sort());
  });

  it('never allowlists classicminidiy.com', () => {
    // `site-search` covers our own pages in-process and is authoritative.
    // Routing them through a web search would be slower, lossier, and able to
    // disagree with the site's own search box.
    for (const domain of TRUSTED_DOMAINS) {
      expect(domain).not.toMatch(/classicminidiy\.com$/);
    }
  });

  it('describes every source to the model', () => {
    // A source in the allowlist but absent from the prompt is searchable in
    // principle and never searched in practice, because the model has no reason
    // to reach for it. The catalogue is generated so the two cannot drift —
    // this asserts the generation actually covers the array.
    const catalogue = trustedSourceCatalogue();
    for (const source of TRUSTED_SOURCES) {
      expect(catalogue, `${source.id} is allowlisted but not described`).toContain(source.domain);
      expect(catalogue).toContain(source.name);
      expect(source.covers.length, `${source.id} has no useful description`).toBeGreaterThan(20);
    }
  });
});
