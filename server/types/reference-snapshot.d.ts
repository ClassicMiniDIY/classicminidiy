/**
 * `#reference-snapshot`: the Nitro virtual module generated at build time by
 * `scripts/reference-snapshot-module.mjs` (see `nitro.virtual` in nuxt.config.ts).
 * Every reference dataset as its exact published text: the loader's last
 * fallback. Tests alias it to `tests/fixtures/reference/snapshot.ts`.
 */
declare module '#reference-snapshot' {
  import type { ReferenceKey } from '~~/shared/referenceDataKeys';

  const snapshot: Partial<
    Record<ReferenceKey, { version: number; schemaVersion: number; sha256: string; text: string }>
  >;
  export default snapshot;
}
