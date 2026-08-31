#!/usr/bin/env node
/**
 * Prettier check, scoped to the files this branch actually changed.
 *
 * Repo-wide is not an option: `bunx prettier --check .` fails on 225 files
 * today. A gate that is red before you have written anything trains everyone to
 * ignore gates, and the repo rule is explicitly never to run `bun run format`
 * branch-wide, because resolved Prettier versions differ enough between
 * checkouts that it rewrites hundreds of untouched files and buries the real
 * diff. Those two facts together mean the only honest scope is the diff.
 *
 * So this checks the files changed against the merge-base with the base branch.
 * New and edited files must be formatted; the existing 225 are left for a
 * deliberate sweep rather than being dumped on whoever edits next.
 *
 *   node scripts/format-check.mjs [baseRef]     # default origin/main
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|vue|json|jsonc|css|scss|md|yml|yaml)$/;

const baseRef = process.argv[2] ?? 'origin/main';

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

// Compare against the merge-base, not the base tip: a diff against the tip
// reports every file the base moved ahead on as "changed here" too, so an
// unrelated merge to main would drag its formatting failures into this PR.
const mergeBase = git(['merge-base', baseRef, 'HEAD']);
if (!mergeBase) {
  console.error(`format-check: cannot resolve a merge base with ${baseRef}.`);
  console.error('In CI, fetch the base branch first (actions/checkout defaults to a shallow clone).');
  process.exit(2);
}

const changed = (git(['diff', '--name-only', '--diff-filter=ACMR', mergeBase, 'HEAD']) ?? '')
  .split('\n')
  .filter(Boolean)
  // A file deleted after being edited is listed by name but is gone from disk.
  .filter((file) => EXTENSIONS.test(file) && existsSync(file));

if (!changed.length) {
  console.log('format-check: no formattable files changed.');
  process.exit(0);
}

console.log(`format-check: ${changed.length} changed file(s) against ${baseRef}`);
const result = spawnSync('bunx', ['prettier', '--check', ...changed], { encoding: 'utf8' });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
console.log(output.trim());

if (result.status !== 0) {
  console.error('\nFormat only these paths — never `bun run format`, which rewrites the whole repo:');
  console.error(`  bunx prettier --write ${changed.join(' ')}`);
  process.exit(1);
}
