/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { hotspotBounds, cropWindow } from '~~/server/utils/hotspotBounds';

describe('hotspotBounds', () => {
  it('bounds a polygon from space-separated points', () => {
    // The form the source actually writes.
    expect(hotspotBounds({ points: '10 20 40 20 40 60 10 60' })).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('bounds a circle from centre and radius', () => {
    expect(hotspotBounds({ cx: '100', cy: '200', r: '13' })).toEqual({ x: 87, y: 187, width: 26, height: 26 });
  });

  it('bounds a rect', () => {
    expect(hotspotBounds({ x: '5', y: '6', width: '30', height: '40' })).toEqual({ x: 5, y: 6, width: 30, height: 40 });
  });

  it.each([
    ['null hotspot', null],
    ['empty object', {}],
    ['degenerate polygon', { points: '10 20 10 20' }],
    ['odd coordinate count', { points: '10 20 30' }],
    ['zero radius', { cx: 1, cy: 1, r: 0 }],
    ['non-numeric', { cx: 'x', cy: 'y', r: 'z' }],
  ])('returns null for %s rather than guessing', (_label, input) => {
    // A crop computed from a bad box lands on blank paper and reads as a data
    // bug rather than an absent hotspot.
    expect(hotspotBounds(input as never)).toBeNull();
  });
});

describe('cropWindow', () => {
  const image = { w: 2000, h: 3000 };

  it('never crops tighter than the minimum, so a small circle keeps its context', () => {
    const win = cropWindow({ x: 987, y: 1487, width: 26, height: 26 }, image.w, image.h);
    expect(win.width).toBeGreaterThanOrEqual(420);
    expect(win.height).toBe(win.width);
  });

  it('centres on the hotspot', () => {
    const win = cropWindow({ x: 900, y: 1400, width: 200, height: 200 }, image.w, image.h);
    expect(win.x + win.width / 2).toBeCloseTo(1000, 0);
    expect(win.y + win.height / 2).toBeCloseTo(1500, 0);
  });

  it('stays on the paper at the top-left corner', () => {
    const win = cropWindow({ x: 0, y: 0, width: 20, height: 20 }, image.w, image.h);
    expect(win.x).toBe(0);
    expect(win.y).toBe(0);
  });

  it('stays on the paper at the bottom-right corner', () => {
    const win = cropWindow({ x: 1980, y: 2980, width: 20, height: 20 }, image.w, image.h);
    expect(win.x + win.width).toBeLessThanOrEqual(image.w);
    expect(win.y + win.height).toBeLessThanOrEqual(image.h);
  });

  it('never asks for a window larger than the drawing', () => {
    const win = cropWindow({ x: 10, y: 10, width: 1900, height: 2900 }, image.w, image.h);
    expect(win.width).toBeLessThanOrEqual(Math.min(image.w, image.h));
  });
});
