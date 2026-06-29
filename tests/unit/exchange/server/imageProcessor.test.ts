/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import {
  fetchImageBuffer,
  cropToInstagramRatio,
  checkInstagramCompatibility,
  compressImageForBluesky,
  prepareImageForInstagram,
  cleanupTempImages,
} from '~~/server/utils/exchange/imageProcessor';

// ---------------------------------------------------------------------------
// Test image factories. Real sharp is used everywhere (it's fast on tiny
// images). Buffers are produced from raw pixel data so we control dimensions
// and entropy precisely.
// ---------------------------------------------------------------------------

/** A solid-color image of the given dimensions, encoded as JPEG. */
async function makeImage(width: number, height: number, rgb = { r: 120, g: 80, b: 40 }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: rgb } })
    .jpeg()
    .toBuffer();
}

/** A high-entropy (random noise) image — resists compression, used to exceed
 *  the Bluesky byte cap so the resize fallback path runs. */
async function makeNoisyImage(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

const BLUESKY_MAX_BYTES = 1_000_000;
const INSTAGRAM_MIN_RATIO = 0.8;
const INSTAGRAM_MAX_RATIO = 1.91;

/** Builds a fetch-like Response shape with the bits the source reads. */
function makeResponse(opts: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentLength?: string | null;
  body?: ArrayBuffer;
}): any {
  const headers = new Map<string, string>();
  if (opts.contentLength !== null && opts.contentLength !== undefined) {
    headers.set('content-length', opts.contentLength);
  }
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    arrayBuffer: async () => opts.body ?? new ArrayBuffer(0),
  };
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

beforeEach(() => {
  // Silence the source's diagnostic logging so test output stays readable.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ===========================================================================
// fetchImageBuffer
// ===========================================================================
describe('fetchImageBuffer', () => {
  it('returns a Buffer of the image bytes on a 200 OK response', async () => {
    const img = await makeImage(10, 10);
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, body: toArrayBuffer(img), contentLength: String(img.length) })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchImageBuffer('https://example.com/a.jpg');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(img.length);
    expect(result.equals(img)).toBe(true);
  });

  it('sends the default facebookexternalhit User-Agent when no headers given', async () => {
    const img = await makeImage(8, 8);
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ body: toArrayBuffer(img) }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchImageBuffer('https://example.com/a.jpg');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['User-Agent']).toContain('facebookexternalhit');
    // An AbortSignal must be passed for the timeout to work.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('forwards custom headers verbatim (overriding the default UA)', async () => {
    const img = await makeImage(8, 8);
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ body: toArrayBuffer(img) }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchImageBuffer('https://example.com/a.jpg', { Authorization: 'Bearer x' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ Authorization: 'Bearer x' });
    expect(init.headers['User-Agent']).toBeUndefined();
  });

  it('throws with status + statusText on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ ok: false, status: 404, statusText: 'Not Found' })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchImageBuffer('https://example.com/missing.jpg')).rejects.toThrow(
      'Failed to fetch image: 404 Not Found'
    );
  });

  it('throws when the content-length header exceeds the 10MB cap (before download)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, contentLength: String(11 * 1024 * 1024) })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchImageBuffer('https://example.com/huge.jpg')).rejects.toThrow(/Image too large/);
    // arrayBuffer should not be needed since we bail on the header; but the
    // contract only requires the throw — assert the message carries the size.
    await expect(fetchImageBuffer('https://example.com/huge.jpg')).rejects.toThrow(
      String(11 * 1024 * 1024)
    );
  });

  it('throws when the downloaded body exceeds the cap despite a small/absent content-length', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1);
    const fetchMock = vi.fn().mockResolvedValue(
      // content-length absent (null) so the early check passes, then byteLength gate trips
      makeResponse({ ok: true, contentLength: null, body: toArrayBuffer(big) })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchImageBuffer('https://example.com/sneaky.jpg')).rejects.toThrow(/Image too large/);
  });

  it('propagates a network/abort rejection from fetch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchImageBuffer('https://example.com/a.jpg')).rejects.toThrow('network down');
  });
});

// ===========================================================================
// cropToInstagramRatio
// ===========================================================================
describe('cropToInstagramRatio', () => {
  it('leaves a square (1:1) image uncropped and returns a JPEG result', async () => {
    const img = await makeImage(500, 500);
    const result = await cropToInstagramRatio(img);

    expect(result.wasCropped).toBe(false);
    expect(result.width).toBe(500);
    expect(result.height).toBe(500);
    expect(result.aspectRatio).toBeCloseTo(1, 5);
    expect(result.format).toBe('jpeg');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    // The returned buffer is a valid JPEG sharp can re-read.
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(500);
  });

  it('leaves an in-range portrait (ratio === 0.8 exactly) uncropped', async () => {
    // 400x500 -> ratio 0.8, the inclusive minimum.
    const img = await makeImage(400, 500);
    const result = await cropToInstagramRatio(img);
    expect(result.wasCropped).toBe(false);
    expect(result.width).toBe(400);
    expect(result.height).toBe(500);
  });

  it('leaves an in-range landscape (ratio just under 1.91) uncropped', async () => {
    const img = await makeImage(900, 500); // 1.8 ratio
    const result = await cropToInstagramRatio(img);
    expect(result.wasCropped).toBe(false);
    expect(result.width).toBe(900);
    expect(result.height).toBe(500);
  });

  it('crops a too-tall portrait (ratio < 0.8) down to the 4:5 minimum, keeping width', async () => {
    // 400x800 => ratio 0.5 (too tall). Expected new height = floor(400/0.8) = 500.
    const img = await makeImage(400, 800);
    const result = await cropToInstagramRatio(img);

    expect(result.wasCropped).toBe(true);
    expect(result.width).toBe(400);
    expect(result.height).toBe(500);
    expect(result.aspectRatio).toBeCloseTo(INSTAGRAM_MIN_RATIO, 3);
    expect(result.aspectRatio).toBeGreaterThanOrEqual(INSTAGRAM_MIN_RATIO - 0.001);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(500);
  });

  it('crops a too-wide panorama (ratio > 1.91) down to 1.91:1, keeping height', async () => {
    // 1000x300 => ratio 3.33 (too wide). Expected new width = floor(300*1.91) = 573.
    const img = await makeImage(1000, 300);
    const result = await cropToInstagramRatio(img);

    expect(result.wasCropped).toBe(true);
    expect(result.height).toBe(300);
    expect(result.width).toBe(Math.floor(300 * INSTAGRAM_MAX_RATIO)); // 573
    expect(result.aspectRatio).toBeLessThanOrEqual(INSTAGRAM_MAX_RATIO);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(573);
    expect(meta.height).toBe(300);
  });

  it('throws when image dimensions cannot be read (not an image)', async () => {
    const garbage = Buffer.from('this is not an image at all');
    await expect(cropToInstagramRatio(garbage)).rejects.toThrow();
  });

  it('returns a buffer that is itself Instagram-valid after cropping a too-tall image', async () => {
    const img = await makeImage(300, 900); // ratio 0.33
    const result = await cropToInstagramRatio(img);
    expect(result.aspectRatio).toBeGreaterThanOrEqual(INSTAGRAM_MIN_RATIO - 0.001);
    expect(result.aspectRatio).toBeLessThanOrEqual(INSTAGRAM_MAX_RATIO + 0.001);
  });
});

// ===========================================================================
// checkInstagramCompatibility
// ===========================================================================
describe('checkInstagramCompatibility', () => {
  function stubFetchWith(buf: Buffer) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ ok: true, body: toArrayBuffer(buf) })));
  }

  it('reports compatible for a square image', async () => {
    stubFetchWith(await makeImage(400, 400));
    const res = await checkInstagramCompatibility('https://example.com/sq.jpg');
    expect(res.compatible).toBe(true);
    expect(res.aspectRatio).toBeCloseTo(1, 5);
    expect(res.recommendation).toBeUndefined();
  });

  it('reports compatible at the exact 4:5 minimum boundary', async () => {
    stubFetchWith(await makeImage(400, 500)); // ratio 0.8
    const res = await checkInstagramCompatibility('https://example.com/p.jpg');
    expect(res.compatible).toBe(true);
  });

  it('flags a too-tall image as incompatible with a crop recommendation', async () => {
    stubFetchWith(await makeImage(400, 800)); // 0.5
    const res = await checkInstagramCompatibility('https://example.com/tall.jpg');
    expect(res.compatible).toBe(false);
    expect(res.aspectRatio).toBeCloseTo(0.5, 3);
    expect(res.recommendation).toContain('too tall');
    expect(res.recommendation).toContain('4:5');
  });

  it('flags a too-wide image as incompatible with a crop recommendation', async () => {
    stubFetchWith(await makeImage(1000, 300)); // 3.33
    const res = await checkInstagramCompatibility('https://example.com/wide.jpg');
    expect(res.compatible).toBe(false);
    expect(res.aspectRatio).toBeGreaterThan(INSTAGRAM_MAX_RATIO);
    expect(res.recommendation).toContain('too wide');
    expect(res.recommendation).toContain('1.91:1');
  });

  it('returns incompatible with aspectRatio 0 when the fetch fails (graceful)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const res = await checkInstagramCompatibility('https://example.com/x.jpg');
    expect(res.compatible).toBe(false);
    expect(res.aspectRatio).toBe(0);
    expect(res.recommendation).toContain('Error checking image');
  });

  it('returns incompatible with aspectRatio 0 when the body is not a decodable image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ ok: true, body: toArrayBuffer(Buffer.from('nope')) }))
    );
    const res = await checkInstagramCompatibility('https://example.com/x.jpg');
    expect(res.compatible).toBe(false);
    expect(res.aspectRatio).toBe(0);
  });
});

// ===========================================================================
// compressImageForBluesky
// ===========================================================================
describe('compressImageForBluesky', () => {
  it('returns a JPEG under the cap unchanged-ish for an already-small image', async () => {
    const img = await makeImage(300, 300);
    const out = await compressImageForBluesky(img);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(BLUESKY_MAX_BYTES);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    // Small image keeps its dimensions (no resize path taken).
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(300);
  });

  it('reduces a large high-entropy image to under the Bluesky byte cap', async () => {
    const noisy = await makeNoisyImage(2400, 2400);
    // Sanity: the raw input genuinely exceeds the cap, so a real reduction must occur.
    const asJpeg90 = await sharp(noisy).jpeg({ quality: 90 }).toBuffer();
    expect(asJpeg90.length).toBeGreaterThan(BLUESKY_MAX_BYTES);

    const out = await compressImageForBluesky(noisy);
    expect(out.length).toBeLessThanOrEqual(BLUESKY_MAX_BYTES);
    expect(out.length).toBeLessThan(asJpeg90.length);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    // The resize fallback shrinks dimensions below the original.
    expect(meta.width!).toBeLessThan(2400);
  });

  it('throws when image dimensions cannot be read', async () => {
    await expect(compressImageForBluesky(Buffer.from('not-an-image'))).rejects.toThrow(
      /Unable to read image dimensions|unsupported image format|Input buffer/i
    );
  });

  it('always returns a valid re-decodable JPEG buffer', async () => {
    const out = await compressImageForBluesky(await makeImage(1200, 800));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(out.length).toBeLessThanOrEqual(BLUESKY_MAX_BYTES);
  });
});

// ===========================================================================
// prepareImageForInstagram  (fetch + crop + supabase upload integration)
// ===========================================================================
describe('prepareImageForInstagram', () => {
  function makeSupabase(uploadResult: { error: any }) {
    const upload = vi.fn().mockResolvedValue(uploadResult);
    const from = vi.fn(() => ({ upload }));
    return { client: { storage: { from } }, upload, from };
  }

  it('returns the original URL untouched when the image already fits Instagram', async () => {
    const square = await makeImage(600, 600);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ ok: true, body: toArrayBuffer(square) })));
    const sb = makeSupabase({ error: null });

    const res = await prepareImageForInstagram('https://cdn/x.jpg', 'list-1', 0, sb.client);

    expect(res).toEqual({ url: 'https://cdn/x.jpg', wasCropped: false });
    expect(sb.upload).not.toHaveBeenCalled(); // no upload when not cropped
  });

  it('uploads the cropped image and returns the public temp URL when cropping was needed', async () => {
    const tall = await makeImage(400, 1000); // ratio 0.4 -> cropped
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ ok: true, body: toArrayBuffer(tall) })));
    const sb = makeSupabase({ error: null });

    const res = await prepareImageForInstagram('https://cdn/tall.jpg', 'list-7', 2, sb.client);

    expect(res.wasCropped).toBe(true);
    // URL is built from public.supabaseUrl (vitest.setup default https://test.supabase.co).
    expect(res.url).toBe(
      'https://test.supabase.co/storage/v1/object/public/listing-photos/temp-social/list-7/2-instagram.jpg'
    );
    expect(sb.from).toHaveBeenCalledWith('listing-photos');
    expect(sb.upload).toHaveBeenCalledTimes(1);
    const [path, buffer, opts] = sb.upload.mock.calls[0];
    expect(path).toBe('temp-social/list-7/2-instagram.jpg');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: true });
  });

  it('falls back to the original URL (wasCropped=false) when the upload errors', async () => {
    const wide = await makeImage(1200, 300); // too wide -> needs crop -> tries upload
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ ok: true, body: toArrayBuffer(wide) })));
    const sb = makeSupabase({ error: { message: 'storage exploded' } });

    const res = await prepareImageForInstagram('https://cdn/wide.jpg', 'list-9', 1, sb.client);

    expect(res).toEqual({ url: 'https://cdn/wide.jpg', wasCropped: false });
    expect(sb.upload).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original URL when the source image fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    const sb = makeSupabase({ error: null });

    const res = await prepareImageForInstagram('https://cdn/dead.jpg', 'list-3', 0, sb.client);

    expect(res).toEqual({ url: 'https://cdn/dead.jpg', wasCropped: false });
    expect(sb.upload).not.toHaveBeenCalled();
  });

  it('falls back to the original URL when the fetched bytes are undecodable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ ok: true, body: toArrayBuffer(Buffer.from('garbage')) }))
    );
    const sb = makeSupabase({ error: null });

    const res = await prepareImageForInstagram('https://cdn/bad.jpg', 'list-3', 0, sb.client);
    expect(res).toEqual({ url: 'https://cdn/bad.jpg', wasCropped: false });
  });
});

// ===========================================================================
// cleanupTempImages  (supabase storage list + remove)
// ===========================================================================
describe('cleanupTempImages', () => {
  function makeStorage(listResult: { data: any }, removeResult: { data: any; error: any } = { data: null, error: null }) {
    const list = vi.fn().mockResolvedValue(listResult);
    const remove = vi.fn().mockResolvedValue(removeResult);
    const from = vi.fn(() => ({ list, remove }));
    return { client: { storage: { from } }, list, remove, from };
  }

  it('removes every listed temp file under the listing prefix', async () => {
    const sb = makeStorage({ data: [{ name: '0-instagram.jpg' }, { name: '1-instagram.jpg' }] });

    await cleanupTempImages('list-42', sb.client);

    expect(sb.from).toHaveBeenCalledWith('listing-photos');
    expect(sb.list).toHaveBeenCalledWith('temp-social/list-42');
    expect(sb.remove).toHaveBeenCalledTimes(1);
    expect(sb.remove).toHaveBeenCalledWith([
      'temp-social/list-42/0-instagram.jpg',
      'temp-social/list-42/1-instagram.jpg',
    ]);
  });

  it('does not call remove when there are no temp files', async () => {
    const sb = makeStorage({ data: [] });
    await cleanupTempImages('list-empty', sb.client);
    expect(sb.list).toHaveBeenCalledWith('temp-social/list-empty');
    expect(sb.remove).not.toHaveBeenCalled();
  });

  it('does not call remove when list returns null data', async () => {
    const sb = makeStorage({ data: null });
    await cleanupTempImages('list-null', sb.client);
    expect(sb.remove).not.toHaveBeenCalled();
  });

  it('swallows errors thrown during listing (non-critical cleanup)', async () => {
    const list = vi.fn().mockRejectedValue(new Error('list blew up'));
    const remove = vi.fn();
    const client = { storage: { from: vi.fn(() => ({ list, remove })) } };

    await expect(cleanupTempImages('list-x', client)).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });

  it('swallows errors thrown during remove (non-critical cleanup)', async () => {
    const list = vi.fn().mockResolvedValue({ data: [{ name: 'a.jpg' }] });
    const remove = vi.fn().mockRejectedValue(new Error('remove blew up'));
    const client = { storage: { from: vi.fn(() => ({ list, remove })) } };

    await expect(cleanupTempImages('list-y', client)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
