import { z } from 'zod';
import data from '../../../data/torqueSpecs.json';
import { lookup, type LookupData } from '../../utils/mcpLookup';

/**
 * Torque Specifications MCP Tool
 * Look up Classic Mini torque figures by fastener or system
 */
export default defineMcpTool({
  description:
    'Look up Classic Mini torque specifications in lb-ft and Nm. Four sections: Engine (41 fasteners), Suspension (24), Clutch & Gearbox (22) and Electrical (6). Search by fastener name (e.g. "main bearing", "flywheel", "cylinder head") or browse a whole section.',

  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        'Fastener or component to find, e.g. "main bearing bolts", "flywheel", "head nut". Every word must match, so extra words narrow the result. Omit to browse a whole section.'
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

    if (result.totalMatches === 0) {
      return jsonResult({
        query: query ?? null,
        section: section ?? null,
        totalMatches: 0,
        matches: [],
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
      availableSections: result.availableSections,
      formattedText: [
        `**Torque Specifications** — ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'}` +
          (result.truncated ? ` (showing ${result.matches.length})` : ''),
        '',
        ...result.matches.map((m) => `- [${m.sectionTitle}] ${JSON.stringify(m.item)}`),
      ].join('\n'),
    });
  },

  // Not cached: this searches a bundled JSON object in memory, so a cache
  // round-trip would cost more than the search it replaces. (The args are all
  // scalars, so the toolkit's default key WOULD be safe here — unlike the
  // gearbox tool's object-valued tire_type. It simply is not worth it.)
});
