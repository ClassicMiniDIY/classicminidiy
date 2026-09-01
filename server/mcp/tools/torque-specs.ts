import { z } from 'zod';
import data from '../../../data/torqueSpecs.json';
import { TORQUE_UNITS } from '../../../data/models/units';
import { lookup, relatedNote, unitsInUse, type LookupData, type UnitMap } from '../../utils/mcpLookup';

/**
 * Torque Specifications MCP Tool
 * Look up Classic Mini torque figures by fastener or system
 */
/**
 * Units come from `data/models/units.ts`, beside the data they describe, so the
 * tool, the website table, that page's JSON-LD and the API routes cannot drift
 * apart about what a column means. They already had.
 */
const UNITS: UnitMap = TORQUE_UNITS;

export default defineMcpTool({
  description:
    "Look up Classic Mini torque specifications. Every figure is in pound-feet, with a metric column derived from it; the `units` field of each response names the column exactly. Quote the figure in the unit `units` gives and never convert between them. Four sections: Engine (41 fasteners), Suspension (24), Clutch & Gearbox (22) and Electrical (6). Search by fastener name (e.g. \"main bearing\", \"flywheel\", \"cylinder head\") or browse a whole section. MANY FIGURES ARE ENGINE-SPECIFIC: the same joint has different torques for 848/998 than for 970/1071/1275, and the rows are named differently ('bolts' vs 'nuts' vs 'set screws'). Include the displacement in the query when you know it, and always read each row's `notes` before quoting a figure.",

  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        'Fastener or component to find, e.g. "main bearing 1275", "flywheel", "head nut". Every word must match, so extra words narrow the result — and a word the archive does not use for that engine will hide the row you want, which is why `related` exists. Prefer the fastener plus the displacement over the fastener plus a guessed fastener type. Omit to browse a whole section.'
      ),
    section: z
      .string()
      .optional()
      .describe(
        'Restrict to one section. The only valid values are "Engine", "Suspension", "Clutch & Gearbox" and "Electrical" (or the keys engineTable, suspensionTable, gearboxTable, electricalTable). Matched exactly and in full, so a bare Gearbox will not match the Clutch & Gearbox section.'
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
          'fastener',
          'The same fastener is often named differently across engine variants (the 848/998 row may say "bolts" ' +
            'where the 1275 row says "nuts" or "set screws"), so an exact-sounding query can return one confident ' +
            'row that does NOT apply to the engine asked about. Always check the `notes` field for the ' +
            'displacement a row covers.'
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
        `**Torque Specifications** — ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'}` +
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
