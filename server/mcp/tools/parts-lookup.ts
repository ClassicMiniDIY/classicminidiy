import { z } from 'zod';
import { getServiceClient } from '../../utils/supabase';
import { buildPartSearchFilter, safePartNumberPattern } from '../../utils/partSearchFilter';
import { shuffleSourcesForPart } from '../../../shared/utils/sourceOrder';

/**
 * Part Number MCP Tool
 *
 * Looks up a Classic Mini part number: what it is, what it supersedes or is
 * superseded by, what it fits, and which factory plate it appears on.
 *
 * THE KILL SWITCH IS ENFORCED HERE, BY HAND. Every other consumer of this data
 * gets it from RLS, but this tool runs on the service role and service_role
 * BYPASSES RLS — so a source set to `declined` on /admin/parts would keep being
 * served through the public API unless this file filters it out itself. That is
 * the whole point of the switch, so it is the first thing the handler does and
 * it fails CLOSED: if the source list cannot be read, nothing is returned.
 *
 * Columns are listed explicitly rather than `*`, for the same reason
 * wheel-search does it: `*` would start returning any column later added for
 * internal use without anyone revisiting this tool.
 */
const PART_COLUMNS = [
  'id',
  'part_number_norm',
  'part_number_display',
  'description',
  'kind',
  'system',
  'category',
  'source_id',
].join(', ');

/**
 * Caps on the child collections attached to each match.
 *
 * These are unbounded in the data, not in theory: a spring washer appears on
 * 389 callouts and some parts carry 63 applicability rows. Attaching all of
 * them to 50 matches produces thousands of near-identical lines that flood the
 * agent's context and bury the supersession chain, which is the actual answer.
 * The counts are reported alongside so a caller knows what was left out.
 */
const MAX_APPEARS_ON = 8;
const MAX_FITS = 12;
const MAX_SOURCE_URLS = 3;

function readableError(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  if (/^<!DOCTYPE|^<html/i.test(flat)) return 'the request was rejected upstream; try simpler search text';
  return flat.length > 200 ? `${flat.slice(0, 200)}...` : flat;
}

export default defineMcpTool({
  description:
    'Look up a Classic Mini part number in the archive. Give an exact part number (e.g. "12G2994", "ALA6654") or search words from a description (e.g. "idler gear bearing"). Returns what the part is, its supersession chain — what replaced it, or what it replaced — what it fits, and which factory parts-list plate it appears on. Use this before web search for any question about a part number.',

  inputSchema: {
    query: z
      .string()
      .min(2)
      .max(60)
      .optional()
      .describe('Part number or words from the description, e.g. "12G2994" or "idler gear bearing".'),
    partNumber: z
      .string()
      .min(2)
      .max(40)
      .optional()
      .describe(
        'An exact part number. Spacing, hyphens, dots and case are ignored, so "12g-2994" and "12G2994" are the same part.'
      ),
    includeSupersessions: z
      .boolean()
      .default(true)
      .describe(
        'Include what each part superseded or was superseded by. Leave on: a superseded number quoted without its replacement is a confidently wrong answer.'
      ),
    limit: z.number().int().positive().max(50).default(10).describe('Maximum parts to return. Default 10.'),
  },

  async handler({ query, partNumber, includeSupersessions, limit }) {
    try {
      const supabase = getServiceClient();

      if (!query && !partNumber) {
        return errorResult('Give either `partNumber` for an exact number, or `query` to search descriptions.');
      }

      // 1. The kill switch. Fails closed — an unreadable source list returns
      //    nothing rather than everything.
      const { data: sources, error: sourceError } = await supabase
        .from('part_sources')
        .select('id, name, domain, licence_status');

      if (sourceError) {
        console.error('parts-lookup MCP error (sources):', sourceError);
        return errorResult(`Could not read the parts archive: ${readableError(sourceError.message)}`);
      }

      const visible = (sources ?? []).filter((s) => s.licence_status !== 'declined');
      const visibleIds = visible.map((s) => s.id);
      const sourceById = new Map(visible.map((s) => [s.id, s]));

      if (visibleIds.length === 0) {
        return jsonResult({
          inputs: { query: query ?? null, partNumber: partNumber ?? null },
          totalMatches: 0,
          matches: [],
          hint: 'No part source is currently available.',
        });
      }

      // 2. Matches. Exact number first; otherwise a contains-match on the
      //    normalised number OR the description.
      let request = supabase
        .from('parts')
        .select(PART_COLUMNS)
        .eq('status', 'published')
        // A part with no source is ours, not a retailer's, and stays visible —
        // matching the RLS policy the other consumers read through.
        .or(`source_id.is.null,source_id.in.(${visibleIds.join(',')})`);

      if (partNumber) {
        const exact = safePartNumberPattern(partNumber);
        if (exact.length < 2) {
          return errorResult('That does not look like a part number. Try `query` to search descriptions instead.');
        }
        request = request.eq('part_number_norm', exact);
      } else {
        const filter = buildPartSearchFilter(query!);
        if (!filter) {
          return errorResult(
            'That search reduces to nothing usable. Try letters and digits from the number or the description.'
          );
        }
        request = request.or(filter);
      }

      const { data, error } = await request.order('part_number_norm').limit(limit + 1);

      if (error) {
        console.error('parts-lookup MCP error:', error);
        return errorResult(`Could not read the parts archive: ${readableError(error.message)}`);
      }

      // Over-fetch by one so `truncated` is exact rather than reporting
      // truncation on a complete result that happens to be exactly `limit` long.
      const fetched = (data ?? []) as Record<string, any>[];
      const truncated = fetched.length > limit;
      const rows = fetched.slice(0, limit);

      if (rows.length === 0) {
        return jsonResult({
          inputs: { query: query ?? null, partNumber: partNumber ?? null },
          totalMatches: 0,
          matches: [],
          hint: partNumber
            ? 'No part carries that exact number. Try `query` instead — the number may appear inside a description, or be recorded under a supersession.'
            : 'Nothing matched. Try a shorter fragment of the number, or fewer words.',
        });
      }

      const ids = rows.map((p) => p.id);

      // 3. Supersessions, applicability and plate appearances, in three reads
      //    for the whole result set rather than three per part.
      const [supersessions, applicability, callouts, records] = await Promise.all([
        includeSupersessions
          ? supabase
              .from('part_supersessions')
              .select(
                'predecessor_id, successor_id, relation, predecessor:parts!part_supersessions_predecessor_id_fkey(part_number_display), successor:parts!part_supersessions_successor_id_fkey(part_number_display)'
              )
              .or(`predecessor_id.in.(${ids.join(',')}),successor_id.in.(${ids.join(',')})`)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('part_applicability').select('part_id, qualifier_text').in('part_id', ids),
        supabase
          .from('part_diagram_callouts')
          .select(
            'part_id, callout_number, diagram:part_diagrams!inner(id, title, catalogue_section, status, source_id)'
          )
          .in('part_id', ids)
          .eq('part_diagrams.status', 'published'),
        // The link back to the retailer's own page for the part. This is
        // mitigation 1 of the design — attribution that sends traffic to the
        // source rather than replacing it — and it is also the most directly
        // useful thing in a result, because it is where someone actually buys
        // the part or sees a photograph of it.
        supabase.from('part_source_records').select('part_id, source_id, source_url').in('part_id', ids),
      ]);

      const supersessionRows = (supersessions.data ?? []) as any[];
      const applicabilityRows = (applicability.data ?? []) as any[];
      const recordRows = ((records.data ?? []) as any[]).filter((r) => r.source_url && sourceById.has(r.source_id));
      const calloutRows = ((callouts.data ?? []) as any[]).filter(
        (c) => c.diagram && (c.diagram.source_id === null || sourceById.has(c.diagram.source_id))
      );

      const matches = rows.map((p) => {
        const source = p.source_id ? sourceById.get(p.source_id) : null;

        const allFits = applicabilityRows.filter((a) => a.part_id === p.id).map((a) => a.qualifier_text);
        const allAppearsOn = calloutRows
          .filter((c) => c.part_id === p.id)
          .map((c) => ({
            plate: c.diagram.title,
            catalogueSection: c.diagram.catalogue_section || null,
            calloutNumber: c.callout_number,
          }));

        const supersedes = supersessionRows
          .filter((s) => s.predecessor_id === p.id)
          .map((s) => ({ partNumber: s.successor?.part_number_display ?? null, relation: s.relation }))
          .filter((s) => s.partNumber);
        const supersededBy = supersessionRows
          .filter((s) => s.successor_id === p.id)
          .map((s) => ({ partNumber: s.predecessor?.part_number_display ?? null, relation: s.relation }))
          .filter((s) => s.partNumber);

        return {
          partNumber: p.part_number_display,
          description: p.description || null,
          kind: p.kind || null,
          system: p.system || null,
          category: p.category || null,
          /** What this part was replaced BY. */
          replacedBy: supersedes,
          /** What this part replaces. */
          replaces: supersededBy,
          fits: allFits.slice(0, MAX_FITS),
          fitsTotal: allFits.length,
          appearsOn: allAppearsOn.slice(0, MAX_APPEARS_ON),
          appearsOnTotal: allAppearsOn.length,
          source: source ? { name: source.name, domain: source.domain } : null,
          /** Where to see or buy this part, on the source's own site. */
          sourceUrls: shuffleSourcesForPart(
            recordRows
              .filter((r) => r.part_id === p.id)
              .map((r) => ({ source: sourceById.get(r.source_id)?.name ?? null, url: r.source_url })),
            p.part_number_display
          ).slice(0, MAX_SOURCE_URLS),
          url: `https://www.classicminidiy.com/archive/parts/${encodeURIComponent(p.part_number_display)}`,
        };
      });

      return jsonResult({
        inputs: { query: query ?? null, partNumber: partNumber ?? null },
        totalMatches: matches.length,
        truncated,
        matches,
        notes:
          '`fits` and `appearsOn` are capped; `fitsTotal` and `appearsOnTotal` give the real counts, and a common fastener genuinely appears on hundreds of plates. `sourceUrls` links to the retailer page for the part — quote it, since that is where a reader sees a photograph and current availability. A part number with entries under `replacedBy` is superseded — quote the replacement alongside it, never on its own. `fits` is the applicability text exactly as the source recorded it and is not normalised. Parts data is compiled from retailer catalogues and credited per match; check the source for current availability.',
        formattedText: [
          `**Parts** — ${matches.length} match${matches.length === 1 ? '' : 'es'}`,
          '',
          ...matches.map((m) => {
            const chain = m.replacedBy.length
              ? ` — SUPERSEDED BY ${m.replacedBy.map((s) => s.partNumber).join(', ')}`
              : m.replaces.length
                ? ` — replaces ${m.replaces.map((s) => s.partNumber).join(', ')}`
                : '';
            const plate = m.appearsOn[0]
              ? ` [plate: ${m.appearsOn[0].plate}, callout ${m.appearsOn[0].calloutNumber}]`
              : '';
            const link = m.sourceUrls[0] ? `\n  ${m.sourceUrls[0].source}: ${m.sourceUrls[0].url}` : '';
            return `- **${m.partNumber}**${m.description ? ` — ${m.description}` : ''}${chain}${plate}${link}`;
          }),
        ].join('\n'),
      });
    } catch (error: any) {
      console.error('parts-lookup MCP error:', error);
      return errorResult(`Could not read the parts archive: ${readableError(error.message)}`);
    }
  },
});
