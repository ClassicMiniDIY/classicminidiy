/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
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
});
