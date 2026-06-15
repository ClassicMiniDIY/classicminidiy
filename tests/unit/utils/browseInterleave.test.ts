import { describe, it, expect } from 'vitest';
import { planInterleave } from '~~/server/utils/browseInterleave';

describe('planInterleave — 2:1 lead with first-party', () => {
  it('interleaves two first-party then one external on page 1', () => {
    const p = planInterleave(100, 100, 0, 9);
    expect(p.order).toEqual([
      'first_party',
      'first_party',
      'external',
      'first_party',
      'first_party',
      'external',
      'first_party',
      'first_party',
      'external',
    ]);
    expect(p).toMatchObject({ fpStart: 0, fpCount: 6, extStart: 0, extCount: 3 });
  });

  it('continues cleanly onto page 2 (correct rank offsets)', () => {
    const p = planInterleave(100, 100, 9, 9);
    // positions 9..17 → fp ranks 6..11, ext ranks 3..5
    expect(p).toMatchObject({ fpStart: 6, fpCount: 6, extStart: 3, extCount: 3 });
    expect(p.order.filter((k) => k === 'first_party')).toHaveLength(6);
    expect(p.order.filter((k) => k === 'external')).toHaveLength(3);
  });

  it('fills the rest with external once first-party run out (page stays full)', () => {
    const p = planInterleave(3, 100, 0, 10);
    expect(p.order).toEqual([
      'first_party',
      'first_party',
      'external',
      'first_party',
      'external',
      'external',
      'external',
      'external',
      'external',
      'external',
    ]);
    expect(p).toMatchObject({ fpStart: 0, fpCount: 3, extStart: 0, extCount: 7 });
  });

  it('fills with first-party once external run out', () => {
    const p = planInterleave(100, 2, 0, 10);
    // g0: fp fp ext | g1: fp fp ext | then ext gone → fp fp fp fp
    expect(p.order).toEqual([
      'first_party',
      'first_party',
      'external',
      'first_party',
      'first_party',
      'external',
      'first_party',
      'first_party',
      'first_party',
      'first_party',
    ]);
    expect(p).toMatchObject({ fpCount: 8, extCount: 2 });
  });

  it('returns only first-party when there are no external', () => {
    const p = planInterleave(50, 0, 0, 5);
    expect(p.order).toEqual(Array(5).fill('first_party'));
    expect(p).toMatchObject({ fpStart: 0, fpCount: 5, extCount: 0 });
  });

  it('returns only external when there are no first-party', () => {
    const p = planInterleave(0, 50, 0, 5);
    expect(p.order).toEqual(Array(5).fill('external'));
    expect(p).toMatchObject({ extStart: 0, extCount: 5, fpCount: 0 });
  });

  it('handles a final partial page', () => {
    const p = planInterleave(5, 2, 0, 24);
    // total 7: fp fp ext fp fp ext fp
    expect(p.order).toEqual([
      'first_party',
      'first_party',
      'external',
      'first_party',
      'first_party',
      'external',
      'first_party',
    ]);
    expect(p).toMatchObject({ fpCount: 5, extCount: 2 });
  });

  it('returns an empty plan when the offset is past the end', () => {
    const p = planInterleave(3, 1, 100, 24);
    expect(p.order).toEqual([]);
    expect(p).toMatchObject({ fpCount: 0, extCount: 0 });
  });
});

describe('planInterleave — pagination integrity (nothing buried or duplicated)', () => {
  const cases: Array<[number, number, number]> = [
    [100, 100, 24],
    [50, 7, 24],
    [7, 50, 24],
    [0, 30, 24],
    [30, 0, 24],
    [1, 1, 24],
    [25, 25, 10],
    [200, 3, 24],
    [3, 200, 24],
  ];

  it.each(cases)('fp=%i ext=%i limit=%i: every item appears exactly once, no early short page', (fpTotal, extTotal, limit) => {
    const total = fpTotal + extTotal;
    const fpSeen = new Set<number>();
    const extSeen = new Set<number>();
    let collected = 0;

    for (let offset = 0; offset < total; offset += limit) {
      const p = planInterleave(fpTotal, extTotal, offset, limit);
      // Reconstruct the absolute ranks placed on this page, in order.
      let fi = p.fpStart;
      let ei = p.extStart;
      for (const kind of p.order) {
        if (kind === 'first_party') {
          expect(fpSeen.has(fi)).toBe(false);
          fpSeen.add(fi++);
        } else {
          expect(extSeen.has(ei)).toBe(false);
          extSeen.add(ei++);
        }
      }
      collected += p.order.length;
      const isLastPage = offset + limit >= total;
      if (!isLastPage) expect(p.order.length).toBe(limit); // full pages until the end
    }

    expect(collected).toBe(total);
    expect(fpSeen.size).toBe(fpTotal);
    expect(extSeen.size).toBe(extTotal);
    // ranks are exactly 0..total-1 with none missing
    for (let i = 0; i < fpTotal; i++) expect(fpSeen.has(i)).toBe(true);
    for (let i = 0; i < extTotal; i++) expect(extSeen.has(i)).toBe(true);
  });
});
