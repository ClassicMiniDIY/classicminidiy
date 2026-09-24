/**
 * Build-time source of the Nitro virtual module `#reference-snapshot`: every
 * reference dataset as its exact published text, bundled into the Worker as
 * the loader's last fallback (design §7: a cold KV plus a Supabase outage must
 * never be an empty page).
 *
 * Reads `.reference-snapshot/` (written by scripts/pull-reference-data.mjs).
 * In CI a missing snapshot is an error: the deploy job runs the pull first.
 * Locally it falls back to the committed fixtures with a warning.
 *
 * The texts are embedded as JSON string literals, so the runtime string is the
 * exact published text; nothing parses and re-serialises it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_KEYS } from '../shared/referenceDataKeys.ts';

export function buildReferenceSnapshotModule(rootDir) {
  let dir = join(rootDir, '.reference-snapshot');
  if (!existsSync(join(dir, 'manifest.json'))) {
    if (process.env.CI === 'true') {
      throw new Error(
        '[reference-snapshot] .reference-snapshot/ is missing; run scripts/pull-reference-data.mjs before the build'
      );
    }
    console.warn('[reference-snapshot] WARNING: no .reference-snapshot/; bundling the test FIXTURES as the fallback');
    dir = join(rootDir, 'tests/fixtures/reference');
  }
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const entries = {};
  for (const key of REFERENCE_KEYS) {
    const bytes = readFileSync(join(dir, `${key}.json`));
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (!manifest[key] || sha !== manifest[key].sha256) {
      throw new Error(`[reference-snapshot] ${key}: file sha256 ${sha} does not match its manifest`);
    }
    entries[key] = { ...manifest[key], text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  }
  return `export default ${JSON.stringify(entries)};\n`;
}
