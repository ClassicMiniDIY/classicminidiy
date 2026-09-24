/**
 * Test stand-in for server/utils/referenceData.ts (tests/setup/vitest.setup.ts
 * mocks the real loader with this module for every test file). Same exports,
 * backed by `#reference-snapshot`, which vitest aliases to the committed
 * fixtures, or to `.reference-snapshot/` under REFERENCE_SOURCE=snapshot (the
 * deploy job's live check). The real loader's own test unmocks it.
 */
import snapshot from '#reference-snapshot';
import type { ReferenceKey } from '~~/shared/referenceDataKeys';

export type { ReferenceKey } from '~~/shared/referenceDataKeys';

export interface ReferenceDataset<T = unknown> {
  key: ReferenceKey;
  version: number;
  schemaVersion: number;
  sha256: string;
  text: string;
  value: T;
  source: 'memo' | 'kv' | 'rpc' | 'snapshot';
}

export async function getReferenceDataset<T = unknown>(key: ReferenceKey): Promise<ReferenceDataset<T>> {
  const entry = snapshot[key];
  if (!entry) throw new Error(`reference fixture ${key} missing`);
  // A fresh parse per call: a test that mutates a value cannot leak into the next.
  return { key, ...entry, value: JSON.parse(entry.text) as T, source: 'snapshot' };
}

export async function invalidateReferenceDatasets(_keys: readonly ReferenceKey[]): Promise<void> {}

export function setReferenceCacheHeaders(event: unknown): void {
  const value = 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400';
  (globalThis as any).setResponseHeaders?.(event, { 'Cache-Control': value, 'CDN-Cache-Control': value });
}

export function resetReferenceDataCache(): void {}
