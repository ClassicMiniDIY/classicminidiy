// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { basename } from 'node:path';
import { rel, read, walk } from './_scan';

/**
 * The chat agent's tool registry must match `server/mcp/tools/` exactly.
 *
 * `server/utils/agentTools.ts` names its imports one by one, because a static
 * import list is what the Cloudflare bundler needs — `import.meta.glob` is a Vite
 * feature that behaves differently under Nitro. The cost of that is a SECOND
 * registry that can drift from the filesystem, and the drift is silent: add a
 * twelfth reference tool, forget to wire it, and `/mcp` gains it while the
 * assistant never learns it exists. That is the same class of gap this whole
 * workstream was created to close — the old agent had eleven tools attached and
 * reached for them in 2% of conversations.
 *
 * The failure direction that matters is a tool on disk and missing from the
 * bridge. The reverse (a bridged name with no file) cannot compile, so it is
 * asserted only for completeness.
 */
/**
 * Escape EVERY regex metacharacter, not just the one that happens to appear in
 * today's tool names.
 *
 * This was `name.replace(/[-]/g, '\\-')`, which escaped hyphens and left
 * backslashes, dots, plus signs and the rest raw — CodeQL flagged it as
 * incomplete sanitization, correctly. The names come from filenames under
 * `server/mcp/tools/`, so this is not an injection route, but a partial escape
 * is still a real hazard here: a tool file named `a.b.ts` would build a pattern
 * whose `.` matches any character, and this check could then report a tool as
 * documented when the prompt never mentions it — a silent pass in the one test
 * whose entire job is to prevent silent drift.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

describe('agent tool registry', () => {
  const toolFiles = walk('server/mcp/tools', '.ts')
    .map((file) => basename(file).replace(/\.ts$/, ''))
    .sort();

  const bridge = read(walk('server/utils', '.ts').find((file) => rel(file) === 'server/utils/agentTools.ts') as string);

  it('finds the tool files at all', () => {
    // A path typo above would otherwise make every assertion below vacuously
    // pass against an empty list.
    expect(toolFiles.length).toBeGreaterThanOrEqual(11);
  });

  it('bridges every tool in server/mcp/tools', () => {
    const missing = toolFiles.filter((name) => !bridge.includes(`'${name}'`) && !bridge.includes(`${name},`));
    expect(
      missing,
      `these MCP tools exist on disk but are not wired into server/utils/agentTools.ts, ` +
        `so the chat assistant cannot call them: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('imports each tool file exactly once', () => {
    for (const name of toolFiles) {
      const imports = bridge.match(new RegExp(`from '\\.\\./mcp/tools/${name}'`, 'g')) ?? [];
      expect(imports.length, `expected one import of ${name}, found ${imports.length}`).toBe(1);
    }
  });

  it('gives every bridged tool prompt guidance', () => {
    // A tool the model is handed but never told about is the exact failure this
    // rebuild exists to fix, so the prompt's catalogue has to stay in step.
    const prompt = read(walk('server/agent', '.ts').find((file) => rel(file) === 'server/agent/prompt.ts') as string);
    // Keys appear in BOTH forms: prettier's `quoteProps: as-needed` strips the
    // quotes from any key that is a valid identifier, so `clearances` is bare
    // while `'torque-specs'` keeps them. Matching only the quoted form reported
    // a false violation for exactly one tool.
    const documented = (name: string) => new RegExp(`(^|[\\s{,])'?${escapeRegExp(name)}'?\\s*:`, 'm').test(prompt);
    const undocumented = toolFiles.filter((name) => !documented(name));
    expect(
      undocumented,
      `these tools are given to the model but have no entry in TOOL_GUIDANCE, so the prompt ` +
        `never tells it when to use them: ${undocumented.join(', ')}`
    ).toEqual([]);
  });
});
