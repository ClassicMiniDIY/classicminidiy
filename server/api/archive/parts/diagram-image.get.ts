/**
 * GET /api/archive/parts/diagram-image?diagram=<uuid>
 *
 * Redirects to a short-lived signed URL for a plate drawing.
 *
 * The `parts-diagrams` bucket is PRIVATE, which is what makes the licence kill
 * switch real: a public object stays fetchable by anyone holding its URL after
 * the row is hidden, reducing a takedown to "we stopped linking it". So the
 * bytes are only ever reachable through a signed URL minted here, and this
 * route re-checks visibility every time it mints one.
 *
 * TWO GATES, BOTH ENFORCED HERE because this runs on the service role and
 * service_role bypasses the RLS that protects every other consumer:
 *   * the diagram must be published
 *   * its source must not be declined
 *
 * A redirect rather than a proxy: the bytes go straight from storage to the
 * browser instead of through the Worker, which has neither the memory nor the
 * CPU budget to stream multi-megabyte scans.
 */
import { getServiceClient } from '../../../utils/supabase';

/** One hour: longer than reading a plate, short enough that a leaked link lapses. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default defineEventHandler(async (event) => {
  const diagramId = getQuery(event).diagram;

  if (typeof diagramId !== 'string' || !/^[0-9a-f-]{36}$/i.test(diagramId)) {
    throw createError({ statusCode: 400, statusMessage: 'A diagram id is required' });
  }

  const db = getServiceClient();

  const { data: diagram, error } = await db
    .from('part_diagrams')
    .select('id, image_path, image_licence, status, source_id, part_sources!inner(licence_status)')
    .eq('id', diagramId)
    .eq('status', 'published')
    .maybeSingle();

  // A hidden diagram, a declined source and a missing row all answer the same
  // way. Distinguishing them would confirm that a withdrawn drawing exists.
  if (error || !diagram || (diagram as any).part_sources?.licence_status === 'declined') {
    throw createError({ statusCode: 404, statusMessage: 'Diagram not found' });
  }

  if (!diagram.image_path || diagram.image_licence !== 'copied') {
    throw createError({ statusCode: 404, statusMessage: 'No drawing is stored for this diagram' });
  }

  const { data: signed, error: signError } = await db.storage
    .from('parts-diagrams')
    .createSignedUrl(diagram.image_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Could not sign the drawing URL' });
  }

  // Private so a shared cache cannot hold a signed URL past its life, and
  // shorter than the URL itself so a cached redirect never outlives its target.
  setHeader(event, 'cache-control', 'private, max-age=1800');
  return sendRedirect(event, signed.signedUrl, 302);
});
