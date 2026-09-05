/**
 * GET /api/archive/parts/:number  (public — the part detail page)
 *
 * Everything about one part: what it is, its supersession chain both
 * directions, what it fits, which plates it appears on, and where to see it on
 * the source's own site.
 *
 * Service role, and therefore enforcing both gates by hand — see the note in
 * search.get.ts. Fails closed on an unreadable source list.
 *
 * `sourceUrls` is the reason this cannot be a client query: the retailer link
 * lives in `part_source_records`, which anon cannot read because that table also
 * holds retailer identifiers and raw payloads. Only the link is exposed here.
 */
import { getServiceClient } from '../../../utils/supabase';

const MAX_APPEARS_ON = 40;
const MAX_FITS = 60;

function normalise(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-.]/g, '');
}

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'number');
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'A part number is required' });

  const norm = normalise(decodeURIComponent(raw));
  if (norm.length < 2 || !/^[A-Z0-9]+$/.test(norm)) {
    throw createError({ statusCode: 404, statusMessage: 'Part not found' });
  }

  const db = getServiceClient();

  const { data: sources, error: sourceError } = await db
    .from('part_sources')
    .select('id, name, domain, licence_status');
  if (sourceError) throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });
  const visible = (sources ?? []).filter((s) => s.licence_status !== 'declined');
  const sourceById = new Map(visible.map((s) => [s.id, s]));

  const { data: part } = await db
    .from('parts')
    .select('id, part_number_display, part_number_norm, description, kind, system, category, notes, source_id')
    .eq('part_number_norm', norm)
    .eq('status', 'published')
    .maybeSingle();

  // A part from a declined source answers exactly like one that never existed.
  if (!part || (part.source_id && !sourceById.has(part.source_id))) {
    throw createError({ statusCode: 404, statusMessage: 'Part not found' });
  }

  const [supersessions, applicability, callouts, records] = await Promise.all([
    db
      .from('part_supersessions')
      .select(
        'predecessor_id, successor_id, relation, ' +
          'predecessor:parts!part_supersessions_predecessor_id_fkey(part_number_display, description), ' +
          'successor:parts!part_supersessions_successor_id_fkey(part_number_display, description)'
      )
      .or(`predecessor_id.eq.${part.id},successor_id.eq.${part.id}`),
    db.from('part_applicability').select('qualifier_text, source_id').eq('part_id', part.id),
    db
      .from('part_diagram_callouts')
      .select('callout_number, diagram:part_diagrams!inner(id, title, catalogue_section, status, source_id)')
      .eq('part_id', part.id)
      .eq('part_diagrams.status', 'published'),
    db.from('part_source_records').select('source_id, source_url').eq('part_id', part.id),
  ]);

  const supersessionRows = (supersessions.data ?? []) as any[];
  const appearsOn = ((callouts.data ?? []) as any[])
    .filter((c) => c.diagram && sourceById.has(c.diagram.source_id))
    .map((c) => ({
      diagramId: c.diagram.id,
      title: c.diagram.title,
      catalogueSection: c.diagram.catalogue_section,
      calloutNumber: c.callout_number,
    }));

  const source = part.source_id ? sourceById.get(part.source_id) : null;

  return {
    partNumber: part.part_number_display,
    slug: part.part_number_norm,
    description: part.description,
    kind: part.kind,
    system: part.system,
    category: part.category,
    notes: part.notes,
    replacedBy: supersessionRows
      .filter((s) => s.predecessor_id === part.id && s.successor)
      .map((s) => ({
        partNumber: s.successor.part_number_display,
        description: s.successor.description,
        relation: s.relation,
      })),
    replaces: supersessionRows
      .filter((s) => s.successor_id === part.id && s.predecessor)
      .map((s) => ({
        partNumber: s.predecessor.part_number_display,
        description: s.predecessor.description,
        relation: s.relation,
      })),
    fits: ((applicability.data ?? []) as any[]).slice(0, MAX_FITS).map((a) => a.qualifier_text),
    fitsTotal: (applicability.data ?? []).length,
    appearsOn: appearsOn.slice(0, MAX_APPEARS_ON),
    appearsOnTotal: appearsOn.length,
    sourceUrls: ((records.data ?? []) as any[])
      .filter((r) => r.source_url && sourceById.has(r.source_id))
      .map((r) => ({ source: sourceById.get(r.source_id)!.name, url: r.source_url })),
    source: source ? { name: source.name, domain: source.domain } : null,
  };
});
