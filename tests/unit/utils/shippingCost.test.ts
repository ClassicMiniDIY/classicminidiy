import { describe, it, expect } from 'vitest';
import { normalizeShippingCost } from '~/app/utils/shippingCost';

describe('normalizeShippingCost', () => {
  it('keeps 0, which means free shipping', () => {
    expect(normalizeShippingCost(0)).toBe(0);
    expect(normalizeShippingCost('0')).toBe(0);
  });

  it('keeps a positive cost', () => {
    expect(normalizeShippingCost(15)).toBe(15);
    expect(normalizeShippingCost(12.5)).toBe(12.5);
    expect(normalizeShippingCost('7.25')).toBe(7.25);
  });

  it('maps an empty field to null, which means the cost varies', () => {
    expect(normalizeShippingCost('')).toBeNull();
    expect(normalizeShippingCost(null)).toBeNull();
    expect(normalizeShippingCost(undefined)).toBeNull();
  });

  it('refuses values that are not a cost', () => {
    expect(normalizeShippingCost(-5)).toBeNull();
    expect(normalizeShippingCost(Number.NaN)).toBeNull();
    expect(normalizeShippingCost(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeShippingCost('abc')).toBeNull();
  });
});
