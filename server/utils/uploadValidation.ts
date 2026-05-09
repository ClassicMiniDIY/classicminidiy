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
