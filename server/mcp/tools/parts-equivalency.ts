import { z } from 'zod';
import data from '../../../data/parts.json';
import { lookup, relatedNote, unitsInUse, type LookupData, type UnitMap } from '../../utils/mcpLookup';

/**
 * Parts Equivalency MCP Tool
 * Cross-reference Classic Mini part numbers between brands
 */
/** Part numbers and brands are identifiers, not measurements. */
const UNITS: UnitMap = {};

export default defineMcpTool({
  description:
    'Cross-reference Classic Mini service part numbers between brands. Covers three categories only: oil filters (18 entries), air filters (4) and alternators (2). Search by brand, part number, or application (e.g. "K&N", "1275", "SPI").',

  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        'Brand, part number or application, e.g. "K&N 1275", "E-2601", "oil filter". Every word must match, so extra words narrow the result. Omit to browse a whole section.'
      ),
    section: z
      .string()
      .optional()
      .describe(
        'Restrict to one category. The only valid values are "Air Filters", "Oil Filters" and "Alternators" (or the keys airFilters, oilFilters, alternators). Matched exactly.'
      ),
    limit: z.number().int().positive().max(200).default(50).describe('Maximum rows to return. Default 50.'),
  },

  async handler({ query, section, limit }) {
    const result = lookup(data as unknown as LookupData, { query, section, limit });

    // Near-misses an over-narrow AND query excluded. Surfaced in BOTH branches
    // below, including the zero-match one, where "nothing matched, but these
    // almost did" is the whole of the useful answer.
    const note = result.related.length
      ? relatedNote(
          'part',
          'Brands name the same part differently, so an exact-sounding query can hide the equivalent you were ' +
            'looking for.'
        )
      : undefined;

    if (result.totalMatches === 0) {
      return jsonResult({
        query: query ?? null,
        section: section ?? null,
        totalMatches: 0,
        matches: [],
        ...(note ? { related: result.related, relatedTruncated: result.relatedTruncated, relatedNote: note } : {}),
        units: unitsInUse(result.related, UNITS),
        availableSections: result.availableSections,
        hint: 'No rows matched. Try fewer words, or browse a section from availableSections.',
      });
    }

    return jsonResult({
      query: query ?? null,
      section: section ?? null,
      totalMatches: result.totalMatches,
      returned: result.matches.length,
      truncated: result.truncated,
      matches: result.matches,
      ...(note ? { related: result.related, relatedTruncated: result.relatedTruncated, relatedNote: note } : {}),
      units: unitsInUse([...result.matches, ...result.related], UNITS),
      availableSections: result.availableSections,
      formattedText: [
        `**Parts Equivalency** — ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'}` +
          (result.truncated ? ` (showing ${result.matches.length})` : ''),
        '',
        ...result.matches.map((m) => `- [${m.sectionTitle}] ${JSON.stringify(m.item)}`),
        // `related` belongs here too. This string is the pre-rendered view of
        // the answer, and a consumer that reads it instead of the JSON beside it
        // would otherwise still get the single confident row with no sign that
        // near-misses were withheld — the exact behaviour this reports.
        ...(result.related.length
          ? [
              '',
              `Near misses — matched every word but one:`,
              ...result.related.map(
                (m) => `- [${m.sectionTitle}] (missing "${m.excludedBy}") ${JSON.stringify(m.item)}`
              ),
            ]
          : []),
      ].join('\n'),
    });
  },

  // Not cached: this searches a bundled JSON object in memory, so a cache
  // round-trip would cost more than the search it replaces. (The args are all
  // scalars, so the toolkit's default key WOULD be safe here — unlike the
  // gearbox tool's object-valued tire_type. It simply is not worth it.)
});
