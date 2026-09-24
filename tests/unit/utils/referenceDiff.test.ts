import { describe, expect, it } from 'vitest';
import { diffReferencePayload } from '~/app/utils/referenceDiff';

describe('diffReferencePayload', () => {
  it('diffs named records by name (needles)', () => {
    const a = [
      { name: 'AAA', data: [1] },
      { name: 'AAB', data: [2] },
    ];
    const b = [
      { name: 'AAA', data: [1.1] },
      { name: 'AAC', data: [3] },
    ];
    expect(diffReferencePayload(a, b)).toEqual([
      { kind: 'changed', path: 'AAA' },
      { kind: 'added', path: 'AAC' },
      { kind: 'removed', path: 'AAB' },
    ]);
  });

  it('diffs table items one level down (torque, clearances)', () => {
    const t = (items: unknown[]) => ({ engineTable: { title: 'Engine', items } });
    expect(
      diffReferencePayload(
        t([{ name: 'Head', lbft: '50' }]),
        t([
          { name: 'Head', lbft: '52' },
          { name: 'Sump', lbft: '6' },
        ])
      )
    ).toEqual([
      { kind: 'changed', path: 'engineTable › Head' },
      { kind: 'added', path: 'engineTable › Sump' },
    ]);
  });

  it('reports a table whose own fields changed as one line, and added or removed tables', () => {
    expect(
      diffReferencePayload({ a: { title: 'A', items: [] }, b: 1 }, { a: { title: 'B', items: [] }, c: 1 })
    ).toEqual([
      { kind: 'changed', path: 'a' },
      { kind: 'added', path: 'c' },
      { kind: 'removed', path: 'b' },
    ]);
  });

  it('is empty for identical data', () => {
    expect(diffReferencePayload({ a: [1, 2] }, { a: [1, 2] })).toEqual([]);
  });
});
