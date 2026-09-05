/**
 * GET /api/archive/parts/diagrams/:id  (public — the plate page)
 *
 * One factory parts-list plate: its drawing dimensions, its callouts, and the
 * hotspot geometry that maps each callout onto the drawing.
 *
 * Service role, so both gates are enforced by hand — published diagram AND a
 * source that is not declined. See search.get.ts for why.
 *
 * The image itself is NOT returned here. It lives in a private bucket and is
 * fetched through /api/archive/parts/diagram-image, which re-checks the same
 * two gates every time it mints a signed URL.
 */
import { getServiceClient } from '../../../../utils/supabase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Diagram not found' });
  }

  const db = getServiceClient();

  const { data: diagram } = await db
    .from('part_diagrams')
    .select(
      'id, title, slug, catalogue_section, image_width, image_height, image_licence, source_url, applicability_text, source_id, part_sources!inner(name, domain, licence_status)'
    )
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();

  const source = (diagram as any)?.part_sources;
  if (!diagram || !source || source.licence_status === 'declined') {
    throw createError({ statusCode: 404, statusMessage: 'Diagram not found' });
  }

  const { data: callouts } = await db
    .from('part_diagram_callouts')
    .select(
      'callout_number, part_number_as_printed, description_as_printed, quantity, hotspot, sort_order, ' +
        'part:parts(part_number_display, part_number_norm, description, status)'
    )
    .eq('diagram_id', id)
    .order('sort_order', { ascending: true, nullsFirst: false });

  return {
    id: diagram.id,
    title: diagram.title,
    catalogueSection: diagram.catalogue_section,
    applicabilityText: diagram.applicability_text,
    imageWidth: diagram.image_width,
    imageHeight: diagram.image_height,
    hasImage: diagram.image_licence === 'copied',
    sourceUrl: diagram.source_url,
    source: { name: source.name, domain: source.domain },
    callouts: ((callouts ?? []) as any[]).map((c) => ({
      calloutNumber: c.callout_number,
      // Link only to a part the reader can actually open.
      partNumber: c.part?.status === 'published' ? c.part.part_number_display : null,
      partSlug: c.part?.status === 'published' ? c.part.part_number_norm : null,
      description: c.part?.description ?? c.description_as_printed ?? null,
      printedNumber: c.part_number_as_printed,
      quantity: c.quantity,
      hotspot: c.hotspot,
    })),
  };
});
