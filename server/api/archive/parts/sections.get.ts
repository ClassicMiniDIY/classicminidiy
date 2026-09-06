/**
 * GET /api/archive/parts/sections  (public — the browse view)
 *
 * The 161 factory plates, grouped into systems a reader thinks in.
 *
 * This is the answer to "a search box is not a page". Someone who knows the
 * part number types it; everyone else is looking for the gearbox, and needs the
 * drawings laid out rather than a text field.
 *
 * Service role, so the kill switch is enforced by hand — see search.get.ts. It
 * fails closed: an unreadable source list returns nothing.
 */
import { getServiceClient } from '../../../utils/supabase';
import { cleanSectionName, systemForSection, SYSTEM_ORDER } from '../../../utils/partSections';

/**
 * Matches `objectPathFor` in diagram-image.get.ts: derivatives sit beside the
 * original with a `.thumb.jpg` suffix, always JPEG whatever the source was.
 */
function thumbPathFor(imagePath: string): string {
  return `${imagePath.replace(/\.[^./]+$/, '')}.thumb.jpg`;
}

/** An hour, matching the per-image route. Long enough to browse, short enough to lapse. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default defineEventHandler(async () => {
  const db = getServiceClient();

  const { data: sources, error: sourceError } = await db.from('part_sources').select('id, licence_status');
  if (sourceError) throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });
  const visibleIds = (sources ?? []).filter((s) => s.licence_status !== 'declined').map((s) => s.id);
  // totalParts NULL, not 0: with every source declined the page should say it
  // cannot give a figure, not claim the archive is empty.
  if (visibleIds.length === 0) return { systems: [], totalPlates: 0, totalParts: null };

  // ONE ROUND TRIP, NOT THREE. The plates, the catalogue size and the per-plate
  // counts depend on `visibleIds` and on nothing else, so awaiting them in
  // sequence spends three times the latency for no ordering benefit — on an
  // endpoint whose entire purpose is to stop this page being slow.
  const [platesResult, totalResult, countsResult] = await Promise.all([
    db
      .from('part_diagrams')
      .select('id, title, catalogue_section, image_licence, image_path, metadata, source_id')
      .eq('status', 'published')
      .in('source_id', visibleIds),
    db
      .from('parts')
      .select('id', { count: 'exact', head: true })
      // Published only, matching the listing. A licence takedown can withdraw a
      // source's parts while leaving the source row alone, and a headline that
      // counts rows the search cannot return is wrong in exactly that case.
      .eq('status', 'published')
      .or(`source_id.is.null,source_id.in.(${visibleIds.join(',')})`),
    // Parts per plate, via an RPC, because the obvious approach is wrong:
    // selecting the callouts and counting them client-side hits PostgREST's
    // 1000-row cap, so 37,066 callouts silently became 1,000 and most systems
    // reported ZERO parts. Aggregates are disabled on this project, so the
    // grouping has to happen in the database.
    db.rpc('part_plate_part_counts'),
  ]);

  const { data: plates, error } = platesResult;
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });

  const { count: totalParts, error: totalError } = totalResult;
  if (totalError) console.error('[archive/parts] total count unavailable:', totalError.message);

  // A MISSING COUNT RENDERS AS ABSENT, NEVER AS ZERO. If the RPC is not
  // deployed yet, or errors, the page omits the figure rather than telling a
  // reader a plate has no parts on it.
  const { data: counts, error: countError } = countsResult;
  if (countError) console.error('[archive/parts] plate counts unavailable:', countError.message);
  const countsAvailable = !countError;
  const calloutCount = new Map<string, number>();
  for (const row of (counts ?? []) as Array<{ diagram_id: string; part_count: number }>) {
    calloutCount.set(row.diagram_id, Number(row.part_count));
  }

  const grouped = new Map<string, Map<string, any[]>>();
  let uncategorised = 0;

  for (const plate of plates ?? []) {
    const section = cleanSectionName((plate.metadata as any)?.section_name) ?? plate.title;
    const system = systemForSection(section);
    if (!system) {
      uncategorised++;
      continue;
    }
    if (!grouped.has(system)) grouped.set(system, new Map());
    const sections = grouped.get(system)!;
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push({
      id: plate.id,
      title: plate.title,
      // The page number within the section — useful ordering, useless as a label.
      page: plate.catalogue_section,
      hasImage: plate.image_licence === 'copied',
      imagePath: plate.image_licence === 'copied' ? plate.image_path : null,
      parts: countsAvailable ? (calloutCount.get(plate.id) ?? 0) : null,
    });
  }

  const systems = SYSTEM_ORDER.filter((name) => grouped.has(name)).map((name) => {
    const sections = [...grouped.get(name)!.entries()]
      .map(([section, items]) => ({
        section,
        plates: items.sort((a, b) => String(a.page ?? '').localeCompare(String(b.page ?? ''))),
      }))
      .sort((a, b) => a.section.localeCompare(b.section));

    return {
      system: name,
      sections,
      plateCount: sections.reduce((n, s) => n + s.plates.length, 0),
      partCount: countsAvailable
        ? sections.reduce((n, s) => n + s.plates.reduce((m: number, p: any) => m + (p.parts ?? 0), 0), 0)
        : null,
    };
  });

  // ONE SIGNING CALL FOR THE WHOLE PAGE.
  //
  // Every thumbnail used to be an <img> pointed at /api/archive/parts/diagram-image,
  // which reads the diagram row, checks both gates and mints a signed URL — two
  // sequential Supabase round trips per image, measured at 1.68s each. With 161
  // plates on this page that is the whole of its load time, for 20 KB pictures.
  //
  // The gates do not weaken. This handler has already filtered to published
  // plates whose source is not declined, which is exactly what that route
  // re-checks, and it is doing so at the moment the list is built. The URLs
  // still expire, and the bucket is still private.
  const thumbPaths = systems.flatMap((sys) =>
    sys.sections.flatMap((sec) => sec.plates.filter((p: any) => p.imagePath).map((p: any) => thumbPathFor(p.imagePath)))
  );
  const signedByPath = new Map<string, string>();
  if (thumbPaths.length > 0) {
    const { data: signed, error: signError } = await db.storage
      .from('parts-diagrams')
      .createSignedUrls(thumbPaths, SIGNED_URL_TTL_SECONDS);
    if (signError) console.error('[archive/parts] thumbnails unsigned:', signError.message);
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) signedByPath.set(row.path, row.signedUrl);
    }
  }

  // A plate whose URL could not be signed keeps `imageUrl: null` and the page
  // falls back to the per-image route. Slower, but it renders.
  for (const sys of systems) {
    for (const sec of sys.sections) {
      for (const plate of sec.plates as any[]) {
        plate.imageUrl = plate.imagePath ? (signedByPath.get(thumbPathFor(plate.imagePath)) ?? null) : null;
        delete plate.imagePath;
      }
    }
  }

  return {
    systems,
    totalPlates: (plates ?? []).length,
    // Null, not 0, when the count could not be read: the sentence at the top of
    // the page says how big the archive is, and "0" is a lie a reader believes.
    totalParts: totalError ? null : (totalParts ?? 0),
    countsAvailable,
    // Surfaced rather than swallowed: a plate that stops classifying after an
    // upstream rename would otherwise vanish from browse with nothing to notice.
    uncategorised,
  };
});
