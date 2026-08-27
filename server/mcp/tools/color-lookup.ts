import { z } from 'zod';
import { getServiceClient } from '../../utils/supabase';

/**
 * Paint Colour MCP Tool
 *
 * Reads the archive's paint database. Only APPROVED rows are ever returned —
 * this endpoint is reachable by any valid API key and must not expose the
 * moderation queue.
 *
 * Columns are listed explicitly rather than `*`: since the profiles split,
 * some columns are revoked from anon and Postgres expands `*` to every column,
 * failing the whole query with 42501. The service client used here is not
 * subject to that, but keeping the list explicit means this tool returns the
 * same public shape the site does and cannot start leaking a column that is
 * later added for internal use.
 */
const COLOR_COLUMNS = [
  'id',
  'name',
  'code',
  'short_code',
  'ditzler_ppg_code',
  'dulux_code',
  'year_start',
  'year_end',
  'hex_value',
  'has_swatch',
].join(', ');

function yearsLabel(start: number | null, end: number | null): string | null {
  if (start && end) return `${start}-${end}`;
  if (start) return String(start);
  return null;
}

/**
 * Postgres/PostgREST errors reach us as prose, but an upstream WAF block arrives
 * as a full HTML page — dumping that into an MCP result is noise the caller
 * cannot act on. Keep it to one line.
 */
function readableError(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  if (/^<!DOCTYPE|^<html/i.test(flat)) return 'the request was rejected upstream; try simpler search text';
  return flat.length > 200 ? `${flat.slice(0, 200)}...` : flat;
}

export default defineMcpTool({
  description:
    'Look up Classic Mini factory paint colours from the archive. Search by colour name, factory paint code (e.g. "GN37", "BLVC"), or Ditzler/PPG and Dulux cross-reference codes. Returns the codes and a broad colour family. Only approved archive entries are returned.',

  inputSchema: {
    query: z
      .string()
      .min(1)
      .max(60)
      .optional()
      .describe(
        'Colour name or paint code, e.g. "Almond Green", "GN37", "Old English White". Partial names match. Omit to browse the archive.'
      ),
    limit: z.number().int().positive().max(100).default(25).describe('Maximum colours to return. Default 25.'),
  },

  async handler({ query, limit }) {
    try {
      const supabase = getServiceClient();
      let request = supabase.from('colors').select(COLOR_COLUMNS).eq('status', 'approved');

      if (query) {
        // Escape PostgREST's or() delimiters. An unescaped comma or paren in the
        // query would otherwise be parsed as filter syntax rather than as text.
        const safe = query.replace(/[,()]/g, ' ').trim();
        request = request.or(
          ['name', 'code', 'short_code', 'ditzler_ppg_code', 'dulux_code'].map((c) => `${c}.ilike.%${safe}%`).join(',')
        );
      }

      const { data, error } = await request.order('name').limit(limit + 1);
      if (error) {
        console.error('color-lookup MCP error:', error);
        return errorResult(`Could not read the colour archive: ${readableError(error.message)}`);
      }

      // One row was over-fetched: its presence is what makes `truncated` exact.
      // Comparing the returned count to `limit` instead reports truncation on a
      // complete result set that happens to be exactly `limit` long.
      const fetched = (data ?? []) as Record<string, any>[];
      const truncated = fetched.length > limit;
      const rows = fetched.slice(0, limit);

      if (rows.length === 0) {
        return jsonResult({
          inputs: { query: query ?? null },
          totalMatches: 0,
          matches: [],
          hint: 'No colour matched. Try a shorter name fragment or a factory code such as "GN37".',
        });
      }

      const matches = rows.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code || null,
        shortCode: c.short_code || null,
        ditzlerPpgCode: c.ditzler_ppg_code || null,
        duluxCode: c.dulux_code || null,
        colorFamily: c.hex_value || null,
        years: yearsLabel(c.year_start, c.year_end),
        hasSwatch: Boolean(c.has_swatch),
        url: `https://www.classicminidiy.com/archive/colors/${c.id}`,
      }));

      return jsonResult({
        inputs: { query: query ?? null },
        totalMatches: matches.length,
        truncated,
        matches,
        notes:
          'colorFamily is a broad grouping ("red", "green", "grey"), NOT a hex code — the archive records families rather than exact values. years is usually null; the archive does not carry per-colour year ranges for most entries.',
        formattedText: [
          `**Paint Colours** — ${matches.length} match${matches.length === 1 ? '' : 'es'}`,
          '',
          ...matches.map(
            (c) =>
              `- **${c.name}**${c.code ? ` (${c.code})` : ''}${c.colorFamily ? ` — ${c.colorFamily}` : ''}${c.years ? ` — ${c.years}` : ''}`
          ),
        ].join('\n'),
      });
    } catch (error: any) {
      console.error('color-lookup MCP error:', error);
      return errorResult(`Could not read the colour archive: ${readableError(error.message)}`);
    }
  },
});
