/**
 * The ONE reader of reference data (needles, starter needles, suggested
 * needles, torque specs, clearances). Every route, MCP tool and util goes
 * through `getReferenceDataset()`; nothing imports a `data/*.json` copy, and
 * none may be re-added (the copies drifted across four places before).
 *
 * The data is published in Supabase schema `reference` (classicminidiy-supabase,
 * private: the publish rules and the SQL live there). This repo reads the
 * current version through the service-role RPC `get_reference_dataset`.
 *
 * Read order, cheapest first:
 *  1. per-isolate memo, trusted for 5 minutes;
 *  2. KV (`cache:` mount) manifest `reference:manifest:<key>`, NO TTL, refreshed
 *     when older than 5 minutes (an entry with a TTL disappears, and then an
 *     outage has nothing stale to serve);
 *  3. the RPC with `p_known_sha256`: an unchanged dataset returns a NULL
 *     payload, so a refresh costs one small row, not 118 KB;
 *  4. KV payload `reference:payload:<key>:<schema>:<version>`, NO TTL: the
 *     triple is immutable;
 *  5. on any failure, stale data: memo, then KV, then the build snapshot
 *     `#reference-snapshot` bundled at deploy.
 *
 * BYTES ARE THE CONTRACT. Payloads are stored and read with setItemRaw /
 * getItemRaw: unstorage's getItem runs destr() and would hand back a parsed
 * object, and any text made from it would be a re-serialisation with a
 * different hash. Every text from KV or the RPC is checked against its sha256.
 *
 * The parsed `value` is shared across callers: never mutate it. A route that
 * reshapes (withUnits) works on a copy.
 */
import snapshot from '#reference-snapshot';
import { REFERENCE_MAX_SCHEMA, type ReferenceKey } from '~~/shared/referenceDataKeys';
import { getServiceClient } from './supabase';

export type { ReferenceKey } from '~~/shared/referenceDataKeys';

const TTL_MS = 5 * 60 * 1000;

export interface ReferenceDataset<T = unknown> {
  key: ReferenceKey;
  version: number;
  schemaVersion: number;
  sha256: string;
  /** The exact published text. */
  text: string;
  /** Parsed once per version; shared, never mutate. */
  value: T;
  /** Where this came from, for logs and the stale-serve decision. */
  source: 'memo' | 'kv' | 'rpc' | 'snapshot';
}

interface Manifest {
  version: number;
  schemaVersion: number;
  sha256: string;
  fetchedAt: number;
}

interface MemoEntry {
  dataset: ReferenceDataset;
  checkedAt: number;
}

const memo = new Map<ReferenceKey, MemoEntry>();
const inflight = new Map<ReferenceKey, Promise<ReferenceDataset>>();
/** Bumped by invalidate: a refresh that started before it must not write the memo. */
const generation = new Map<ReferenceKey, number>();

const manifestKey = (key: ReferenceKey) => `reference:manifest:${key}`;
const payloadKey = (key: ReferenceKey, schemaVersion: number, version: number) =>
  `reference:payload:${key}:${schemaVersion}:${version}`;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeRaw(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  try {
    const bytes = raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : null;
    return bytes ? new TextDecoder('utf-8', { fatal: true }).decode(bytes) : null;
  } catch {
    return null;
  }
}

function build(
  key: ReferenceKey,
  m: Omit<Manifest, 'fetchedAt'>,
  text: string,
  source: ReferenceDataset['source']
): ReferenceDataset {
  // Reuse the memo's parsed value when the bytes are the same: one parsed copy
  // per dataset, never a growing map of every version seen.
  const cached = memo.get(key)?.dataset;
  const value = cached && cached.sha256 === m.sha256 ? cached.value : JSON.parse(text);
  return { key, version: m.version, schemaVersion: m.schemaVersion, sha256: m.sha256, text, value, source };
}

/** KV writes are best effort: one write per second per key, a 429 is expected under load. */
async function kvSet(write: () => Promise<unknown>): Promise<void> {
  try {
    await write();
  } catch {
    // The value in memory still serves this request; the next refresh retries.
  }
}

async function readKvPayload(key: ReferenceKey, m: Omit<Manifest, 'fetchedAt'>): Promise<string | null> {
  try {
    const text = decodeRaw(await useStorage('cache').getItemRaw(payloadKey(key, m.schemaVersion, m.version)));
    return text !== null && (await sha256Hex(text)) === m.sha256 ? text : null;
  } catch {
    return null;
  }
}

async function readKvManifest(key: ReferenceKey): Promise<Manifest | null> {
  try {
    const m = (await useStorage('cache').getItem(manifestKey(key))) as Manifest | null;
    return m && typeof m.sha256 === 'string' && typeof m.version === 'number' ? m : null;
  } catch {
    return null;
  }
}

async function rpc(key: ReferenceKey, knownSha: string | null) {
  const { data, error } = await getServiceClient().rpc('get_reference_dataset', {
    p_dataset: key,
    p_max_schema_version: REFERENCE_MAX_SCHEMA[key],
    ...(knownSha ? { p_known_sha256: knownSha } : {}),
  });
  if (error) throw new Error(`get_reference_dataset(${key}): ${error.message}`);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row)
    throw new Error(`get_reference_dataset(${key}): no published version at schema <= ${REFERENCE_MAX_SCHEMA[key]}`);
  // The generated type says string; the function returns NULL when knownSha matched.
  return row as typeof row & { payload: string | null };
}

async function refresh(key: ReferenceKey, startedAt: number): Promise<ReferenceDataset> {
  const cached = memo.get(key)?.dataset;
  const kvManifest = await readKvManifest(key);

  // A fresh KV manifest: another isolate checked within the TTL.
  if (kvManifest && Date.now() - kvManifest.fetchedAt < TTL_MS) {
    if (cached && cached.sha256 === kvManifest.sha256) return cached;
    const text = await readKvPayload(key, kvManifest);
    if (text !== null) return build(key, kvManifest, text, 'kv');
  }

  const knownSha = cached?.sha256 ?? kvManifest?.sha256 ?? null;
  let row = await rpc(key, knownSha);
  const m = { version: row.version, schemaVersion: row.schema_version, sha256: row.sha256 };
  let text: string | null = null;
  if (row.payload !== null) {
    text = row.payload;
  } else if (cached && cached.sha256 === m.sha256) {
    text = cached.text;
  } else {
    text = await readKvPayload(key, m);
    if (text === null) {
      // "Unchanged" but the payload is not readable here (KV is eventually
      // consistent, or was cleared): ask again for the bytes.
      row = await rpc(key, null);
      text = row.payload;
    }
  }
  if (text === null || (await sha256Hex(text)) !== m.sha256) {
    throw new Error(`get_reference_dataset(${key}): payload does not match sha256 ${m.sha256}`);
  }

  const storage = useStorage('cache');
  // The payload key is immutable: write it only when these bytes came from the
  // RPC. An "unchanged" answer means KV (or the memo) already holds them.
  // Payload before manifest, so a reader that sees the manifest finds the bytes.
  if (row.payload !== null) {
    await kvSet(() => storage.setItemRaw(payloadKey(key, m.schemaVersion, m.version), text));
  }
  // The manifest only needs a write when it moved on or went stale; every
  // isolate rewriting it on every refresh just contends for one key (1 write/s).
  // Skipped if a publish invalidated this key since the refresh began: the
  // bytes read before it must not look freshly checked to other isolates.
  const now = Date.now();
  const invalidated = (generation.get(key) ?? 0) !== startedAt;
  if (!invalidated && (!kvManifest || kvManifest.sha256 !== m.sha256 || now - kvManifest.fetchedAt >= TTL_MS)) {
    await kvSet(() => storage.setItem(manifestKey(key), { ...m, fetchedAt: now } satisfies Manifest));
  }
  return build(key, m, text, row.payload !== null ? 'rpc' : cached?.sha256 === m.sha256 ? 'memo' : 'kv');
}

async function stale(key: ReferenceKey, reason: unknown): Promise<ReferenceDataset> {
  const message = reason instanceof Error ? reason.message : String(reason);
  const cached = memo.get(key)?.dataset;
  if (cached) {
    console.error(`[referenceData] reference_stale ${key}: serving memo v${cached.version} (${message})`);
    return cached;
  }
  const kvManifest = await readKvManifest(key);
  if (kvManifest) {
    const text = await readKvPayload(key, kvManifest);
    if (text !== null) {
      console.error(`[referenceData] reference_stale ${key}: serving KV v${kvManifest.version} (${message})`);
      return build(key, kvManifest, text, 'kv');
    }
  }
  const snap = snapshot[key];
  if (snap) {
    console.error(`[referenceData] reference_stale ${key}: serving build snapshot v${snap.version} (${message})`);
    return build(key, snap, snap.text, 'snapshot');
  }
  throw new Error(`reference data ${key} unavailable: ${message}`);
}

/** The current published dataset (see the file header for the read order). */
export async function getReferenceDataset<T = unknown>(key: ReferenceKey): Promise<ReferenceDataset<T>> {
  const entry = memo.get(key);
  if (entry && Date.now() - entry.checkedAt < TTL_MS) return entry.dataset as ReferenceDataset<T>;
  const running = inflight.get(key);
  if (running) return (await running) as ReferenceDataset<T>;

  const startedAt = generation.get(key) ?? 0;
  const pending = refresh(key, startedAt)
    .catch((err) => stale(key, err))
    .then((dataset) => {
      // An invalidate (a publish) since this started: serve the result to this
      // caller, but do not cache pre-publish data as fresh.
      if ((generation.get(key) ?? 0) === startedAt) memo.set(key, { dataset, checkedAt: Date.now() });
      return dataset;
    })
    .finally(() => {
      if (inflight.get(key) === pending) inflight.delete(key);
    });
  inflight.set(key, pending);
  return (await pending) as ReferenceDataset<T>;
}

/**
 * Expire the given datasets on this isolate and in KV (after a publish from
 * /admin/reference). Expired, not dropped: a Supabase error on the next read
 * still falls back to the last good data.
 */
export async function invalidateReferenceDatasets(keys: readonly ReferenceKey[]): Promise<void> {
  for (const key of keys) {
    generation.set(key, (generation.get(key) ?? 0) + 1);
    const entry = memo.get(key);
    if (entry) memo.set(key, { ...entry, checkedAt: 0 });
    inflight.delete(key);
    const m = await readKvManifest(key);
    if (m) await kvSet(() => useStorage('cache').setItem(manifestKey(key), { ...m, fetchedAt: 0 }));
  }
}

/**
 * Cache headers for a route that serves reference data. A publish reaches the
 * API in at most ~10 minutes: 5 for the loader's TTL, 5 for this max-age
 * (design §7); the pages render per request, so they follow the loader's 5.
 * stale-while-revalidate keeps the edge answering meanwhile.
 * No ETag: every route reshapes the data (withUnits, the needles wrapper), so
 * the dataset hash is not a validator for the response body.
 */
export function setReferenceCacheHeaders(event: Parameters<typeof setResponseHeaders>[0]): void {
  const value = 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400';
  setResponseHeaders(event, { 'Cache-Control': value, 'CDN-Cache-Control': value });
}

/** Test seam: forget every per-isolate cache. */
export function resetReferenceDataCache(): void {
  memo.clear();
  inflight.clear();
  generation.clear();
}
