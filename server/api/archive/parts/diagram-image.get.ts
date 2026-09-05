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

/**
 * Named sizes, each a SEPARATE STORED OBJECT written at ingest time.
 *
 * Deliberately NOT Supabase image transformation, which is what this route did
 * first. Transformation is metered per distinct origin image per billing
 * period, Pro includes 100, and there are 161 plates — and this organisation is
 * not billed for overages, so passing the quota degrades service rather than
 * costing money. Thumbnails would have stopped rendering partway through a
 * month's browsing, silently, which is the worst way for the visuals to fail.
 *
 * Storage has the opposite shape: 0 of 100 GB used, and all the thumbnails
 * together are about 8 MB. So the derivatives are made once by the ingest and
 * simply served.
 *
 * `full` is the untouched original — a factory plate is something a reader
 * zooms into to read callout numbers off, and resampling is what destroys that.
 */
const SIZES = ['thumb', 'preview', 'full'] as const;
type SizeName = (typeof SIZES)[number];

/**
 * The stored object for a size. Derivatives sit beside the original with a
 * `.thumb.jpg` / `.preview.jpg` suffix, always JPEG regardless of the source
 * format, because that is what the ingest writes.
 */
function objectPathFor(imagePath: string, size: SizeName): string {
  if (size === 'full') return imagePath;
  return `${imagePath.replace(/\.[^./]+$/, '')}.${size}.jpg`;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const diagramId = query.diagram;
  const requestedSize = typeof query.size === 'string' ? query.size : 'full';

  if (typeof diagramId !== 'string' || !/^[0-9a-f-]{36}$/i.test(diagramId)) {
    throw createError({ statusCode: 400, statusMessage: 'A diagram id is required' });
  }
  if (!SIZES.includes(requestedSize as SizeName)) {
    throw createError({ statusCode: 400, statusMessage: `size must be one of: ${SIZES.join(', ')}` });
  }
  const size = requestedSize as SizeName;

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
    .createSignedUrl(objectPathFor(diagram.image_path, size), SIGNED_URL_TTL_SECONDS);

  // Fall back to the original when a derivative is missing — a plate imported
  // before the derivatives existed, or one whose resize failed. Heavier than
  // intended is better than a broken image.
  if ((signError || !signed?.signedUrl) && size !== 'full') {
    const { data: original } = await db.storage
      .from('parts-diagrams')
      .createSignedUrl(diagram.image_path, SIGNED_URL_TTL_SECONDS);
    if (original?.signedUrl) {
      setHeader(event, 'cache-control', 'private, max-age=1800');
      return sendRedirect(event, original.signedUrl, 302);
    }
  }

  if (signError || !signed?.signedUrl) {
    throw createError({ statusCode: 500, statusMessage: 'Could not sign the drawing URL' });
  }

  // Private so a shared cache cannot hold a signed URL past its life, and
  // shorter than the URL itself so a cached redirect never outlives its target.
  setHeader(event, 'cache-control', 'private, max-age=1800');
  return sendRedirect(event, signed.signedUrl, 302);
});
