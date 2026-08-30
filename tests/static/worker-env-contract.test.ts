// @vitest-environment node
/**
 * Raw `process.env.X` reads in server code bypass Nuxt's runtimeConfig scheme
 * entirely, and on Cloudflare Workers that changes how the value must be
 * provisioned.
 *
 * Nitro derives a runtimeConfig key's override name as
 * `NUXT_ + snakeCase(key).toUpperCase()`, so anything read through
 * `useRuntimeConfig()` is fed by a `NUXT_`-prefixed secret. A raw
 * `process.env.MICROLINK_API_KEY` is not — it needs a PLAIN Worker var of
 * exactly that name. Setting only the `NUXT_`-prefixed one leaves the raw
 * reader unkeyed, and because an absent value is an empty string rather than
 * an error, nothing throws. That is precisely how the 2026-08-26 chat outage
 * shipped green.
 *
 * This test is a registry, not a lint: the list below IS the documentation of
 * which plain Worker vars production needs. Adding a raw read means adding it
 * here — and to the CLAUDE.md deployment section — in the same commit.
 */
import { describe, expect, it } from 'vitest';
import { read, rel, walk } from './_scan';

/**
 * Every env name read directly from `process.env` in `server/**`.
 * These require PLAIN Worker vars/secrets — a `NUXT_`-prefixed secret does not
 * reach them.
 */
const PLAIN_WORKER_ENV_NAMES = [
  // Rate-limit tuning knobs. All have safe in-code defaults, so an unset value
  // degrades to the documented default rather than failing.
  'LANGGRAPH_RATELIMIT_MAX',
  'LANGGRAPH_RATELIMIT_WINDOW_MS',
  'WRITE_RATELIMIT_MAX',
  'WRITE_RATELIMIT_WINDOW_MS',
  'MCP_RATELIMIT_WINDOW_MS',
  'MCP_RATELIMIT_MAX',
  'MCP_RATELIMIT_FREE_MAX',
  'MCP_RATELIMIT_DEVELOPER_MAX',
  'MCP_RATELIMIT_INTERNAL_MAX',
  // Analytics ingest host override. Defaults to us.i.posthog.com.
  'POSTHOG_INGEST_HOST',
  // Microlink render fallback. NOTE: `MICROLINK_API_KEY` is ALSO read through
  // runtimeConfig elsewhere, so the one credential has two resolution paths
  // and needs both spellings set, or the raw reader silently runs unkeyed.
  'MICROLINK_API_KEY',
  'MICROLINK_API_URL',
] as const;

/** `server/utils/**` is scanned too — the reads are not all in middleware. */
function collectEnvReads(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const abs of walk('server', '.ts')) {
    const source = read(abs);
    for (const match of source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const name = match[1]!;
      const line = (source.slice(0, match.index).match(/\n/g)?.length ?? 0) + 1;
      const sites = found.get(name) ?? [];
      sites.push(`${rel(abs)}:${line}`);
      found.set(name, sites);
    }
  }
  return found;
}

const envReads = collectEnvReads();

describe('Cloudflare Worker env contract', () => {
  it('found the reads', () => {
    expect(envReads.size).toBeGreaterThan(5);
  });

  it('every raw process.env read is registered as a plain Worker var', () => {
    const registered = new Set<string>(PLAIN_WORKER_ENV_NAMES);
    const unregistered = [...envReads.entries()]
      .filter(([name]) => !registered.has(name))
      // NODE_ENV and friends are provided by the runtime itself, not by us.
      .filter(([name]) => !['NODE_ENV', 'NITRO_PRESET', 'VERCEL', 'CI'].includes(name))
      .map(([name, sites]) => `${name} (${sites.join(', ')})`);

    expect(
      unregistered,
      [
        `${unregistered.length} unregistered process.env read(s) in server/.`,
        'A raw read needs a PLAIN Worker var — a NUXT_-prefixed secret will NOT reach it.',
        'Add the name to PLAIN_WORKER_ENV_NAMES and to the CLAUDE.md deployment section:',
        ...unregistered.map((u) => `  - ${u}`),
      ].join('\n')
    ).toEqual([]);
  });

  it('no registered name has become dead', () => {
    const stale = PLAIN_WORKER_ENV_NAMES.filter((name) => !envReads.has(name));
    expect(
      stale,
      `${stale.length} registered env name(s) no longer read anywhere — drop them:\n${stale.map((s) => `  - ${s}`).join('\n')}`
    ).toEqual([]);
  });
});
