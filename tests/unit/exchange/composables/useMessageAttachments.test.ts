import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

// Storage handles re-created each test so call assertions stay isolated. The
// composable only ever talks to the private `message-images` bucket via
// upload / remove / createSignedUrl.
let mockUpload: ReturnType<typeof vi.fn>;
let mockRemove: ReturnType<typeof vi.fn>;
let mockCreateSignedUrl: ReturnType<typeof vi.fn>;

const installStorage = () => {
  mockUpload = vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null });
  mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
  mockCreateSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://signed.example.com/url?token=abc' }, error: null });
  mockSupabase.storage.from = vi.fn(() => ({
    upload: mockUpload,
    remove: mockRemove,
    createSignedUrl: mockCreateSignedUrl,
  })) as any;
};

// The insert path is `from(...).insert(rows).select('*')` which is awaited as a
// thenable builder — resolve it through queryBuilder.then.
const resolveInsertWith = (result: any) => {
  mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve(result));
};

// Auto-import after globals are stubbed (matches sibling exchange tests).
const getMod = async () => import('~/app/composables/useMessageAttachments');
const getComposable = async () => (await getMod()).useMessageAttachments;

// `readImageDimensions` constructs `new Image()`, sets `.src` to an object URL,
// and resolves on `onload`. happy-dom never fires those events, so we install a
// deterministic Image stub. Tests that need an error drive `__imageShouldError`.
let imageShouldError = false;
const installImageStub = (width = 800, height = 600) => {
  imageShouldError = false;
  (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock-object-url');
  (globalThis as any).URL.revokeObjectURL = vi.fn();
  (globalThis as any).Image = class {
    width = width;
    height = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      // Fire asynchronously so the Promise executor has returned first.
      queueMicrotask(() => {
        if (imageShouldError) this.onerror?.();
        else this.onload?.();
      });
    }
  } as any;
};

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  // setupGlobalMocks stubs useAuth (authenticated) + useSupabase; pass our
  // pre-built client so per-test overrides land on the same instance.
  setupGlobalMocks({ user: createMockUser(), supabase: mockSupabase });
  installStorage();
  installImageStub();
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.restoreAllMocks();
  vi.doUnmock('heic2any');
  vi.doUnmock('browser-image-compression');
});

describe('useMessageAttachments', () => {
  // -------------------------------------------------------------------------
  // Exported constants
  // -------------------------------------------------------------------------
  describe('exported constants', () => {
    it('exposes the 1 MB byte cap, 4-image count cap, and allowed MIME list', async () => {
      const mod = await getMod();
      expect(mod.MESSAGE_ATTACHMENT_MAX_BYTES).toBe(1_048_576);
      expect(mod.MESSAGE_ATTACHMENT_MAX_COUNT).toBe(4);
      expect(mod.MESSAGE_ATTACHMENT_ALLOWED_MIME).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
    });

    it('re-exposes the two caps off the composable return value', async () => {
      const useMessageAttachments = await getComposable();
      const api = useMessageAttachments();
      expect(api.MESSAGE_ATTACHMENT_MAX_BYTES).toBe(1_048_576);
      expect(api.MESSAGE_ATTACHMENT_MAX_COUNT).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Return value shape — every documented method present
  // -------------------------------------------------------------------------
  describe('return value structure', () => {
    it('exposes prepareAttachment, validateBatch, attachToMessage, getSignedUrl', async () => {
      const useMessageAttachments = await getComposable();
      const api = useMessageAttachments();
      for (const key of ['prepareAttachment', 'validateBatch', 'attachToMessage', 'getSignedUrl']) {
        expect(typeof (api as any)[key]).toBe('function');
      }
    });
  });

  // -------------------------------------------------------------------------
  // validateBatch()
  // -------------------------------------------------------------------------
  describe('validateBatch()', () => {
    it('returns an empty array for a valid single-image batch', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const errors = validateBatch([new File(['x'], 'a.jpg', { type: 'image/jpeg' })]);
      expect(errors).toEqual([]);
    });

    it('returns an empty array for an empty batch', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      expect(validateBatch([])).toEqual([]);
    });

    it('accepts exactly the max count (4) without a count error', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const files = Array.from({ length: 4 }, (_, i) => new File(['x'], `a${i}.jpg`, { type: 'image/jpeg' }));
      expect(validateBatch(files)).toEqual([]);
    });

    it('rejects more than the max count (5) with a per-message count error', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const files = Array.from({ length: 5 }, (_, i) => new File(['x'], `a${i}.jpg`, { type: 'image/jpeg' }));
      const errors = validateBatch(files);
      expect(errors).toContain('You can attach at most 4 images per message.');
    });

    it('rejects a non-image file by name', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const errors = validateBatch([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
      expect(errors).toContain('"notes.txt" is not an image.');
    });

    it('rejects a file larger than 10 MB (pre-compression hard cap)', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const big = new File([new ArrayBuffer(11 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
      const errors = validateBatch([big]);
      expect(errors).toContain('"huge.jpg" is too large (max 10 MB before compression).');
    });

    it('accepts a file at exactly 10 MB (boundary is strictly greater-than)', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const exactly = new File([new ArrayBuffer(10 * 1024 * 1024)], 'ten.jpg', { type: 'image/jpeg' });
      expect(validateBatch([exactly])).toEqual([]);
    });

    it('accumulates multiple errors across the batch (count + type + size)', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const files = [
        new File(['x'], '1.jpg', { type: 'image/jpeg' }),
        new File(['x'], '2.jpg', { type: 'image/jpeg' }),
        new File(['x'], '3.jpg', { type: 'image/jpeg' }),
        new File(['x'], '4.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'bad.pdf', { type: 'application/pdf' }),
        new File([new ArrayBuffer(11 * 1024 * 1024)], 'huge.png', { type: 'image/png' }),
      ];
      const errors = validateBatch(files);
      // 5 files → count error; one non-image; one oversized.
      expect(errors).toContain('You can attach at most 4 images per message.');
      expect(errors).toContain('"bad.pdf" is not an image.');
      expect(errors).toContain('"huge.png" is too large (max 10 MB before compression).');
      expect(errors.length).toBe(3);
    });

    it('flags a single file that is both non-image AND oversized with two errors', async () => {
      const useMessageAttachments = await getComposable();
      const { validateBatch } = useMessageAttachments();
      const f = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.zip', { type: 'application/zip' });
      const errors = validateBatch([f]);
      expect(errors).toEqual(['"big.zip" is not an image.', '"big.zip" is too large (max 10 MB before compression).']);
    });
  });

  // -------------------------------------------------------------------------
  // prepareAttachment()
  // -------------------------------------------------------------------------
  describe('prepareAttachment()', () => {
    it('returns the file with read dimensions for an already-small allowed image', async () => {
      installImageStub(1024, 768);
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const file = new File(['small'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await prepareAttachment(file);

      expect(result.file).toBe(file);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });

    it('does not invoke the compressor when the file is already under the byte cap', async () => {
      const compress = vi.fn();
      vi.doMock('browser-image-compression', () => ({ default: compress }));
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      await prepareAttachment(new File(['x'], 'photo.png', { type: 'image/png' }));
      expect(compress).not.toHaveBeenCalled();
    });

    it('throws on an unsupported MIME type (gif)', async () => {
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const gif = new File(['x'], 'anim.gif', { type: 'image/gif' });
      await expect(prepareAttachment(gif)).rejects.toThrow('Unsupported image type: image/gif');
    });

    it('reports "unknown" in the error when the MIME type is empty', async () => {
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const noType = new File(['x'], 'mystery', { type: '' });
      await expect(prepareAttachment(noType)).rejects.toThrow('Unsupported image type: unknown');
    });

    it('compresses files over the 1 MB cap and uses the compressed blob', async () => {
      const smallBlob = new Blob(['compressed'], { type: 'image/jpeg' });
      const compress = vi.fn().mockResolvedValue(smallBlob);
      vi.doMock('browser-image-compression', () => ({ default: compress }));

      installImageStub(1600, 1200);
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const big = new File([new ArrayBuffer(2 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
      const result = await prepareAttachment(big);

      expect(compress).toHaveBeenCalledWith(
        big,
        expect.objectContaining({ maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, initialQuality: 0.85 })
      );
      // Returned file is the freshly-wrapped compressed blob, not the original.
      expect(result.file).not.toBe(big);
      expect(result.file.size).toBeLessThan(MESSAGE_BYTE_CAP);
      expect(result.file.name).toBe('big.jpg');
    });

    it('throws when the image is still over the cap after compression', async () => {
      // Compressor returns a blob still > 1 MB.
      const stillBig = new Blob([new ArrayBuffer(2 * 1024 * 1024)], { type: 'image/jpeg' });
      const compress = vi.fn().mockResolvedValue(stillBig);
      vi.doMock('browser-image-compression', () => ({ default: compress }));

      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const big = new File([new ArrayBuffer(2 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
      await expect(prepareAttachment(big)).rejects.toThrow(
        'Image is still too large after compression. Try a smaller image.'
      );
    });

    it('converts a HEIC file to JPEG before the type check, then succeeds', async () => {
      const jpegBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
      const heic2any = vi.fn().mockResolvedValue(jpegBlob);
      vi.doMock('heic2any', () => ({ default: heic2any }));

      installImageStub(640, 480);
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const heic = new File(['heic-bytes'], 'IMG_1234.HEIC', { type: 'image/heic' });
      const result = await prepareAttachment(heic);

      expect(heic2any).toHaveBeenCalledWith(
        expect.objectContaining({ blob: heic, toType: 'image/jpeg', quality: 0.85 })
      );
      expect(result.file.type).toBe('image/jpeg');
      expect(result.file.name).toBe('IMG_1234.jpg');
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
    });

    it('detects HEIC by extension even when the MIME type is empty', async () => {
      const jpegBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
      const heic2any = vi.fn().mockResolvedValue(jpegBlob);
      vi.doMock('heic2any', () => ({ default: heic2any }));

      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const heic = new File(['bytes'], 'photo.heif', { type: '' });
      await prepareAttachment(heic);
      expect(heic2any).toHaveBeenCalled();
    });

    it('uses the first element when heic2any returns an array of blobs', async () => {
      const first = new Blob(['first'], { type: 'image/jpeg' });
      const second = new Blob(['second'], { type: 'image/jpeg' });
      const heic2any = vi.fn().mockResolvedValue([first, second]);
      vi.doMock('heic2any', () => ({ default: heic2any }));

      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      const heic = new File(['bytes'], 'p.heic', { type: 'image/heic' });
      const result = await prepareAttachment(heic);
      // The converted file wraps the first blob (size matches 'first').
      expect(result.file.size).toBe(first.size);
      expect(result.file.type).toBe('image/jpeg');
    });

    it('rejects when dimension reading fails (image onerror)', async () => {
      installImageStub();
      imageShouldError = true;
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      await expect(prepareAttachment(new File(['x'], 'p.png', { type: 'image/png' }))).rejects.toThrow(
        'Could not read image dimensions'
      );
    });

    it('revokes the object URL after reading dimensions (no leak)', async () => {
      installImageStub();
      const revoke = vi.fn();
      (globalThis as any).URL.revokeObjectURL = revoke;
      const useMessageAttachments = await getComposable();
      const { prepareAttachment } = useMessageAttachments();

      await prepareAttachment(new File(['x'], 'p.png', { type: 'image/png' }));
      expect(revoke).toHaveBeenCalledWith('blob:mock-object-url');
    });
  });

  // -------------------------------------------------------------------------
  // attachToMessage()
  // -------------------------------------------------------------------------
  describe('attachToMessage()', () => {
    const prepared = (overrides: Partial<{ file: File; width: number; height: number }> = {}) => ({
      file: new File(['data'], 'photo.jpg', { type: 'image/jpeg' }),
      width: 800,
      height: 600,
      ...overrides,
    });

    const insertedRow = {
      id: 'att-1',
      message_id: 'msg-1',
      storage_path: 'conv-1/uuid.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 4,
      width: 800,
      height: 600,
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
    };

    it('throws when the user is not authenticated', async () => {
      setupGlobalMocks({ user: null, supabase: mockSupabase });
      installStorage();

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await expect(attachToMessage('conv-1', 'msg-1', [prepared()])).rejects.toThrow('Not authenticated');
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('returns an empty array (no uploads, no insert) for an empty prepared list', async () => {
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      const result = await attachToMessage('conv-1', 'msg-1', []);
      expect(result).toEqual([]);
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    });

    it('uploads to the message-images bucket and inserts a single attachment row', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      const result = await attachToMessage('conv-1', 'msg-1', [prepared()]);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('message-images');
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('message_attachments');
      expect(mockSupabase._mockInsert).toHaveBeenCalledTimes(1);
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual([insertedRow]);
    });

    it('builds a storage path of {conversationId}/{uuid}.{ext}', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await attachToMessage('conv-XYZ', 'msg-1', [prepared()]);

      const path = mockUpload.mock.calls[0][0] as string;
      expect(path).toMatch(/^conv-XYZ\/[0-9a-f-]+\.jpg$/i);
    });

    it('maps image/jpeg to a .jpg extension (jpeg→jpg)', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await attachToMessage('conv-1', 'msg-1', [prepared({ file: new File(['x'], 'p.jpg', { type: 'image/jpeg' }) })]);
      expect(mockUpload.mock.calls[0][0]).toMatch(/\.jpg$/);
    });

    it('keeps the png subtype as the .png extension', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await attachToMessage('conv-1', 'msg-1', [prepared({ file: new File(['x'], 'p.png', { type: 'image/png' }) })]);
      expect(mockUpload.mock.calls[0][0]).toMatch(/\.png$/);
    });

    it('falls back to a jpg extension when the file type has no subtype', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      // Empty MIME → split('/')[1] is undefined → 'jpg'.
      await attachToMessage('conv-1', 'msg-1', [prepared({ file: new File(['x'], 'mystery', { type: '' }) })]);
      expect(mockUpload.mock.calls[0][0]).toMatch(/\.jpg$/);
    });

    it('uploads with the file content type, cacheControl 3600, and upsert false', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      const file = new File(['x'], 'p.webp', { type: 'image/webp' });
      await attachToMessage('conv-1', 'msg-1', [prepared({ file })]);

      expect(mockUpload.mock.calls[0][1]).toBe(file);
      const opts = mockUpload.mock.calls[0][2];
      expect(opts).toEqual({ contentType: 'image/webp', cacheControl: '3600', upsert: false });
    });

    it('persists message_id, storage_path, mime_type, size_bytes, width, height in the inserted rows', async () => {
      resolveInsertWith({ data: [insertedRow], error: null });
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      const file = new File(['12345'], 'p.png', { type: 'image/png' });
      await attachToMessage('conv-1', 'msg-99', [prepared({ file, width: 400, height: 300 })]);

      const rows = mockSupabase._mockInsert.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        message_id: 'msg-99',
        mime_type: 'image/png',
        size_bytes: file.size,
        width: 400,
        height: 300,
      });
      expect(rows[0].storage_path).toMatch(/^conv-1\//);
    });

    it('uploads multiple files and inserts a row per file in order', async () => {
      const rows = [
        { ...insertedRow, id: 'a1' },
        { ...insertedRow, id: 'a2' },
        { ...insertedRow, id: 'a3' },
      ];
      resolveInsertWith({ data: rows, error: null });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      const result = await attachToMessage('conv-1', 'msg-1', [
        prepared({ file: new File(['a'], '1.jpg', { type: 'image/jpeg' }) }),
        prepared({ file: new File(['b'], '2.png', { type: 'image/png' }) }),
        prepared({ file: new File(['c'], '3.webp', { type: 'image/webp' }) }),
      ]);

      expect(mockUpload).toHaveBeenCalledTimes(3);
      // A single batch insert of all three rows.
      expect(mockSupabase._mockInsert).toHaveBeenCalledTimes(1);
      expect(mockSupabase._mockInsert.mock.calls[0][0]).toHaveLength(3);
      expect(result).toEqual(rows);
    });

    it('throws and aborts before insert when a storage upload errors', async () => {
      mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'quota exceeded' } });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await expect(attachToMessage('conv-1', 'msg-1', [prepared()])).rejects.toThrow(
        'Failed to upload image: quota exceeded'
      );
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    });

    it('cleans up already-uploaded objects when a later upload in the batch fails', async () => {
      // First upload OK, second fails.
      mockUpload
        .mockResolvedValueOnce({ data: { path: 'p1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'network' } });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await expect(
        attachToMessage('conv-1', 'msg-1', [
          prepared({ file: new File(['a'], '1.jpg', { type: 'image/jpeg' }) }),
          prepared({ file: new File(['b'], '2.jpg', { type: 'image/jpeg' }) }),
        ])
      ).rejects.toThrow('Failed to upload image: network');

      // The single successfully-uploaded path is swept.
      expect(mockRemove).toHaveBeenCalledTimes(1);
      const removedPaths = mockRemove.mock.calls[0][0];
      expect(removedPaths).toHaveLength(1);
      expect(removedPaths[0]).toMatch(/^conv-1\//);
    });

    it('does NOT attempt cleanup when the very first upload fails (nothing uploaded yet)', async () => {
      mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await expect(attachToMessage('conv-1', 'msg-1', [prepared()])).rejects.toThrow('Failed to upload image: denied');
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('throws and rolls back uploaded storage objects when the DB insert fails', async () => {
      resolveInsertWith({ data: null, error: { message: 'fk violation' } });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await expect(
        attachToMessage('conv-1', 'msg-1', [
          prepared({ file: new File(['a'], '1.jpg', { type: 'image/jpeg' }) }),
          prepared({ file: new File(['b'], '2.jpg', { type: 'image/jpeg' }) }),
        ])
      ).rejects.toThrow('Failed to save attachment records: fk violation');

      // Both uploaded paths are removed in a single sweep.
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove.mock.calls[0][0]).toHaveLength(2);
    });

    it('swallows a failing cleanup remove() and still surfaces the original error', async () => {
      resolveInsertWith({ data: null, error: { message: 'fk violation' } });
      mockRemove.mockRejectedValueOnce(new Error('remove blew up'));

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      // The original DB error is what propagates, not the cleanup error.
      await expect(attachToMessage('conv-1', 'msg-1', [prepared()])).rejects.toThrow(
        'Failed to save attachment records: fk violation'
      );
    });

    it('returns an empty array when the insert succeeds with null data', async () => {
      resolveInsertWith({ data: null, error: null });

      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      const result = await attachToMessage('conv-1', 'msg-1', [prepared()]);
      expect(result).toEqual([]);
    });

    it('generates distinct storage paths for each file in a batch (unique uuids)', async () => {
      resolveInsertWith({ data: [insertedRow, insertedRow], error: null });
      const useMessageAttachments = await getComposable();
      const { attachToMessage } = useMessageAttachments();

      await attachToMessage('conv-1', 'msg-1', [
        prepared({ file: new File(['a'], '1.jpg', { type: 'image/jpeg' }) }),
        prepared({ file: new File(['b'], '2.jpg', { type: 'image/jpeg' }) }),
      ]);

      const path1 = mockUpload.mock.calls[0][0];
      const path2 = mockUpload.mock.calls[1][0];
      expect(path1).not.toBe(path2);
    });
  });

  // -------------------------------------------------------------------------
  // getSignedUrl()
  // -------------------------------------------------------------------------
  describe('getSignedUrl()', () => {
    it('requests a 1-hour signed URL from the message-images bucket and returns it', async () => {
      const useMessageAttachments = await getComposable();
      const { getSignedUrl } = useMessageAttachments();

      const url = await getSignedUrl('conv-1/abc.jpg');

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('message-images');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('conv-1/abc.jpg', 3600);
      expect(url).toBe('https://signed.example.com/url?token=abc');
    });

    it('returns null when createSignedUrl errors (expired/deleted object)', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'Object not found' } });

      const useMessageAttachments = await getComposable();
      const { getSignedUrl } = useMessageAttachments();

      expect(await getSignedUrl('missing/x.jpg')).toBeNull();
    });

    it('returns null when createSignedUrl resolves without a signedUrl', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({ data: { signedUrl: '' }, error: null });

      const useMessageAttachments = await getComposable();
      const { getSignedUrl } = useMessageAttachments();

      expect(await getSignedUrl('x.jpg')).toBeNull();
    });

    it('caches the signed URL and serves a second request from cache (no second network call)', async () => {
      const useMessageAttachments = await getComposable();
      const { getSignedUrl } = useMessageAttachments();

      const first = await getSignedUrl('conv-1/cached.jpg');
      const second = await getSignedUrl('conv-1/cached.jpg');

      expect(first).toBe('https://signed.example.com/url?token=abc');
      expect(second).toBe(first);
      // Cache hit: createSignedUrl invoked only once for the same path.
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('does not cache a null result — a failed lookup re-requests next time', async () => {
      mockCreateSignedUrl
        .mockResolvedValueOnce({ data: null, error: { message: 'transient' } })
        .mockResolvedValueOnce({ data: { signedUrl: 'https://signed.example.com/recovered' }, error: null });

      const useMessageAttachments = await getComposable();
      const { getSignedUrl } = useMessageAttachments();

      expect(await getSignedUrl('conv-1/x.jpg')).toBeNull();
      expect(await getSignedUrl('conv-1/x.jpg')).toBe('https://signed.example.com/recovered');
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    });

    it('keys the cache per storage path (distinct paths each hit the network)', async () => {
      const useMessageAttachments = await getComposable();
      const { getSignedUrl } = useMessageAttachments();

      await getSignedUrl('conv-1/a.jpg');
      await getSignedUrl('conv-1/b.jpg');
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    });

    it('re-fetches when a cached entry has expired (past the 50-minute TTL)', async () => {
      const realNow = Date.now;
      let now = 1_000_000;
      Date.now = vi.fn(() => now);

      try {
        const useMessageAttachments = await getComposable();
        const { getSignedUrl } = useMessageAttachments();

        await getSignedUrl('conv-1/ttl.jpg');
        // Advance beyond the 50-minute treat-as-valid window.
        now += 51 * 60 * 1000;
        await getSignedUrl('conv-1/ttl.jpg');

        expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = realNow;
      }
    });
  });
});

// The composable's exported byte cap, referenced in a compression assertion above.
const MESSAGE_BYTE_CAP = 1_048_576;
