/**
 * Bounding box for a stored hotspot, in image-pixel space.
 *
 * The archive stores three SVG shapes — polygon, circle and rect — because a
 * real plate mixes all three. Reducing them to one rectangle is what lets a part
 * page crop its plate down to the part, which is the difference between a page
 * showing a part number and a page showing the reader the thing itself.
 *
 * Returns null rather than a guess when the geometry is unusable: a crop
 * computed from a bad box lands on empty paper, which looks like a bug in the
 * data rather than an absent hotspot.
 */
export interface HotspotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function finite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

export function hotspotBounds(hotspot: Record<string, unknown> | null | undefined): HotspotBounds | null {
  if (!hotspot) return null;

  // Polygon: "x1 y1 x2 y2 ..." — the form the source writes, space separated
  // rather than the comma-paired form the SVG spec also allows.
  const points = typeof hotspot.points === 'string' ? hotspot.points.trim() : '';
  if (points) {
    const numbers = points
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (numbers.length >= 6 && numbers.length % 2 === 0) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < numbers.length; i += 2) {
        xs.push(numbers[i]!);
        ys.push(numbers[i + 1]!);
      }
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const box = { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
      return box.width > 0 && box.height > 0 ? box : null;
    }
    return null;
  }

  const cx = finite(hotspot.cx);
  const cy = finite(hotspot.cy);
  const r = finite(hotspot.r);
  if (cx !== null && cy !== null && r !== null && r > 0) {
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
  }

  const x = finite(hotspot.x);
  const y = finite(hotspot.y);
  const width = finite(hotspot.width);
  const height = finite(hotspot.height);
  if (x !== null && y !== null && width !== null && height !== null && width > 0 && height > 0) {
    return { x, y, width, height };
  }

  return null;
}

/**
 * The window to show around a hotspot.
 *
 * Padded generously and floored at a minimum size, because most hotspots are
 * small circles: cropping tightly to a 26-pixel circle shows a reader a blob of
 * ink with no idea what they are looking at. The point is the part IN ITS
 * SURROUNDINGS, so the neighbouring detail is the useful part of the picture.
 *
 * Clamped to the drawing, so a hotspot near an edge yields a window that is
 * still fully on paper rather than half grey.
 */
export function cropWindow(
  bounds: HotspotBounds,
  imageWidth: number,
  imageHeight: number,
  minimumSize = 420
): HotspotBounds {
  const padded = Math.max(bounds.width, bounds.height) * 3;
  const size = Math.min(Math.max(padded, minimumSize), Math.min(imageWidth, imageHeight));

  const centreX = bounds.x + bounds.width / 2;
  const centreY = bounds.y + bounds.height / 2;

  const x = Math.min(Math.max(centreX - size / 2, 0), Math.max(imageWidth - size, 0));
  const y = Math.min(Math.max(centreY - size / 2, 0), Math.max(imageHeight - size, 0));

  return { x, y, width: size, height: size };
}
