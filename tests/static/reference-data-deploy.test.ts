// @vitest-environment node
/**
 * The deploy must bundle the PUBLISHED reference data, never the fixtures.
 *
 * server/utils/referenceData.ts falls back, last of all, to `#reference-snapshot`,
 * which the build generates from `.reference-snapshot/` (pulled from Supabase by
 * scripts/pull-reference-data.mjs). Outside the deploy the generator uses the
 * committed test fixtures with only a warning, on purpose: the PR smoke job's
 * dev server runs with CI=true and must start. So the ONLY thing that stops a
 * production Worker shipping stale fixture data as its outage fallback is this
 * workflow: the pull step, then the live check, then a build step that sets
 * REFERENCE_SNAPSHOT_REQUIRED. A workflow edit that drops or reorders one of
 * them would pass every other check, which is why it is pinned here.
 */
import { describe, expect, it } from 'vitest';
import { read, REPO_ROOT } from './_scan';

const workflow = read(`${REPO_ROOT}.github/workflows/deploy-cloudflare.yml`);
const indexOf = (needle: string) => workflow.indexOf(needle);

describe('deploy-cloudflare.yml reference-data steps', () => {
  it('pulls the reference data, runs the live check, then builds, in that order', () => {
    const pull = indexOf('run: bun scripts/pull-reference-data.mjs');
    const live = indexOf('run: bun run test:reference-live');
    const build = indexOf('- name: Build for Cloudflare Workers');
    expect(pull, 'the pull step is missing').toBeGreaterThan(-1);
    expect(live, 'the live check is missing').toBeGreaterThan(pull);
    expect(build, 'the build must come after the live check').toBeGreaterThan(live);
  });

  it('the build step requires the pulled snapshot', () => {
    const build = indexOf('- name: Build for Cloudflare Workers');
    const run = workflow.indexOf('run: bun run build', build);
    const step = workflow.slice(build, run);
    expect(step).toMatch(/REFERENCE_SNAPSHOT_REQUIRED:\s*'true'/);
  });
});
