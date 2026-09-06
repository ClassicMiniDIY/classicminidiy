/**
 * Where a plate drawing's derivatives live, and how long a signed URL lasts.
 *
 * ONE COPY. Two routes need this: the per-image redirect and the browse
 * listing that bulk-signs thumbnails. When each had its own, a change to the
 * suffix in the ingest would break one and not the other — and the listing
 * falls back to the redirect route on a miss, so the break would show up as
 * "the page got slow again" rather than as an error.
 */

/** The sizes the ingest writes. `full` is the untouched original. */
export const DIAGRAM_SIZES = ['thumb', 'preview', 'full'] as const;
export type DiagramSize = (typeof DIAGRAM_SIZES)[number];

/**
 * One hour: longer than reading a plate, short enough that a leaked link lapses.
 * Both routes use it, so the takedown window is the same whichever minted the URL.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * The stored object for a size. Derivatives sit beside the original with a
 * `.thumb.jpg` / `.preview.jpg` suffix, always JPEG regardless of the source
 * format, because that is what the ingest writes.
 */
export function diagramObjectPath(imagePath: string, size: DiagramSize): string {
  if (size === 'full') return imagePath;
  return `${imagePath.replace(/\.[^./]+$/, '')}.${size}.jpg`;
}
