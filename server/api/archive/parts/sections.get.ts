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

export default defineEventHandler(async () => {
  const db = getServiceClient();

  const { data: sources, error: sourceError } = await db.from('part_sources').select('id, licence_status');
  if (sourceError) throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });
  const visibleIds = (sources ?? []).filter((s) => s.licence_status !== 'declined').map((s) => s.id);
  if (visibleIds.length === 0) return { systems: [], totalPlates: 0 };

  const { data: plates, error } = await db
    .from('part_diagrams')
    .select('id, title, catalogue_section, image_licence, metadata, source_id')
    .eq('status', 'published')
    .in('source_id', visibleIds);

  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not read the parts archive' });

  // Parts per plate, via an RPC, because the obvious approach is wrong:
  // selecting the callouts and counting them client-side hits PostgREST's
  // 1000-row cap, so 37,066 callouts silently became 1,000 and most systems
  // reported ZERO parts. Aggregates are disabled on this project, so the
  // grouping has to happen in the database.
  //
  // A MISSING COUNT RENDERS AS ABSENT, NEVER AS ZERO. If the RPC is not
  // deployed yet, or errors, the page omits the figure rather than telling a
  // reader a plate has no parts on it.
  const { data: counts, error: countError } = await db.rpc('part_plate_part_counts');
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

  return {
    systems,
    totalPlates: (plates ?? []).length,
    countsAvailable,
    // Surfaced rather than swallowed: a plate that stops classifying after an
    // upstream rename would otherwise vanish from browse with nothing to notice.
    uncategorised,
  };
});
