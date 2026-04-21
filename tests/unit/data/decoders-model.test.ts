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

  it('has exactly 8 entries', () => {
    expect(chassisRanges).toHaveLength(8);
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

// ---------------------------------------------------------------------------
// chassisRanges - 1969-1974 consolidation: no duplicate option values
// ---------------------------------------------------------------------------
describe('chassisRanges 1969-1974 position 2 consolidation', () => {
  it('has no duplicate "A" entries in position 2', () => {
    const range = chassisRanges.find((r) => r.title === '1969-1974');
    expect(range).toBeDefined();
    const pos2 = range!.value.options['2'];
    const aEntries = pos2.filter((o) => o.value === 'A');
    expect(aEntries).toHaveLength(1);
  });

  it('position 2 has unique values across all entries', () => {
    const range = chassisRanges.find((r) => r.title === '1969-1974');
    expect(range).toBeDefined();
    const pos2 = range!.value.options['2'];
    const values = pos2.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - 1974-1980 additions
// ---------------------------------------------------------------------------
describe('chassisRanges 1974-1980 additions', () => {
  it('position 5 includes "N" trim (Special Deluxe / non-North America)', () => {
    const range = chassisRanges.find((r) => r.title === '1974-1980');
    expect(range).toBeDefined();
    const pos5 = range!.value.options['5'];
    const nEntry = pos5.find((o) => o.value === 'N');
    expect(nEntry).toBeDefined();
    expect(nEntry!.name).toMatch(/Special Deluxe|non-North America/i);
  });

  it('position 3 "2D" entry identifies the 1275GT', () => {
    const range = chassisRanges.find((r) => r.title === '1974-1980');
    expect(range).toBeDefined();
    const pos3 = range!.value.options['3'];
    const twoD = pos3.find((o) => o.value === '2D');
    expect(twoD).toBeDefined();
    expect(twoD!.name).toMatch(/1275GT/);
    expect(twoD!.name).not.toMatch(/unclear/i);
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - 1985-1990 additions
// ---------------------------------------------------------------------------
describe('chassisRanges 1985-1990 additions', () => {
  it('position 8 includes "3" for catalyst-equipped variants', () => {
    const range = chassisRanges.find((r) => r.title === '1985-1990');
    expect(range).toBeDefined();
    const pos8 = range!.value.options['8'];
    const catalyst = pos8.find((o) => o.value === '3');
    expect(catalyst).toBeDefined();
    expect(catalyst!.name).toMatch(/catalyst/i);
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - 1990-on additions
// ---------------------------------------------------------------------------
describe('chassisRanges 1990-on additions', () => {
  it('position 6 includes "C" for Cooper variants', () => {
    const range = chassisRanges.find((r) => r.title === '1990-on');
    expect(range).toBeDefined();
    const pos6 = range!.value.options['6'];
    const cooper = pos6.find((o) => o.value === 'C');
    expect(cooper).toBeDefined();
    expect(cooper!.name).toMatch(/Cooper/);
  });
});

// ---------------------------------------------------------------------------
// chassisRanges - Australia (1961-1978) full shape and content
// ---------------------------------------------------------------------------
describe('chassisRanges 1961-1978 (Australia)', () => {
  const getAU = (): ChassisRange => {
    const r = chassisRanges.find((x) => x.title === '1961-1978 (Australia)');
    expect(r).toBeDefined();
    return r!;
  };

  it('exists in chassisRanges', () => {
    const titles = chassisRanges.map((r) => r.title);
    expect(titles).toContain('1961-1978 (Australia)');
  });

  it('PrimaryExample follows YMA2S1 pattern in positions 1-6', () => {
    const range = getAU();
    const ex = range.value.PrimaryExample;
    expect(ex['1']).toBe('Y');
    expect(ex['2']).toBe('M');
    expect(ex['3']).toBe('A');
    expect(ex['4']).toBe('2');
    expect(ex['5']).toBe('S');
    expect(ex['6']).toBe('1');
  });

  it('PrimaryExample positions 7-11 are empty strings', () => {
    const range = getAU();
    const ex = range.value.PrimaryExample;
    for (const p of ['7', '8', '9', '10', '11'] as const) {
      expect(ex[p]).toBe('');
    }
  });

  it('position 1 has exactly one option "Y" for Australian origin', () => {
    const range = getAU();
    const pos1 = range.value.options['1'];
    expect(pos1).toHaveLength(1);
    expect(pos1[0].value).toBe('Y');
    expect(pos1[0].name).toMatch(/Australia/);
  });

  it('position 2 includes M (Morris), K (Cooper), and J (Commercial)', () => {
    const range = getAU();
    const values = range.value.options['2'].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['M', 'K', 'J']));
  });

  it('position 3 includes A (800-999cc) and G (1275cc Cooper S)', () => {
    const range = getAU();
    const pos3 = range.value.options['3'];
    const a = pos3.find((o) => o.value === 'A');
    const g = pos3.find((o) => o.value === 'G');
    expect(a).toBeDefined();
    expect(g).toBeDefined();
    expect(g!.name).toMatch(/1275/);
  });

  it('position 4 has only "2" for two-door body', () => {
    const range = getAU();
    const pos4 = range.value.options['4'];
    expect(pos4).toHaveLength(1);
    expect(pos4[0].value).toBe('2');
  });

  it('position 5 includes S (Saloon) and V (Van/Commercial)', () => {
    const range = getAU();
    const values = range.value.options['5'].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['S', 'V']));
  });

  it('position 6 covers Mk1 through Clubman GT variants', () => {
    const range = getAU();
    const values = range.value.options['6'].map((o) => o.value);
    // At minimum: Mk1 (1), Mk2 (2), an autotrans variant, and the Clubman GT code (8)
    expect(values).toEqual(expect.arrayContaining(['1', '2', '8']));
  });

  it('positions 7-11 are empty arrays (unused for 6-char AU format)', () => {
    const range = getAU();
    const opts = range.value.options;
    expect(opts['7']).toEqual([]);
    expect(opts['8']).toEqual([]);
    expect(opts['9']).toEqual([]);
    expect(opts['10']).toEqual([]);
    expect(opts['11']).toEqual([]);
  });

  it('last array is empty (no assembly plant suffix)', () => {
    const range = getAU();
    const lastArr = range.value.last as unknown[];
    expect(Array.isArray(lastArr)).toBe(true);
    expect(lastArr).toHaveLength(0);
  });

  it('every option entry has a descriptive name longer than 3 chars', () => {
    const range = getAU();
    const opts = range.value.options;
    for (let i = 1; i <= 6; i++) {
      for (const entry of opts[String(i) as keyof typeof opts]) {
        expect(entry.name.length).toBeGreaterThan(3);
      }
    }
  });
});
