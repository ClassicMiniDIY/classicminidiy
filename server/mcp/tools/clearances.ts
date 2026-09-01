import { z } from 'zod';
import data from '../../../data/commonClearances.json';
import { lookup, relatedNote, type LookupData } from '../../utils/mcpLookup';

/**
 * Common Clearances MCP Tool
 * Look up Classic Mini clearance and endfloat specifications
 */
export default defineMcpTool({
  description:
    'Look up Classic Mini clearance and endfloat specifications in thousandths of an inch and mm. A short reference of 10 commonly-needed tolerances: crankshaft thrust washer endfloat and rocker/valve clearances on the engine side, and primary gear, idler gear, laygear and differential preload figures on the gearbox side. It does NOT cover piston-to-bore or bearing clearances.',

  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        'Component or clearance to find, e.g. "crankshaft endfloat", "piston", "valve". Every word must match, so extra words narrow the result. Omit to browse a whole section.'
      ),
    section: z
      .string()
      .optional()
      .describe(
        'Restrict to one section. The only valid values are "Engine" and "Clutch & Gearbox" (or the keys engineTable, gearboxTable). Matched exactly and in full, so a bare Gearbox will not match the Clutch & Gearbox section.'
      ),
    limit: z.number().int().positive().max(200).default(50).describe('Maximum rows to return. Default 50.'),
  },

  async handler({ query, section, limit }) {
    const result = lookup(data as unknown as LookupData, { query, section, limit });

    // Near-misses an over-narrow AND query excluded. Surfaced in BOTH branches
    // below, including the zero-match one, where "nothing matched, but these
    // almost did" is the whole of the useful answer.
    const note = result.related.length ? relatedNote('component') : undefined;

    if (result.totalMatches === 0) {
      return jsonResult({
        query: query ?? null,
        section: section ?? null,
        totalMatches: 0,
        matches: [],
        ...(note ? { related: result.related, relatedTruncated: result.relatedTruncated, relatedNote: note } : {}),
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
      availableSections: result.availableSections,
      formattedText: [
        `**Common Clearances** — ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'}` +
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
