#!/usr/bin/env node
/**
 * Pull the current published reference datasets into `.reference-snapshot/`
 * (default) for the build snapshot, or into `tests/fixtures/reference/` with
 * `--out tests/fixtures/reference` to refresh the test fixtures.
 *
 * Each payload is written as the EXACT published bytes and verified against
 * its sha256 before anything is written; `manifest.json` records version,
 * schema version and sha256 per dataset.
 *
 * Credentials: `NUXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_KEY` from the
 * environment. This script is the one reader of the service key outside
 * `server/utils/supabase.ts#getServiceClient` (a build step has no Nitro
 * runtime); it never ships to the client.
 *
 * In CI (`CI=true`) any failure exits 1 and fails the deploy: a Worker with no
 * snapshot would serve an empty page on a cold KV plus a Supabase outage
 * (design §7). Locally, with no credentials, it copies the committed fixtures
 * and says so loudly, so local work never needs production keys.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_KEYS, REFERENCE_MAX_SCHEMA } from '../shared/referenceDataKeys.ts';

const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : '.reference-snapshot';
const inCI = process.env.CI === 'true';
const url = (process.env.NUXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_KEY || '';
const FIXTURES = 'tests/fixtures/reference';

function fail(message) {
  console.error(`[pull-reference-data] ${message}`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });

if (!url || !key) {
  if (inCI) fail('NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are required in CI');
  if (out === FIXTURES) fail('refreshing the fixtures needs NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  console.warn(
    `[pull-reference-data] WARNING: no Supabase credentials; copying ${FIXTURES} into ${out}. This build serves FIXTURE data.`
  );
  for (const k of REFERENCE_KEYS) copyFileSync(join(FIXTURES, `${k}.json`), join(out, `${k}.json`));
  copyFileSync(join(FIXTURES, 'manifest.json'), join(out, 'manifest.json'));
  process.exit(0);
}

const manifest = {};
const payloads = {};
for (const dataset of REFERENCE_KEYS) {
  let res;
  try {
    res = await fetch(`${url}/rest/v1/rpc/get_reference_dataset`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_dataset: dataset, p_max_schema_version: REFERENCE_MAX_SCHEMA[dataset] }),
    });
  } catch (e) {
    fail(`${dataset}: request failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) fail(`${dataset}: HTTP ${res.status} ${await res.text()}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || typeof row.payload !== 'string')
    fail(`${dataset}: no published version at schema <= ${REFERENCE_MAX_SCHEMA[dataset]}`);
  const sha = createHash('sha256').update(Buffer.from(row.payload, 'utf8')).digest('hex');
  if (sha !== row.sha256) fail(`${dataset}: payload sha256 ${sha} does not match the published ${row.sha256}`);
  payloads[dataset] = row.payload;
  manifest[dataset] = { version: row.version, schemaVersion: row.schema_version, sha256: row.sha256 };
}

// Write only after every dataset verified, so a failure never leaves a mix.
for (const dataset of REFERENCE_KEYS) writeFileSync(join(out, `${dataset}.json`), payloads[dataset], 'utf8');
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const [k, m] of Object.entries(manifest))
  console.log(`[pull-reference-data] ${k} v${m.version} ${m.sha256.slice(0, 12)}`);
