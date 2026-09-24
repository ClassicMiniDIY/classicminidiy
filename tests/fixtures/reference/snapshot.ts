/**
 * Test stand-in for the build-time virtual module `#reference-snapshot`
 * (vitest.config.ts aliases it here). Same shape, built from the committed
 * fixtures, or from `.reference-snapshot/` when REFERENCE_SOURCE=snapshot
 * (the deploy job's live check, plan §5.6).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFERENCE_KEYS } from '../../../shared/referenceDataKeys';

// From the repo root (vitest's cwd), not import.meta.url: under happy-dom that
// is not a file: URL.
const dir = `${resolve(process.cwd(), process.env.REFERENCE_SOURCE === 'snapshot' ? '.reference-snapshot' : 'tests/fixtures/reference')}/`;

const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));

const snapshot = Object.fromEntries(
  REFERENCE_KEYS.map((key) => [key, { ...manifest[key], text: readFileSync(`${dir}${key}.json`, 'utf8') }]),
);

export default snapshot;
