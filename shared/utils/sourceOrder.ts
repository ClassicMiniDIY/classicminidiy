/**
 * The order retailers are listed in on a part page.
 *
 * The archive is supplier-agnostic. Whichever source happens to be listed first
 * reads as a recommendation, and insertion order would hand that permanently to
 * whichever source was ingested first — Somerford, in every case, purely
 * because it was crawled in August.
 *
 * SEEDED PER PART, NOT RANDOM PER RENDER. `Math.random()` would give the server
 * one order and the client another, and Vue's hydration repair does not merely
 * flash the wrong order — it corrupts the subtree, which is the failure this
 * repo has been bitten by before. A seed derived from the part number is stable
 * across SSR and client, stable across reloads, and still spreads first place
 * evenly across sources over ten thousand parts.
 */

/** FNV-1a. Small, dependency-free, and good enough to decorrelate part numbers. */
function seedFrom(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: a small deterministic PRNG seeded by the hash above. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable, unranked ordering of a part's sources.
 *
 * Returns a new array; the input is not mutated. Same input always gives the
 * same output, so it is safe to call during SSR and again on the client.
 */
export function shuffleSourcesForPart<T>(items: readonly T[], partNumber: string): T[] {
  const out = [...items];
  if (out.length < 2) return out;

  const random = mulberry32(seedFrom(partNumber.toUpperCase()));
  // Fisher-Yates, from the end.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
