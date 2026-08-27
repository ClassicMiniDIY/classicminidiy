// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateCompression } from '~/app/utils/compressionCalculations';

// Stock 1275: the figures the site and the MCP tool both produced before this
// math was shared, so they pin the extraction against a real regression.
const STOCK_1275 = {
  bore: 7.06,
  stroke: 8.128,
  pistonDish: 6.5,
  headVolume: 25.5,
  deckHeight: 20,
  gasket: 3.4,
  customGasket: 0.1,
  decomp: 0,
};

describe('calculateCompression', () => {
  it('reproduces the stock 1275 figures', () => {
    const r = calculateCompression(STOCK_1275);
    expect(r.ratio).toBe(9.43);
    expect(r.capacity).toBe(1272.75);
    expect(r.vc).toBeCloseTo(37.72, 2);
  });

  it('uses customGasket only when gasket is 0', () => {
    const withGasket = calculateCompression({ ...STOCK_1275, gasket: 3.4, customGasket: 99 });
    const withCustom = calculateCompression({ ...STOCK_1275, gasket: 0, customGasket: 3.4 });

    expect(withGasket.gasketVolume).toBe(3.4);
    expect(withCustom.gasketVolume).toBe(3.4);
    expect(withGasket.ratio).toBe(withCustom.ratio);
  });

  it('a larger chamber volume lowers the ratio', () => {
    const small = calculateCompression({ ...STOCK_1275, headVolume: 22 });
    const large = calculateCompression({ ...STOCK_1275, headVolume: 30 });
    expect(small.ratio).toBeGreaterThan(large.ratio);
  });

  it('a decompression plate lowers the ratio', () => {
    const none = calculateCompression({ ...STOCK_1275, decomp: 0 });
    const plate = calculateCompression({ ...STOCK_1275, decomp: 12.4 });
    expect(plate.ratio).toBeLessThan(none.ratio);
  });

  it('capacity is four times the swept volume of one cylinder', () => {
    const r = calculateCompression(STOCK_1275);
    expect(r.capacity).toBeCloseTo(r.sweptVolume * 4, 2);
  });

  it('capacity depends on bore and stroke only', () => {
    const base = calculateCompression(STOCK_1275);
    const differentChamber = calculateCompression({ ...STOCK_1275, headVolume: 30, pistonDish: 12 });
    expect(differentChamber.capacity).toBe(base.capacity);
  });

  it('a longer stroke raises capacity', () => {
    const short = calculateCompression({ ...STOCK_1275, stroke: 6.826 });
    const long = calculateCompression({ ...STOCK_1275, stroke: 8.128 });
    expect(long.capacity).toBeGreaterThan(short.capacity);
  });
});
