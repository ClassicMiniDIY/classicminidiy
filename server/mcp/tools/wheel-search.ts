import { z } from 'zod';
import { getServiceClient } from '../../utils/supabase';

/**
 * Wheel Fitment MCP Tool
 *
 * Reads the archive's wheel database. Only APPROVED rows are returned — this
 * endpoint is reachable by any valid API key and must not expose the moderation
 * queue.
 *
 * Columns are listed explicitly rather than `*`. `*` would pull contributor
 * columns that are revoked from anon, and it would also start returning any
 * column later added for internal use without anyone revisiting this tool.
 */
const WHEEL_COLUMNS = [
  'id',
  'name',
  'wheel_type',
  'size',
  'width',
  'offset_value',
  'bolt_pattern',
  'center_bore',
  'manufacturer',
  'weight',
  'notes',
].join(', ');

export default defineMcpTool({
  description:
    'Search the Classic Mini wheel fitment archive. Find wheels by name or manufacturer (e.g. "Minilite", "Revolution"), or filter by diameter in inches (10, 12, 13) and rim width. Returns offset, bolt pattern, centre bore and weight where recorded — the figures needed to judge whether a wheel will clear the arches and hubs. Only approved archive entries are returned.',

  inputSchema: {
    query: z
      .string()
      .min(1)
      .max(60)
      .optional()
      .describe('Wheel name or manufacturer, e.g. "Minilite", "Revolution", "Cosmic". Partial names match.'),
    size: z
      .number()
      .optional()
      .describe('Wheel diameter in inches. Classic Minis run 10, 12 or 13 inch wheels almost exclusively.'),
    // Free text in the archive, not a number: real values include "5", "4.5",
    // "5j" and "5.5-8.5". A numeric parameter would silently miss every row
    // recorded with a J suffix or a range.
    width: z
      .string()
      .max(20)
      .optional()
      .describe(
        'Rim width in inches, matched exactly as recorded. The archive stores this as free text, so real values include "4.5", "5", "6", "5j" and "5.5-8.5". If an exact width returns nothing, search by name with `query` instead.'
      ),
    limit: z.number().int().positive().max(100).default(25).describe('Maximum wheels to return. Default 25.'),
  },

  async handler({ query, size, width, limit }) {
    try {
      const supabase = getServiceClient();
      let request = supabase.from('wheels').select(WHEEL_COLUMNS).eq('status', 'approved');

      if (query) {
        // Escape PostgREST's or() delimiters — an unescaped comma or paren would
        // be read as filter syntax rather than as text.
        const safe = query.replace(/[,()]/g, ' ').trim();
        request = request.or(['name', 'manufacturer'].map((c) => `${c}.ilike.%${safe}%`).join(','));
      }
      if (size !== undefined) request = request.eq('size', size);
      if (width !== undefined) request = request.eq('width', width);

      const { data, error } = await request.order('name').limit(limit);
      if (error) {
        console.error('wheel-search MCP error:', error);
        return errorResult(`Could not read the wheel archive: ${error.message}`);
      }

      const rows = (data ?? []) as Record<string, any>[];

      if (rows.length === 0) {
        return jsonResult({
          inputs: { query: query ?? null, size: size ?? null, width: width ?? null },
          totalMatches: 0,
          matches: [],
          hint: 'No wheel matched. Try a shorter name fragment, or drop the size/width filter — many archive entries record a name without full dimensions.',
        });
      }

      const matches = rows.map((w) => ({
        id: w.id,
        name: w.name,
        manufacturer: w.manufacturer || null,
        type: w.wheel_type || null,
        sizeInches: w.size ?? null,
        widthInches: w.width ?? null,
        offsetMm: w.offset_value ?? null,
        boltPattern: w.bolt_pattern || null,
        centreBoreMm: w.center_bore ?? null,
        weightKg: w.weight ?? null,
        notes: w.notes || null,
        url: `https://www.classicminidiy.com/archive/wheels/${w.id}`,
      }));

      return jsonResult({
        inputs: { query: query ?? null, size: size ?? null, width: width ?? null },
        totalMatches: matches.length,
        truncated: matches.length === limit,
        matches,
        notes:
          'widthInches, offsetMm, centreBoreMm and weightKg are recorded as free text or left empty on many archive entries, so a null means "not recorded" rather than "zero". Check the entry URL for photos and contributor notes.',
        formattedText: [
          `**Wheels** — ${matches.length} match${matches.length === 1 ? '' : 'es'}`,
          '',
          ...matches.map(
            (w) =>
              `- **${w.name}**${w.manufacturer ? ` (${w.manufacturer})` : ''}` +
              `${w.sizeInches ? ` — ${w.sizeInches}"` : ''}${w.widthInches ? ` x ${w.widthInches}"` : ''}` +
              `${w.offsetMm !== null ? `, offset ${w.offsetMm}mm` : ''}`
          ),
        ].join('\n'),
      });
    } catch (error: any) {
      console.error('wheel-search MCP error:', error);
      return errorResult(`Could not read the wheel archive: ${error.message}`);
    }
  },
});
