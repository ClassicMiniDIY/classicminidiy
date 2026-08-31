#!/usr/bin/env node
/**
 * Ratcheting typecheck.
 *
 * 263 `.vue` files had never been type-verified when this was added, and the
 * first run reported 1,239 errors. A gate that red teaches everyone to ignore
 * gates, and a big-bang cleanup of 400+ errors is not a pull request. So this
 * is a ratchet, the same shrink-only shape the rest of the harness uses
 * (`tests/static/**`): it fails when an area's error count goes UP, and it also
 * fails when a count goes DOWN without the baseline being lowered, so a fix
 * cannot silently leave room for a future regression.
 *
 * Fixing type errors is therefore incremental and always safe: repair some,
 * lower the number here, commit both together.
 *
 * `tests/` is deliberately not counted. Its 560 "cannot find module" errors are
 * an artifact of two resolver universes, not defects: vitest.config.ts maps `~`
 * to the REPO ROOT while Nuxt maps it to `app/`, so a test importing
 * `~/app/utils/x` resolves under vitest and cannot resolve under this tsconfig.
 * The tests do typecheck where it counts — they run. Papering over it with a
 * `~/app/*` path mapping would be worse than the gap: it would let app code
 * write `~/app/foo`, typecheck clean, and fail at runtime.
 */
import { spawnSync } from 'node:child_process';

/**
 * Known error counts per area. LOWER these as errors are fixed; never raise one
 * to make a build pass.
 */
const BASELINE = {
  'app/': 368,
  'server/': 64,
  'scripts/': 0,
  'data/': 1,
};

/** Counted areas only — see the note above about `tests/`. */
const AREAS = Object.keys(BASELINE);

/**
 * Paths whose error count is not a property of this repo's code.
 *
 * `scripts/migrate/` is a self-contained one-off migration package with its OWN
 * `package.json` and `bun.lock`, and its `node_modules` is gitignored and never
 * installed in CI. So it typechecks against a different dependency graph
 * depending on where you run it: 3 errors locally, 9 on a runner, where six
 * imports additionally fail to resolve. A baseline that moves with the machine
 * is not a baseline — it fails honest PRs while passing on the author's laptop,
 * which is how this was caught. Checking it against the ROOT project's module
 * resolution is meaningless in either environment.
 */
const IGNORED_PREFIXES = ['scripts/migrate/'];

const result = spawnSync('bunx', ['nuxi', 'typecheck'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

// vue-tsc emits `path/to/file.vue(12,34): error TS2532: ...`. Anchor to the line
// start so the indented "Type 'X' is not assignable" continuation lines that
// follow an overload error are not counted as separate errors.
const errorLines = output
  .split('\n')
  .filter((line) => /^\S.*\berror TS\d+:/.test(line))
  .filter((line) => !IGNORED_PREFIXES.some((prefix) => line.startsWith(prefix)));

const counts = Object.fromEntries(AREAS.map((area) => [area, 0]));
let uncounted = 0;
for (const line of errorLines) {
  const area = AREAS.find((candidate) => line.startsWith(candidate));
  if (area) counts[area] += 1;
  else uncounted += 1;
}

const regressions = [];
const improvements = [];
for (const area of AREAS) {
  if (counts[area] > BASELINE[area]) regressions.push(`${area} ${BASELINE[area]} -> ${counts[area]}`);
  if (counts[area] < BASELINE[area]) improvements.push(`${area} ${BASELINE[area]} -> ${counts[area]}`);
}

const total = AREAS.reduce((sum, area) => sum + counts[area], 0);
console.log(`typecheck: ${total} error(s) in counted areas (${errorLines.length} checked, ${uncounted} in tests/)`);
for (const area of AREAS) console.log(`  ${area.padEnd(10)} ${counts[area]}  (baseline ${BASELINE[area]})`);

if (regressions.length) {
  console.error('\nNew type errors. Fix them, or explain in review why the baseline must rise:');
  for (const line of regressions) console.error(`  ${line}`);
  process.exitCode = 1;
} else if (improvements.length) {
  console.error('\nType errors were fixed but the baseline was not lowered. Update BASELINE');
  console.error('in scripts/typecheck.mjs so the ground gained cannot be quietly given back:');
  for (const line of improvements) console.error(`  ${line}`);
  process.exitCode = 1;
} else {
  console.log('\nNo change against baseline.');
}
