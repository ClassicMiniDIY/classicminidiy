/**
 * Sites the assistant is allowed to read, and what each one is good for.
 *
 * THIS FILE IS THE WHOLE MECHANISM. It feeds two consumers and nothing else:
 *
 *   * `TRUSTED_DOMAINS` becomes the `allowedDomains` argument of the Anthropic
 *     `web_search` server tool in `server/agent/tools.ts`. Anthropic runs the
 *     search against that allowlist; there is no crawler here, no index, and no
 *     second API key.
 *   * `trustedSourceCatalogue()` becomes a paragraph in the system prompt, so
 *     the model knows minispares is where part numbers live and Russell
 *     Engineering is where technical writing lives.
 *
 * Adding a source is therefore ONE object in the array below. That was the
 * requirement: the list will grow, and growing it must not mean touching the
 * prompt, the tool wiring or the tests.
 *
 * WHY AN ALLOWLIST AT ALL. The assistant refused five of five test questions
 * because it had no route off classicminidiy.com — see
 * `docs/plans/2026-09-04-chat-agent-knowledge-expansion.md`. Unrestricted web
 * search would fix that and reintroduce the failure the chat rebuild exists to
 * undo: the agent it replaced reached for generic web search in 331 of 473
 * conversations and for the site's own eleven reference tools in 11. An
 * allowlist of specialists keeps the archive tools first and makes the fallback
 * a Mini source rather than whatever ranks.
 *
 * SHAPE RULES, enforced by `tests/static/trusted-sources.test.ts` because the
 * API rejects the whole request rather than the bad entry:
 *
 *   * 1-64 entries.
 *   * Bare hostname only. No scheme, no path, no port, no query, no wildcard.
 *   * At least two labels — a bare TLD or a single-label name is rejected, as
 *     are IP addresses and `localhost`-style names.
 *   * Subdomains are covered automatically, so `minispares.com` already
 *     includes `www.minispares.com`. Never add both.
 *
 * NOT HERE: classicminidiy.com. `site-search` already covers it in-process and
 * is authoritative; routing our own pages through a web search would be slower,
 * lossier and able to disagree with the site's own search box.
 */

export type TrustedSourceKind = 'oem-parts' | 'aftermarket' | 'technical' | 'history' | 'reference';

export interface TrustedSource {
  /** Stable slug. Used in tests and telemetry, never shown to a reader. */
  id: string;
  /** How the site calls itself, for the prompt and for citations. */
  name: string;
  /**
   * Bare hostname, lowercase. Read directly into the API's `allowed_domains`,
   * which covers subdomains — so this is the registrable domain, not `www.`.
   */
  domain: string;
  kind: TrustedSourceKind;
  /**
   * One line, written FOR THE MODEL. It goes into the system prompt verbatim,
   * so it should say what the site is authoritative about — not market it.
   */
  covers: string;
}

export const TRUSTED_SOURCES: TrustedSource[] = [
  {
    id: 'minispares',
    name: 'Mini Spares',
    domain: 'minispares.com',
    kind: 'oem-parts',
    covers: 'OEM and heritage part numbers, applications by model and year, and superseded-part cross references',
  },
  {
    id: 'somerford-mini',
    name: 'Somerford Mini',
    domain: 'somerfordmini.co.uk',
    kind: 'oem-parts',
    covers:
      'OEM parts listed against original factory exploded diagrams — the best source when a part has to be identified by where it sits in an assembly',
  },
  {
    id: 'mini-sport',
    name: 'Mini Sport',
    domain: 'minisport.com',
    kind: 'oem-parts',
    covers: 'OEM and performance parts, body panels, and restoration components',
  },
  {
    id: 'med-engineering',
    name: 'MED Engineering',
    domain: 'med-engineering.co.uk',
    kind: 'aftermarket',
    covers:
      'aftermarket performance parts — heads, cams, throttle bodies and built engines — with specification detail on what each part changes',
  },
  {
    id: 'calver-st',
    name: 'Calver ST',
    domain: 'calverst.com',
    kind: 'aftermarket',
    covers:
      'aftermarket tuning and suspension parts, with long-form notes on setup and what actually works on a road car',
  },
  {
    id: 'russell-engineering',
    name: 'Russell Engineering',
    domain: 'russellengineering.com.au',
    kind: 'technical',
    covers:
      'in-depth technical writing on A-series engines, gearboxes and build practice — reach for it when a question is about HOW something works rather than which part it is',
  },
  // ---------------------------------------------------------------------------
  // History. Added with the `mini-history` corpus so the long tail the corpus
  // does not cover still has somewhere to land. AROnline is the standing
  // reference for BMC/BL marque history; Wikipedia is the general fallback and
  // is deliberately last in kind precedence in the prompt.
  // ---------------------------------------------------------------------------
  {
    id: 'aronline',
    name: 'AROnline',
    domain: 'aronline.co.uk',
    kind: 'history',
    covers:
      'BMC, British Leyland and Rover marque history — model development, production decisions and company context',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    domain: 'en.wikipedia.org',
    kind: 'reference',
    covers: 'general reference for dates, people and events when no specialist source covers them',
  },
];

/**
 * The `allowed_domains` argument, deduplicated and sorted.
 *
 * SORTED because it is part of the tool definition, and the tool definitions
 * are the first thing in Anthropic's cache prefix (`tools` -> `system` ->
 * `messages`). An array whose order varied between requests would silently
 * invalidate the prefix on every turn — a 10x price increase with no symptom,
 * which is the exact trap `server/agent/prompt.ts` documents for the prompt
 * halves.
 */
export const TRUSTED_DOMAINS: string[] = [...new Set(TRUSTED_SOURCES.map((s) => s.domain))].sort();

/** Order the sources are offered to the model in. Specialists before generalists. */
const KIND_ORDER: TrustedSourceKind[] = ['technical', 'oem-parts', 'aftermarket', 'history', 'reference'];

/**
 * The registry as prompt text, one bullet per source.
 *
 * Generated rather than hand-written so a source added to the array above
 * cannot end up in the allowlist while staying invisible to the model — which
 * would leave it searchable in principle and never searched in practice.
 */
export function trustedSourceCatalogue(): string {
  return [...TRUSTED_SOURCES]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name))
    .map((source) => `- **${source.name}** (${source.domain}) — ${source.covers}`)
    .join('\n');
}
