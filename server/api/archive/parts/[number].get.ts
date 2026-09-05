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
import { hotspotBounds, cropWindow } from '../../../utils/hotspotBounds';

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
      .select(
        'callout_number, quantity, hotspot, diagram:part_diagrams!inner(id, title, catalogue_section, status, source_id, image_width, image_height, image_licence, metadata)'
      )
      .eq('part_id', part.id)
      .eq('part_diagrams.status', 'published'),
    db.from('part_source_records').select('source_id, source_url').eq('part_id', part.id),
  ]);

  // Parts sharing a callout with this one. On a factory plate a single numbered
  // position often covers a small family — a bolt in three lengths, a grille in
  // chrome and black — and knowing what the alternatives ARE is most of what a
  // reader wants when they have found the right position but the wrong variant.
  const calloutKeys = ((callouts.data ?? []) as any[])
    .filter((c) => c.diagram && sourceById.has(c.diagram.source_id))
    .map((c) => ({ diagramId: c.diagram.id, calloutNumber: c.callout_number }))
    .slice(0, 6);

  const siblings: Array<{ partNumber: string; slug: string; description: string | null }> = [];
  if (calloutKeys.length > 0) {
    const { data: siblingRows } = await db
      .from('part_diagram_callouts')
      .select('diagram_id, callout_number, part:parts(part_number_display, part_number_norm, description, status)')
      .in(
        'diagram_id',
        calloutKeys.map((k) => k.diagramId)
      )
      .in(
        'callout_number',
        calloutKeys.map((k) => k.calloutNumber)
      )
      .not('part_id', 'is', null);

    const seen = new Set<string>([part.part_number_norm]);
    for (const row of (siblingRows ?? []) as any[]) {
      // The `.in` pair is a cross product, so re-check the actual pairing.
      if (!calloutKeys.some((k) => k.diagramId === row.diagram_id && k.calloutNumber === row.callout_number)) continue;
      const sib = row.part;
      if (!sib || sib.status !== 'published' || seen.has(sib.part_number_norm)) continue;
      seen.add(sib.part_number_norm);
      siblings.push({
        partNumber: sib.part_number_display,
        slug: sib.part_number_norm,
        description: sib.description,
      });
    }
  }

  const supersessionRows = (supersessions.data ?? []) as any[];
  const appearsOn = ((callouts.data ?? []) as any[])
    .filter((c) => c.diagram && sourceById.has(c.diagram.source_id))
    .map((c) => {
      const d = c.diagram;
      const bounds = hotspotBounds(c.hotspot);
      // The crop is what shows a reader the part rather than its number. It
      // needs geometry, the drawing's dimensions, and a stored drawing to crop.
      const crop =
        bounds && d.image_width && d.image_height && d.image_licence === 'copied'
          ? {
              ...cropWindow(bounds, d.image_width, d.image_height),
              imageWidth: d.image_width,
              imageHeight: d.image_height,
              hotspot: bounds,
            }
          : null;
      return {
        diagramId: d.id,
        title: d.title,
        // The section NAME, not the leading page number: "01" is page one of
        // something, and groups six unrelated systems together.
        section: (d.metadata?.section_name as string | undefined) ?? null,
        calloutNumber: c.callout_number,
        quantity: c.quantity,
        crop,
      };
    });

  const source = part.source_id ? sourceById.get(part.source_id) : null;

  return {
    partNumber: part.part_number_display,
    slug: part.part_number_norm,
    description: part.description,
    kind: part.kind,
    system: part.system,
    category: part.category,
    /** Capped: a universal fastener shares its position with a great many parts. */
    sharesCalloutWith: siblings.slice(0, 12),
    sharesCalloutWithTotal: siblings.length,
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
