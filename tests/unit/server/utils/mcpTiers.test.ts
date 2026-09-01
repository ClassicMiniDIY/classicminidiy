/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FREE_TOOLS,
  MCP_KEY_PREFIX,
  MCP_KEY_RANDOM_LENGTH,
  PAID_ONLY_TOOLS,
  keyCacheId,
  mintApiKey,
  sha256Hex,
} from '~/server/utils/mcpTiers';

describe('server/utils/mcpTiers', () => {
  it('mints keys as cmdiy_ + 40 base62 chars', () => {
    for (let i = 0; i < 25; i++) {
      const key = mintApiKey();
      expect(key.startsWith(MCP_KEY_PREFIX)).toBe(true);
      expect(key).toHaveLength(MCP_KEY_PREFIX.length + MCP_KEY_RANDOM_LENGTH);
      expect(key.slice(MCP_KEY_PREFIX.length)).toMatch(/^[A-Za-z0-9]{40}$/);
    }
  });

  it('mints unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => mintApiKey()));
    expect(keys.size).toBe(100);
  });

  it('sha256Hex matches a known vector', async () => {
    // SHA-256("abc") — FIPS 180-2 appendix B.1.
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('cache ids key on the hash, never the plaintext', () => {
    expect(keyCacheId('deadbeef')).toBe('mcp-key:deadbeef');
  });

  // Drift guard: FREE_TOOLS names are tool FILENAMES. A renamed or removed tool
  // must fail here, not silently stop matching in the tiering plugin (where a
  // stale name would silently gate a tool that should be free).
  it('every FREE_TOOLS entry is a real tool file, and the paid set is exactly the four identification/archive tools', () => {
    const toolFiles = readdirSync(join(process.cwd(), 'server/mcp/tools'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.replace(/\.ts$/, ''));

    for (const name of FREE_TOOLS) {
      expect(toolFiles).toContain(name);
    }

    const paid = toolFiles.filter((name) => !FREE_TOOLS.has(name)).sort();
    expect(paid).toEqual(['chassis-decoder', 'color-lookup', 'engine-decoder', 'wheel-search']);

    // PAID_ONLY_TOOLS drives the /developers pricing table — it must be exactly
    // the complement of FREE_TOOLS over the real tool files.
    expect([...PAID_ONLY_TOOLS].sort()).toEqual(paid);
    expect(FREE_TOOLS.size + PAID_ONLY_TOOLS.length).toBe(toolFiles.length);
  });

  // The pre-deploy transport gate asserts that the internal tier lists each
  // paid tool — but its list is hardcoded in bash. Without this guard, adding
  // a fifth paid-only tool updates PAID_ONLY_TOOLS (the test above forces it)
  // while the deploy gate silently keeps checking only the original four —
  // exactly the unit-green/transport-blind gap that shipped #721.
  it('the transport script checks every paid-only tool', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/test-mcp-transport.sh'), 'utf8');
    for (const tool of PAID_ONLY_TOOLS) {
      expect(script, `scripts/test-mcp-transport.sh must assert the internal tier lists "${tool}"`).toContain(tool);
    }
  });

  // The gate's VALUE is its diagnosis, not its pass/fail. All-gated and
  // none-gated mean opposite things — an over-applying gate versus a fixture
  // key whose account gained a subscription — and a zero-tool list means
  // neither. Collapsing them back into one generic message costs nothing that
  // any other test can see, so pin the distinctions here, the same way the
  // paid-tool list above is pinned.
  it('the transport script keeps its three distinct free-tier diagnoses', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/test-mcp-transport.sh'), 'utf8');
    const required: [string, string][] = [
      [
        "does MCP_FREE_TIER_KEY's account hold a 'developer' subscription",
        'none-gated must blame the fixture account first',
      ],
      ['the gate is inverted', 'all-gated must point at the gate, not the account'],
      ['the toolkit registered none', 'an empty tool list must not be reported as a tier fault'],
    ];
    for (const [needle, why] of required) {
      expect(script, `scripts/test-mcp-transport.sh lost a diagnosis: ${why}`).toContain(needle);
    }
  });
});
