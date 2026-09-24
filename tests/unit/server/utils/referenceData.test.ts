/** @vitest-environment node */
/**
 * The real reference-data loader (tests/setup mocks it for every other file).
 * Plan: classicminidiy-supabase docs/plans/2026-09-24-reference-data-phase-2-bootstrap-and-web.md §5.1.
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('~~/server/utils/referenceData');

const rpc = vi.fn();
vi.mock('~~/server/utils/supabase', () => ({ getServiceClient: () => ({ rpc }) }));

/** In-memory stand-in for the `cache:` mount. getItem parses (like unstorage's destr); getItemRaw does not. */
class FakeStorage {
  raw = new Map<string, unknown>();
  failWrites = false;
  async getItem(key: string) {
    const v = this.raw.get(key);
    return typeof v === 'string' ? JSON.parse(v) : (v ?? null);
  }
  async getItemRaw(key: string) {
    return this.raw.get(key) ?? null;
  }
  async setItem(key: string, value: unknown) {
    if (this.failWrites) throw new Error('KV 429');
    this.raw.set(key, JSON.stringify(value));
  }
  async setItemRaw(key: string, value: unknown) {
    if (this.failWrites) throw new Error('KV 429');
    this.raw.set(key, value);
  }
}

let storage: FakeStorage;
vi.stubGlobal('useStorage', () => storage);
vi.stubGlobal('setResponseHeaders', vi.fn());

const sha = (text: string) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
// Deliberately formatted text: a re-serialisation would lose the spacing.
const TEXT = '[\n  {"name": "AAA", "size": 0.09, "data": [2.2, 2.1]}\n]\n';
const TEXT2 = '[{"name":"AAB","size":0.1,"data":[2]}]';
const row = (text: string | null, version = 1, s = text ? sha(text) : sha(TEXT)) => ({
  data: [{ dataset: 'needles', schema_version: 1, version, sha256: s, bytes: 0, published_at: '', payload: text }],
  error: null,
});

let mod: typeof import('~~/server/utils/referenceData');
beforeEach(async () => {
  vi.useRealTimers();
  storage = new FakeStorage();
  rpc.mockReset();
  vi.resetModules();
  mod = await import('~~/server/utils/referenceData');
  mod.resetReferenceDataCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getReferenceDataset', () => {
  it('reads through the RPC, keeps the exact bytes, and pins the schema version', async () => {
    rpc.mockResolvedValue(row(TEXT));
    const d = await mod.getReferenceDataset('needles');
    expect(d.text).toBe(TEXT);
    expect(sha(d.text)).toBe(d.sha256);
    expect(d.value).toEqual([{ name: 'AAA', size: 0.09, data: [2.2, 2.1] }]);
    expect(rpc).toHaveBeenCalledWith('get_reference_dataset', { p_dataset: 'needles', p_max_schema_version: 1 });
    // Payload stored raw, before the manifest.
    expect(storage.raw.get('reference:payload:needles:1:1')).toBe(TEXT);
    expect(await storage.getItem('reference:manifest:needles')).toMatchObject({ version: 1, sha256: sha(TEXT) });
  });

  it('serves the per-isolate memo inside the TTL without any read', async () => {
    rpc.mockResolvedValue(row(TEXT));
    await mod.getReferenceDataset('needles');
    await mod.getReferenceDataset('needles');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight read between concurrent callers', async () => {
    rpc.mockResolvedValue(row(TEXT));
    await Promise.all([mod.getReferenceDataset('needles'), mod.getReferenceDataset('needles')]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('uses a fresh KV manifest from another isolate without calling the RPC', async () => {
    storage.raw.set('reference:payload:needles:1:1', TEXT);
    await storage.setItem('reference:manifest:needles', {
      version: 1,
      schemaVersion: 1,
      sha256: sha(TEXT),
      fetchedAt: Date.now(),
    });
    const d = await mod.getReferenceDataset('needles');
    expect(d.text).toBe(TEXT);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refreshes with p_known_sha256 and reuses the KV payload when unchanged', async () => {
    storage.raw.set('reference:payload:needles:1:1', TEXT);
    await storage.setItem('reference:manifest:needles', {
      version: 1,
      schemaVersion: 1,
      sha256: sha(TEXT),
      fetchedAt: 0,
    });
    rpc.mockResolvedValue(row(null));
    const d = await mod.getReferenceDataset('needles');
    expect(d.text).toBe(TEXT);
    expect(rpc).toHaveBeenCalledWith('get_reference_dataset', {
      p_dataset: 'needles',
      p_max_schema_version: 1,
      p_known_sha256: sha(TEXT),
    });
  });

  it('asks again for the bytes when "unchanged" but the KV payload is missing', async () => {
    await storage.setItem('reference:manifest:needles', {
      version: 1,
      schemaVersion: 1,
      sha256: sha(TEXT),
      fetchedAt: 0,
    });
    rpc.mockResolvedValueOnce(row(null)).mockResolvedValueOnce(row(TEXT));
    const d = await mod.getReferenceDataset('needles');
    expect(d.text).toBe(TEXT);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]).not.toHaveProperty('p_known_sha256');
  });

  it('picks up a new version after the TTL', async () => {
    vi.useFakeTimers();
    rpc.mockResolvedValueOnce(row(TEXT)).mockResolvedValueOnce(row(TEXT2, 2));
    expect((await mod.getReferenceDataset('needles')).version).toBe(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const d = await mod.getReferenceDataset('needles');
    expect([d.version, d.text]).toEqual([2, TEXT2]);
  });

  it('does not rewrite the immutable payload key when the RPC says "unchanged"', async () => {
    storage.raw.set('reference:payload:needles:1:1', TEXT);
    await storage.setItem('reference:manifest:needles', {
      version: 1,
      schemaVersion: 1,
      sha256: sha(TEXT),
      fetchedAt: 0,
    });
    const setRaw = vi.spyOn(storage, 'setItemRaw');
    rpc.mockResolvedValue(row(null));
    await mod.getReferenceDataset('needles');
    expect(setRaw).not.toHaveBeenCalled();
    // The stale manifest is moved on, once.
    expect((await storage.getItem('reference:manifest:needles')).fetchedAt).toBeGreaterThan(0);
  });

  it('ignores KV write failures (429) and still serves', async () => {
    storage.failWrites = true;
    rpc.mockResolvedValue(row(TEXT));
    expect((await mod.getReferenceDataset('needles')).text).toBe(TEXT);
  });
});

describe('stale on error', () => {
  it('serves the memo when a refresh fails', async () => {
    vi.useFakeTimers();
    rpc.mockResolvedValueOnce(row(TEXT)).mockRejectedValueOnce(new Error('supabase down'));
    await mod.getReferenceDataset('needles');
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const d = await mod.getReferenceDataset('needles');
    expect(d.text).toBe(TEXT);
  });

  it('serves KV on a cold isolate when Supabase is down', async () => {
    storage.raw.set('reference:payload:needles:1:1', TEXT);
    await storage.setItem('reference:manifest:needles', {
      version: 1,
      schemaVersion: 1,
      sha256: sha(TEXT),
      fetchedAt: 0,
    });
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const d = await mod.getReferenceDataset('needles');
    expect([d.text, d.source]).toEqual([TEXT, 'kv']);
  });

  it('serves the build snapshot on a cold KV plus an outage', async () => {
    rpc.mockRejectedValue(new Error('down'));
    const d = await mod.getReferenceDataset('needles');
    expect(d.source).toBe('snapshot');
    expect(sha(d.text)).toBe(d.sha256);
  });

  it('refuses bytes that do not match their sha256', async () => {
    rpc.mockResolvedValue(row('[1]', 1, sha(TEXT)));
    const d = await mod.getReferenceDataset('needles');
    // Fell back to the snapshot instead of serving the corrupt text.
    expect(d.source).toBe('snapshot');
  });

  it('never trusts a KV payload whose bytes do not match', async () => {
    storage.raw.set('reference:payload:needles:1:1', '[2]');
    await storage.setItem('reference:manifest:needles', {
      version: 1,
      schemaVersion: 1,
      sha256: sha(TEXT),
      fetchedAt: Date.now(),
    });
    rpc.mockResolvedValue(row(TEXT));
    const d = await mod.getReferenceDataset('needles');
    expect(d.text).toBe(TEXT);
  });
});

describe('invalidateReferenceDatasets', () => {
  it('a refresh that started before a publish does not cache the old data as fresh', async () => {
    let release!: (v: unknown) => void;
    rpc.mockImplementationOnce(() => new Promise((r) => (release = r))).mockResolvedValueOnce(row(TEXT2, 2));
    const first = mod.getReferenceDataset('needles');
    await Promise.resolve();
    await mod.invalidateReferenceDatasets(['needles']);
    release(row(TEXT));
    expect((await first).version).toBe(1); // that caller still gets its answer
    expect((await mod.getReferenceDataset('needles')).version).toBe(2); // but it was not memoised
  });

  it('expires the memo and the KV manifest, so the next read refreshes', async () => {
    rpc.mockResolvedValueOnce(row(TEXT)).mockResolvedValueOnce(row(TEXT2, 2));
    await mod.getReferenceDataset('needles');
    await mod.invalidateReferenceDatasets(['needles']);
    expect((await storage.getItem('reference:manifest:needles')).fetchedAt).toBe(0);
    expect((await mod.getReferenceDataset('needles')).version).toBe(2);
  });
});
