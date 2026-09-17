// @vitest-environment node
/**
 * Every CI probe that fetches a PAGE DOCUMENT from production must send a
 * named User-Agent, never a client library's default.
 *
 * The zone WAF (Cloudflare, not this repo) Managed-Challenges `GET` requests
 * for page documents whose UA is a known script client: curl, wget, python,
 * go, scrapy, axios, node-fetch. The rule deliberately spares `/api/**`, `/mcp`,
 * `/cdn-cgi/**` and any path with a file extension, which is exactly the set
 * of checks that stayed green when it went live on 2026-09-16. Every HTML
 * assertion in `scripts/verify-cf-deploy.sh` answered 403 (a challenge page,
 * which also carries `noindex`, so the "production is indexable" gate failed
 * too) for a day, AFTER the deploy step had already succeeded. The nightly
 * crawler and the crawler-firewall verifier were unaffected because they
 * already set their own UA.
 *
 * Why a test rather than a note. curl's default UA is invisible: nothing in
 * the script names it, so a new assertion written as a plain `curl` call looks
 * identical to the working ones and only fails once it reaches the edge on a
 * deploy. This pins the wrapper so a bare `curl` cannot land, and pins the UA
 * value so it cannot drift into the pattern the rule challenges.
 *
 * The rule itself lives in the Cloudflare dashboard. Context and the reasoning:
 * `docs/invariants/cloudflare-secrets-and-deploy.md`.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, read } from './_scan';

const DEPLOY_SMOKE = 'scripts/verify-cf-deploy.sh';
const CRAWLER_FIREWALL = 'scripts/verify-ai-crawler-firewall.sh';
const ROUTE_CRAWLER = 'scripts/smoke-routes.mjs';

/**
 * The user-agent tokens the zone rule challenges. Kept as a case-insensitive
 * substring list because that is how the rule is written (the dashboard rule
 * description carries the authoritative list); a UA that contains any of them
 * on a page document is challenged, whatever else it says.
 */
const CHALLENGED_UA_TOKENS = ['curl', 'wget', 'python', 'go-http', 'scrapy', 'axios', 'node-fetch'];

/** Strip `#` comment lines so a mention of curl in prose is not an invocation. */
function shellCode(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Every `curl` invocation in shell code with its line number. */
function curlInvocations(source: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  source.split('\n').forEach((text, i) => {
    if (/^\s*#/.test(text)) return;
    // A word boundary on the left: `cf_curl` is the wrapper, not an invocation.
    if (/(^|[\s(|;`])curl\s/.test(text)) out.push({ line: i + 1, text: text.trim() });
  });
  return out;
}

describe('CI probes send a named User-Agent (zone WAF script-client challenge)', () => {
  const smoke = read(join(REPO_ROOT, DEPLOY_SMOKE));

  it(`${DEPLOY_SMOKE} routes every request through the cf_curl wrapper`, () => {
    const invocations = curlInvocations(smoke);
    // The wrapper definition is the ONE place `curl` may appear.
    const stray = invocations.filter(({ text }) => !text.startsWith('cf_curl()'));
    expect(
      stray.map(({ line, text }) => `${DEPLOY_SMOKE}:${line}: ${text}`),
      'bare curl invocation(s); use cf_curl so the request carries SMOKE_UA and is not challenged at the edge'
    ).toEqual([]);
    expect(
      invocations.some(({ text }) => text.startsWith('cf_curl()')),
      'the cf_curl wrapper is missing'
    ).toBe(true);
  });

  it(`${DEPLOY_SMOKE} wrapper passes -A "$SMOKE_UA" on every call`, () => {
    expect(shellCode(smoke)).toMatch(/^cf_curl\(\)\s*\{\s*curl -A "\$SMOKE_UA" "\$@";\s*\}$/m);
  });

  it(`${DEPLOY_SMOKE} default SMOKE_UA is not one the zone rule challenges`, () => {
    const match = shellCode(smoke).match(/^SMOKE_UA="\$\{SMOKE_UA:-([^}]+)\}"$/m);
    expect(match, 'SMOKE_UA must be declared with an overridable default').not.toBeNull();
    const ua = match![1]!.toLowerCase();
    const hits = CHALLENGED_UA_TOKENS.filter((token) => ua.includes(token));
    expect(hits, `default SMOKE_UA "${match![1]}" contains a challenged token`).toEqual([]);
    // A named product token so the UA is attributable in zone analytics.
    expect(ua).toMatch(/^cmdiy-[a-z0-9-]+\/\d/);
  });

  it(`${CRAWLER_FIREWALL} passes an explicit -A on every curl`, () => {
    // Its whole purpose is UA probing, so a default-UA call there would test
    // the challenge rule instead of the crawler rule it exists to verify.
    const missing = curlInvocations(read(join(REPO_ROOT, CRAWLER_FIREWALL))).filter(({ text }) => !/\s-A\s/.test(text));
    expect(missing.map(({ line, text }) => `${CRAWLER_FIREWALL}:${line}: ${text}`)).toEqual([]);
  });

  it(`${ROUTE_CRAWLER} sends its own user-agent on page fetches`, () => {
    // Without the header Node's fetch sends undici's library default, which
    // is the same shape as the clients the rule challenges. The crawler names
    // itself; keep it that way.
    const source = read(join(REPO_ROOT, ROUTE_CRAWLER));
    const match = source.match(/'user-agent':\s*'([^']+)'/);
    expect(match, 'the HTML fetch must set a user-agent header').not.toBeNull();
    const ua = match![1]!.toLowerCase();
    expect(CHALLENGED_UA_TOKENS.filter((token) => ua.includes(token))).toEqual([]);
  });
});
