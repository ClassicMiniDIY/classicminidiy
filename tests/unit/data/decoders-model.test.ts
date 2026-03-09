import { describe, it, expect } from 'vitest';
import { chassisRanges } from '~/data/models/decoders';
import type { ChassisRange } from '~/data/models/decoders';

// ---------------------------------------------------------------------------
// chassisRanges - array shape
// ---------------------------------------------------------------------------
describe('chassisRanges', () => {
  it('is an array', () => {
    expect(Array.isArray(chassisRanges)).toBe(true);
  });

  it('has exactly 7 entries', () => {
    expect(chassisRanges).toHaveLength(7);
  });

  it('each entry has a title string', () => {
    for (const range of chassisRanges) {
      expect(typeof range.title).toBe('string');
      expect(range.title.length).toBeGreaterThan(0);
    }
  });

  it('each entry has a value object', () => {
    for (const range of chassisRanges) {
      expect(typeof range.value).toBe('object');
      expect(range.value).not.toBeNull();
    }
  });

  it('each value has a PrimaryExample property', () => {
    for (const range of chassisRanges) {
      expect(range.value).toHaveProperty('PrimaryExample');
      expect(typeof range.value.PrimaryExample).toBe('object');
    }
  });

  it('each value has an options property', () => {
    for (const range of chassisRanges) {
      expect(range.value).toHaveProperty('options');
      expect(typeof range.value.options).toBe('object');
    }
  });

  it('each value has a number property', () => {
    for (const range of chassisRanges) {
      expect(range.value).toHaveProperty('number');
      expect(typeof range.value.number).toBe('string');
    }
  });

  it('each value has a last property', () => {
    for (const range of chassisRanges) {
      expect(range.value).toHaveProperty('last');
    }
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - expected year ranges
// ---------------------------------------------------------------------------
describe('chassisRanges titles', () => {
  it('includes "1959-1969"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1959-1969');
  });

  it('includes "1969-1974"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1969-1974');
  });

  it('includes "1974-1980"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1974-1980');
  });

  it('includes "1980"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1980');
  });

  it('includes "1980-1985"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1980-1985');
  });

  it('includes "1985-1990"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1985-1990');
  });

  it('includes "1990-on"', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1990-on');
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - PrimaryExample structure
// ---------------------------------------------------------------------------
describe('chassisRanges PrimaryExample structure', () => {
  it('each PrimaryExample has positional keys 1 through 11', () => {
    for (const range of chassisRanges) {
      const example = range.value.PrimaryExample;
      for (let i = 1; i <= 11; i++) {
        expect(example).toHaveProperty(String(i));
      }
    }
  });

  it('each PrimaryExample has a numbers string', () => {
    for (const range of chassisRanges) {
      expect(typeof range.value.PrimaryExample.numbers).toBe('string');
      expect(range.value.PrimaryExample.numbers.length).toBeGreaterThan(0);
    }
  });

  it('each PrimaryExample has a last string', () => {
    for (const range of chassisRanges) {
      expect(typeof range.value.PrimaryExample.last).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - options structure
// ---------------------------------------------------------------------------
describe('chassisRanges options structure', () => {
  it('each options object has keys 1 through 11', () => {
    for (const range of chassisRanges) {
      const opts = range.value.options;
      for (let i = 1; i <= 11; i++) {
        expect(opts).toHaveProperty(String(i));
        expect(Array.isArray(opts[String(i) as keyof typeof opts])).toBe(true);
      }
    }
  });

  it('non-empty option arrays contain objects with value and name strings', () => {
    for (const range of chassisRanges) {
      const opts = range.value.options;
      for (let i = 1; i <= 11; i++) {
        const arr = opts[String(i) as keyof typeof opts];
        for (const entry of arr) {
          expect(typeof entry.value).toBe('string');
          expect(typeof entry.name).toBe('string');
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - known content spot checks
// ---------------------------------------------------------------------------
describe('chassisRanges spot checks', () => {
  it('first range (1959-1969) options[1] includes Austin entry', () => {
    const range1969 = chassisRanges.find((r) => r.title === '1959-1969');
    expect(range1969).toBeDefined();
    const option1 = range1969!.value.options['1'];
    expect(option1.some((o) => o.value === 'A')).toBe(true);
  });

  it('first range (1959-1969) last array includes Longbridge', () => {
    const range1969 = chassisRanges.find((r) => r.title === '1959-1969');
    expect(range1969).toBeDefined();
    const lastArr = range1969!.value.last as { value: string; name: string }[];
    expect(Array.isArray(lastArr)).toBe(true);
    expect(lastArr.some((l) => l.name === 'Longbridge')).toBe(true);
  });

  it('"1990-on" range last array is empty (no assembly plant suffix)', () => {
    const range1990 = chassisRanges.find((r) => r.title === '1990-on');
    expect(range1990).toBeDefined();
    const lastArr = range1990!.value.last as unknown[];
    expect(lastArr).toHaveLength(0);
  });

  it('"1980-1985" range options[1] includes SAX manufacturer code', () => {
    const range1985 = chassisRanges.find((r) => r.title === '1980-1985');
    expect(range1985).toBeDefined();
    const option1 = range1985!.value.options['1'];
    expect(option1.some((o) => o.value === 'SAX')).toBe(true);
  });
});
