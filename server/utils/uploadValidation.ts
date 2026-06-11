import { randomUUID } from 'node:crypto';

export type DetectedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export function detectMimeFromMagic(data: Buffer | Uint8Array): DetectedMime | null {
  if (!data || data.length < 12) return null;
  const b = data;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';

  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'application/pdf';

  return null;
}

const EXT_FOR_MIME: Record<DetectedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function generateSafeFilename(detectedMime: DetectedMime): string {
  return `${randomUUID()}.${EXT_FOR_MIME[detectedMime]}`;
}

// ===========================================================================
// 3D Model Library file-format sniffers (keystone §5 step 3 / §12)
//
// Best-effort magic-byte verification run server-side in the upload `finalize`
// step against the first 512 bytes (+ total size) of the just-uploaded S3
// object. The point is to catch an extension that lies about its contents
// (e.g. a `.pdf` that is actually a zip) BEFORE the file is marked `uploaded`.
//
// STL deliberately has no magic number — for it we accept either the ASCII
// `solid ` prefix or the binary size identity. Several CAD source formats
// (obj/scad/dxf/iges) are plain text with no reliable signature; those pass the
// sniff and rely on human moderation of new/contributor uploads as the real
// backstop. Never trust this as a security boundary on its own.
// ===========================================================================

function startsWith(buf: Uint8Array, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

/** ZIP local-file-header (`PK\x03\x04`), plus empty/spanned variants. Covers 3mf/f3d/f3z. */
export function isZipMagic(buf: Uint8Array): boolean {
  return (
    startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || // standard archive
    startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) || // empty archive
    startsWith(buf, [0x50, 0x4b, 0x07, 0x08]) // spanned archive
  );
}

/** STEP/STP files begin with the ISO-10303-21 exchange-structure token. */
export function isStepHeader(buf: Uint8Array): boolean {
  // Skip a leading UTF-8 BOM (EF BB BF) at the byte level - decoded as latin1 it
  // would otherwise read as three non-whitespace chars and miss the token.
  const start = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  // subarray returns a view (no copy) of the TypedArray, unlike slice.
  const text = Buffer.from(buf.subarray(start, start + 64)).toString('latin1');
  // Tolerate any leading whitespace before the token.
  return /^\s*ISO-10303-21/.test(text);
}

/** PDF magic (`%PDF`). */
export function isPdfMagic(buf: Uint8Array): boolean {
  return startsWith(buf, [0x25, 0x50, 0x44, 0x46]);
}

/** ASCII STL: `solid` followed by whitespace (or the whole 5-byte head). */
export function isStlAsciiPrefix(buf: Uint8Array): boolean {
  if (!startsWith(buf, [0x73, 0x6f, 0x6c, 0x69, 0x64])) return false; // "solid"
  if (buf.length === 5) return true;
  const next = buf[5];
  return next === 0x20 || next === 0x09 || next === 0x0a || next === 0x0d; // space/tab/CR/LF
}

/**
 * Binary STL size identity: header (80) + uint32 triangle count (4) + 50 bytes
 * per triangle. Requires the count to be at least 1 so an empty 84-byte sham
 * does not pass trivially.
 */
export function isStlBinarySizeMatch(buf: Uint8Array, size: number): boolean {
  if (buf.length < 84) return false;
  const count = Buffer.from(buf).readUInt32LE(80);
  if (count < 1) return false;
  return size === 84 + 50 * count;
}

export interface SniffResult {
  ok: boolean;
  /** Set when ok is false: a short machine-ish reason for logging. */
  reason?: string;
}

/**
 * Verify that the bytes of an uploaded model file are consistent with its
 * declared (lowercase) extension. `head` is the first ~512 bytes; `size` is the
 * full object size from HeadObject.
 */
export function sniffModelFile(opts: { ext: string; head: Uint8Array; size: number }): SniffResult {
  const ext = String(opts.ext || '').toLowerCase();
  const head = opts.head ?? new Uint8Array(0);

  switch (ext) {
    case '3mf':
    case 'f3d':
    case 'f3z':
      return isZipMagic(head) ? { ok: true } : { ok: false, reason: `expected-zip-container:${ext}` };

    case 'step':
    case 'stp':
      return isStepHeader(head) ? { ok: true } : { ok: false, reason: 'expected-iso-10303-21' };

    case 'pdf':
      return isPdfMagic(head) ? { ok: true } : { ok: false, reason: 'expected-pdf-magic' };

    case 'stl':
      return isStlAsciiPrefix(head) || isStlBinarySizeMatch(head, opts.size)
        ? { ok: true }
        : { ok: false, reason: 'not-ascii-or-binary-stl' };

    // Plain-text CAD formats with no reliable signature — accepted on a
    // best-effort basis; moderation is the backstop (keystone §12).
    case 'obj':
    case 'scad':
    case 'dxf':
    case 'iges':
    case 'igs':
      return { ok: true };

    default:
      // Extension already passed the allowlist upstream; nothing to sniff.
      return { ok: true };
  }
}
