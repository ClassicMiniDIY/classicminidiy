/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { analyseQuery, SURFACES, type QueryKind, type Surface } from '~~/shared/utils/searchIntent';

/**
 * A fixture table, not a set of hand-written cases per rule.
 *
 * Most rows are real queries from `archive_search_misses`. Adding a detector
 * means adding rows with the shape it should catch, and the rows that should
 * NOT move; it never means rewriting a test. When a row here changes kind, a
 * real visitor's query has changed where the Ask row lands.
 */
const FIXTURES: { query: string; kind: QueryKind; lead: Surface }[] = [
  // Part numbers, as typed and as printed.
  { query: '12g940', kind: 'part-number', lead: 'parts' },
  { query: '12G940', kind: 'part-number', lead: 'parts' },
  { query: '12m3412', kind: 'part-number', lead: 'parts' },
  { query: 'ALA6654', kind: 'part-number', lead: 'parts' },
  { query: 'GHF-123', kind: 'part-number', lead: 'parts' },
  { query: '12G-940', kind: 'part-number', lead: 'parts' },
  { query: 'pd16', kind: 'part-number', lead: 'parts' },
  { query: '12g 940', kind: 'part-number', lead: 'parts' },

  // Colour codes. GN37 is four letters-and-digits, which is also a part shape.
  { query: 'GN37', kind: 'colour-code', lead: 'archive' },
  { query: 'BLVC 1234', kind: 'colour-code', lead: 'archive' },
  { query: 'blvc62', kind: 'colour-code', lead: 'archive' },

  // Chassis numbers: hyphenated eras, the Australian form, and the SAX VIN.
  { query: 'A-A2S7L-123A', kind: 'chassis', lead: 'tools' },
  { query: 'YMA2S1-12345', kind: 'chassis', lead: 'tools' },
  { query: 'SAXXL2S1220123456', kind: 'chassis', lead: 'tools' },
  // The slash form the decoder's own test data uses. A decision, not an
  // accident: the slash is a group separator like the hyphen.
  { query: 'A-AB1-L/807922', kind: 'chassis', lead: 'tools' },
  { query: 'XAU1N-547206A', kind: 'chassis', lead: 'tools' },

  // Engine prefix codes, exact only.
  { query: '12H397', kind: 'engine', lead: 'tools' },
  { query: '12h 397', kind: 'engine', lead: 'tools' },
  { query: '99H/791', kind: 'engine', lead: 'tools' },

  // Questions: opener word, trailing ?, or long enough to be a sentence.
  { query: 'how do i bleed the brakes', kind: 'question', lead: 'videos' },
  { query: 'what oil for a 1275', kind: 'question', lead: 'videos' },
  { query: 'brake cylinder install?', kind: 'question', lead: 'videos' },
  { query: 'mini 1000cc 1980 wont start cold', kind: 'question', lead: 'videos' },
  { query: 'Should I fit a 266 cam', kind: 'question', lead: 'videos' },

  // Lookups: the old default order must hold for these.
  { query: 'haltech', kind: 'lookup', lead: 'tools' },
  { query: 'comp ratio', kind: 'lookup', lead: 'tools' },
  { query: 'brake bleeding', kind: 'lookup', lead: 'tools' },
  { query: 'dunlop alloy', kind: 'lookup', lead: 'tools' },
  { query: 'spot light bracket', kind: 'lookup', lead: 'tools' },
  { query: 'rear light bulb', kind: 'lookup', lead: 'tools' },
  { query: 'mini 1000cc 1980', kind: 'lookup', lead: 'tools' },
  { query: '1275', kind: 'lookup', lead: 'tools' },
  { query: 'mk1', kind: 'lookup', lead: 'tools' },
  // Two words squash to a part-number shape; two words are never a code.
  { query: 'mk1 cooper', kind: 'lookup', lead: 'tools' },
  // "show" contains "how"; only the first WORD counts.
  { query: 'show me wheels', kind: 'lookup', lead: 'tools' },
  // A bare opener is someone mid-thought, not a question.
  { query: 'can', kind: 'lookup', lead: 'tools' },
  { query: '', kind: 'lookup', lead: 'tools' },
];

describe('analyseQuery', () => {
  it.each(FIXTURES)('$query → $kind, leads with $lead', ({ query, kind, lead }) => {
    const intent = analyseQuery(query);
    expect(intent.kind).toBe(kind);
    expect(intent.surfaceOrder[0]).toBe(lead);
  });

  it('puts the Ask row on top for questions and below for everything else', () => {
    expect(analyseQuery('how do i bleed the brakes').askPosition).toBe('top');
    expect(analyseQuery('12g940').askPosition).toBe('bottom');
    expect(analyseQuery('haltech').askPosition).toBe('bottom');
  });

  it('orders every surface exactly once for every kind', () => {
    const seen = new Set<QueryKind>();
    for (const { query } of FIXTURES) {
      const intent = analyseQuery(query);
      seen.add(intent.kind);
      expect([...intent.surfaceOrder].sort()).toEqual([...SURFACES].sort());
    }
    // Every kind the module can produce is represented in the fixtures.
    expect([...seen].sort()).toEqual(
      (['part-number', 'colour-code', 'chassis', 'engine', 'question', 'lookup'] as QueryKind[]).sort()
    );
  });

  it('keeps the pre-unified order for a plain lookup', () => {
    // The five original surfaces, in their original order, then the three new
    // ones. An existing query must rank as it did before this module existed.
    expect(analyseQuery('wheels').surfaceOrder).toEqual([
      'tools',
      'wheels',
      'archive',
      'models',
      'exchange',
      'parts',
      'suppliers',
      'videos',
    ]);
  });
});
