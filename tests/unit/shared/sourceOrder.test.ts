/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { shuffleSourcesForPart } from '~~/shared/utils/sourceOrder';

const SOURCES = ['Somerford Mini', 'Mini Spares', 'Mini Sport'];

describe('shuffleSourcesForPart', () => {
  it('is deterministic for the same part', () => {
    // The whole reason this is not Math.random(): SSR and the client must agree,
    // or hydration repair corrupts the subtree rather than flashing an order.
    const a = shuffleSourcesForPart(SOURCES, '12G2994');
    const b = shuffleSourcesForPart(SOURCES, '12G2994');
    expect(a).toEqual(b);
  });

  it('is case-insensitive on the part number', () => {
    expect(shuffleSourcesForPart(SOURCES, '12g2994')).toEqual(shuffleSourcesForPart(SOURCES, '12G2994'));
  });

  it('keeps every source exactly once', () => {
    const out = shuffleSourcesForPart(SOURCES, 'ALA6654');
    expect([...out].sort()).toEqual([...SOURCES].sort());
  });

  it('does not mutate its input', () => {
    const input = [...SOURCES];
    shuffleSourcesForPart(input, 'ALA6654');
    expect(input).toEqual(SOURCES);
  });

  it.each([[[]], [['only one']]])('returns short lists unchanged: %j', (items) => {
    expect(shuffleSourcesForPart(items as string[], 'X1')).toEqual(items);
  });

  it('gives different parts different orders', () => {
    // If every part produced the same order the shuffle would be decoration and
    // one source would still be permanently first.
    const orders = new Set(
      ['12G2994', 'ALA6654', 'LWZ204', '12A402', '12G1699', 'AAU2866'].map((p) =>
        shuffleSourcesForPart(SOURCES, p).join('|')
      )
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('spreads first place roughly evenly across sources', () => {
    // The point of the shuffle: no source is systematically recommended.
    // 3000 synthetic part numbers, expect each source first ~1000 times.
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const first = shuffleSourcesForPart(SOURCES, `PART${i}`)[0]!;
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    expect(counts.size).toBe(3);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(3000 / 3 - 200);
      expect(n).toBeLessThan(3000 / 3 + 200);
    }
  });
});
