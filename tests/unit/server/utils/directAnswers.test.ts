/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyseQuery } from '~~/shared/utils/searchIntent';

// ---------------------------------------------------------------------------
// Direct answers — the thing itself, rendered in the palette.
//
// The rule under test is "nothing rather than a doubtful card": a part that
// only CITES the number is not the part, a chassis string two eras accept is
// a guess, and a five-word query is a question. The chassis and engine cases
// run against the real decoder data; parts and colours mock the client.
// ---------------------------------------------------------------------------

const { mockSearchVisibleParts, mockColourQuery } = vi.hoisted(() => ({
  mockSearchVisibleParts: vi.fn(),
  mockColourQuery: vi.fn(),
}));

vi.mock('~~/server/utils/partsSearch', () => ({ searchVisibleParts: mockSearchVisibleParts }));

function colourBuilder() {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    or: (expression: string) => {
      mockColourQuery(expression);
      return builder;
    },
    order: () => builder,
    limit: () => Promise.resolve(colourResult),
  };
  return builder;
}
let colourResult: { data: unknown; error: unknown } = { data: [], error: null };
const db = { from: () => colourBuilder() } as any;

const { resolveDirectAnswers, resolveReferenceNoun } = await import('~~/server/utils/directAnswers');

const resolve = (query: string) => resolveDirectAnswers(db, query, analyseQuery(query));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockSearchVisibleParts.mockResolvedValue([]);
  colourResult = { data: [], error: null };
});

describe('part', () => {
  it('answers with the part that IS the number, through the shared kill switch', async () => {
    mockSearchVisibleParts.mockResolvedValue([
      {
        partNumber: '12G940',
        slug: '12G940',
        description: 'Cylinder head',
        kind: null,
        system: 'Engine',
        sourceName: 'Mini Spares',
      },
    ]);
    const [answer] = await resolve('12g-940');
    expect(answer).toMatchObject({ kind: 'part', partNumber: '12G940', url: '/archive/parts?q=12G940' });
    expect(mockSearchVisibleParts).toHaveBeenCalledWith(db, '12g-940', 1);
  });

  it('does not answer with a part that merely cites the number', async () => {
    mockSearchVisibleParts.mockResolvedValue([
      {
        partNumber: '12G1322',
        slug: '12G1322',
        description: 'Valve for 12G940 head',
        kind: null,
        system: null,
        sourceName: null,
      },
    ]);
    expect(await resolve('12g940')).toEqual([]);
  });
});

describe('colour', () => {
  it('matches the code with and without its space, approved rows only', async () => {
    colourResult = {
      data: [
        {
          id: 'c1',
          name: 'Almond Green',
          code: 'GN37',
          short_code: null,
          hex_value: '#8a9a5b',
          year_start: 1962,
          year_end: 1970,
        },
      ],
      error: null,
    };
    const [answer] = await resolve('gn37');
    expect(answer).toMatchObject({
      kind: 'colour',
      name: 'Almond Green',
      code: 'GN37',
      years: '1962–1970',
      url: '/archive/colors/c1',
    });
    expect(mockColourQuery).toHaveBeenCalledWith('code.ilike.GN37,code.ilike.GN 37,short_code.ilike.GN37');
  });

  it('returns nothing on a read error', async () => {
    colourResult = { data: null, error: { message: 'boom' } };
    expect(await resolve('GN37')).toEqual([]);
  });
});

describe('chassis', () => {
  it('decodes a 1959-1969 number without being told the era', async () => {
    const [answer] = await resolve('A-A2S7L-123A');
    expect(answer?.kind).toBe('chassis');
    if (answer?.kind !== 'chassis') return;
    expect(answer.yearRange).toBe('1959-1969');
    expect(answer.fields.length).toBeGreaterThan(0);
    expect(answer.url).toBe('/technical/chassis-decoder');
  });

  it('returns nothing for a string no era accepts', async () => {
    expect(await resolve('ZZ-ZZZZZ-999Z')).toEqual([]);
  });
});

describe('engine', () => {
  it('answers an exact prefix code with its capacity and description', async () => {
    const [answer] = await resolve('12H397');
    expect(answer).toMatchObject({
      kind: 'engine',
      code: '12H397',
      capacityCc: '1275',
      url: '/technical/engine-decoder',
    });
  });
});

describe('reference nouns', () => {
  it('answers a torque figure for a short lookup', () => {
    const answer = resolveReferenceNoun('flywheel torque');
    expect(answer).toMatchObject({ kind: 'torque', item: 'Flywheel Center Bolt', url: '/technical/torque' });
    if (answer?.kind !== 'torque') return;
    expect(answer.lbft).toMatch(/^\d/);
    expect(answer.nm).toMatch(/^\d/);
  });

  it('prefers the longest matching term', () => {
    expect(resolveReferenceNoun('flywheel housing bolts')).toMatchObject({ item: "Flywheel Housing 'Wok' Bolts" });
    expect(resolveReferenceNoun('torque flywheel')).toMatchObject({ item: 'Flywheel Center Bolt' });
  });

  it('answers a clearance in both units', () => {
    const answer = resolveReferenceNoun('tappet gap');
    expect(answer).toMatchObject({
      kind: 'clearance',
      item: 'Rocker/Valve Clearance - Stock',
      url: '/technical/clearance',
    });
  });

  it('matches whole words only, and gives up past four words', () => {
    expect(resolveReferenceNoun('flywheels')).toBeNull();
    expect(resolveReferenceNoun('what is the flywheel bolt torque')).toBeNull();
  });

  it('runs for a lookup and a short question, never for a code', async () => {
    expect((await resolve('wheel nuts'))[0]?.kind).toBe('torque');
    expect((await resolve('wheel nut torque?'))[0]?.kind).toBe('torque');
    expect(await resolve('ALA6654')).toEqual([]);
  });
});

describe('caps and failure', () => {
  it('never throws out of the search call', async () => {
    mockSearchVisibleParts.mockRejectedValue(new Error('db down'));
    expect(await resolve('12g940')).toEqual([]);
  });
});
