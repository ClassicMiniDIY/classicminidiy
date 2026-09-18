// @vitest-environment node
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, blankComments, describeViolations, diffAgainstAllowlist, read, rel, walk } from './_scan';

/**
 * No exported name may exist in two files of the same auto-import scope.
 *
 * Nuxt registers every top-level export of `app/utils`, `app/composables` and
 * `shared/utils` as a client auto-import, and every export of `server/utils/**`
 * and `shared/utils` as a Nitro auto-import. When two files in one scope export
 * the same name, unimport keeps one and drops the other, and the build logs a
 * line per name:
 *
 *   Duplicated imports "McpTier", the one from ".../shared/utils/mcpTiers.ts"
 *   has been ignored and ".../server/utils/mcpTiers.ts" is used
 *
 * The usual cause is a `server/utils` file re-exporting its `shared/utils`
 * twin "so server code keeps one import" — which is exactly what
 * `server/utils/mcpTiers.ts` and `server/utils/chatTiers.ts` did, fourteen
 * names between them, three warnings each per build. The re-export is never
 * needed: server code imports the shared file directly.
 *
 * Nothing breaks at build time, which is why it went unnoticed; the warning
 * scrolls past in CI. It is still a latent bug: which copy "wins" is an
 * unimport ordering detail, and a name that is a value in one file and a type
 * in the other resolves to whichever was registered last.
 */

/** Shrink-only, and currently empty. Entry format: `<scope>: <name> in <fileA>, <fileB>`. */
const KNOWN_COLLISIONS: readonly string[] = [];

/**
 * Nuxt scans `shared/utils`, `shared/types`, `app/utils` and `app/composables`
 * one level deep (a nested directory joins only via its `index.ts`); Nitro
 * scans `server/utils` recursively. Mirror that, not a guess at it. Declaration
 * files are not scanned by unimport, so they are not scanned here.
 */
const SHARED = () => [...topLevel('shared/utils'), ...topLevel('shared/types')];
const SCOPES: Record<string, () => string[]> = {
  nitro: () => [...walk('server/utils', '.ts').filter(isSource), ...SHARED()],
  app: () => [...topLevel('app/utils'), ...topLevel('app/composables'), ...SHARED()],
};

const isSource = (file: string) => file.endsWith('.ts') && !file.endsWith('.d.ts');

function topLevel(dir: string): string[] {
  const abs = join(REPO_ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(abs, entry);
    // statSync throws on a dangling symlink; skip it like walk() does rather
    // than failing the suite with a filesystem error.
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      const index = join(full, 'index.ts');
      try {
        if (statSync(index).isFile()) out.push(index);
      } catch {
        /* no index: the directory is not auto-imported */
      }
    } else if (isSource(entry)) {
      out.push(full);
    }
  }
  return out.sort();
}

/** `export const|let|function|async function|class|enum|type|interface NAME` */
const DECLARATION =
  /^export\s+(?:async\s+)?(?:const|let|var|function\*?|class|enum|type|interface)\s+([A-Za-z_$][\w$]*)/gm;
/** `export { a, b as c }` and `export { a } from '…'` — the re-export form is the one that bites. */
const LIST = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

function exportedNames(raw: string): string[] {
  // A doc comment quoting `export const X` at column 0 is prose, not an export
  // (server/utils/exchange/feedBuilder.ts has one).
  const source = blankComments(raw, 'script');
  const names = new Set<string>();
  for (const m of source.matchAll(DECLARATION)) names.add(m[1]!);
  for (const m of source.matchAll(LIST)) {
    for (const item of m[1]!.split(',')) {
      const trimmed = item.trim().replace(/^type\s+/, '');
      if (!trimmed) continue;
      const exported = trimmed.split(/\s+as\s+/).pop()!;
      names.add(exported);
    }
  }
  return [...names];
}

describe('auto-import scopes', () => {
  it('export each name from exactly one file', () => {
    const violations: string[] = [];
    for (const [scope, files] of Object.entries(SCOPES)) {
      const owners = new Map<string, string[]>();
      for (const file of files()) {
        for (const name of exportedNames(read(file))) {
          const list = owners.get(name) ?? [];
          list.push(rel(file));
          owners.set(name, list);
        }
      }
      for (const [name, list] of owners) {
        if (list.length > 1) violations.push(`${scope}: ${name} in ${list.sort().join(', ')}`);
      }
    }

    const { unexpected, stale } = diffAgainstAllowlist(violations.sort(), KNOWN_COLLISIONS);

    expect(
      unexpected,
      describeViolations('names exported by two files in one auto-import scope (unimport drops one)', unexpected)
    ).toEqual([]);
    expect(stale, describeViolations('allowlist entries that no longer reproduce', stale)).toEqual([]);
  });

  it('catches the re-export pattern that produced the original warnings', () => {
    // Guard the regexes, not the repo: a `server/utils` file that re-exports
    // its `shared/utils` twin must register every re-exported name.
    const source = [
      "export { A, B as C } from '../../shared/utils/x';",
      "export type { T } from '../../shared/utils/x';",
      'export const local = 1;',
      'export async function fn() {}',
      '/**',
      ' * Not an export:',
      'export const quoted = 1;',
      ' */',
    ].join('\n');
    expect(exportedNames(source).sort()).toEqual(['A', 'C', 'T', 'fn', 'local']);
  });
});
