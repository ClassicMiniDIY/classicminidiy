// @vitest-environment node
/**
 * Context-budget contract for the instruction files Claude Code loads.
 *
 * `CLAUDE.md` is read verbatim into EVERY session, so every byte in it is paid
 * on every turn of every task, whether or not the task touches that area. By
 * 2026-09-02 it had grown to 121 KB (~30k tokens), five times its April size,
 * because each incident's full narrative was being appended next to its rule.
 * The split is: universal rules stay in `CLAUDE.md`; area rules live in
 * `.claude/rules/*.md` with a `paths:` frontmatter so they load only when the
 * matching files are touched; the narratives are archived in `docs/invariants/`.
 *
 * This test keeps that split honest. It caps the always-loaded file, caps each
 * rule file (a rule file is still loaded whole once triggered), requires every
 * rule to be path-scoped (an unscoped rule is just CLAUDE.md by another name),
 * and checks that every glob still matches at least one real file, because a
 * rule whose paths have been renamed away silently stops loading.
 */
import { globSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const RULES_DIR = join(ROOT, '.claude', 'rules');

/** Bytes. ~4 bytes per token, so 32 KB is roughly 8k tokens per session. */
const CLAUDE_MD_MAX_BYTES = 32 * 1024;
/** A single rule file, loaded whole when triggered. */
const RULE_MAX_BYTES = 8 * 1024;

const SKIP = (p: string) =>
  p.includes('node_modules') || p.includes('.nuxt') || p.includes('.output') || p.includes('.claude/worktrees');

function frontmatterPaths(source: string, file: string): string[] {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const block = match[1]!;
  if (!/^paths:\s*$/m.test(block)) throw new Error(`${file}: frontmatter has no \`paths:\` list`);
  return [...block.matchAll(/^\s*-\s+['"]?([^'"\n]+?)['"]?\s*$/gm)].map((m) => m[1]!);
}

describe('instruction-file context budget', () => {
  it(`CLAUDE.md stays under ${CLAUDE_MD_MAX_BYTES / 1024} KB`, () => {
    const size = statSync(join(ROOT, 'CLAUDE.md')).size;
    expect(size, 'move area-specific content into .claude/rules/ and docs/invariants/').toBeLessThanOrEqual(
      CLAUDE_MD_MAX_BYTES
    );
  });

  const ruleFiles = readdirSync(RULES_DIR).filter((f) => f.endsWith('.md'));

  it('has at least one path-scoped rule file', () => {
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  for (const file of ruleFiles) {
    const rel = `.claude/rules/${file}`;
    const source = readFileSync(join(RULES_DIR, file), 'utf8');

    it(`${rel} stays under ${RULE_MAX_BYTES / 1024} KB`, () => {
      expect(Buffer.byteLength(source, 'utf8')).toBeLessThanOrEqual(RULE_MAX_BYTES);
    });

    it(`${rel} is path-scoped and every glob matches a real file`, () => {
      const globs = frontmatterPaths(source, rel);
      expect(globs.length, `${rel}: empty paths list`).toBeGreaterThan(0);
      const dead = globs.filter((g) => globSync(g, { cwd: ROOT, exclude: SKIP }).length === 0);
      expect(dead, `${rel}: these globs match nothing, so the rule never loads for them`).toEqual([]);
    });
  }
});
