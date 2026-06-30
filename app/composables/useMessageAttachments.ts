/**
 * Message Attachments Composable
 *
 * Handles uploading, validating, and retrieving signed URLs for inline
 * chat image attachments. Backed by the private `message-images` Supabase
 * storage bucket. Attachments expire after 1 year and are swept by the
 * cleanup-message-images cron.
 */

import type { MessageAttachment } from '~/composables/useMessages';

// Hard cap enforced both in DB constraint and here.
export const MESSAGE_ATTACHMENT_MAX_BYTES = 1_048_576; // 1 MB
export const MESSAGE_ATTACHMENT_MAX_COUNT = 4;
export const MESSAGE_ATTACHMENT_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

type AllowedMime = (typeof MESSAGE_ATTACHMENT_ALLOWED_MIME)[number];

interface PreparedAttachment {
  file: File;
  width: number;
  height: number;
}

interface InsertRow {
  message_id: string;
  storage_path: string;
  mime_type: AllowedMime;
  size_bytes: number;
  width: number;
  height: number;
}

// Bounded LRU cache for signed URLs, keyed by storage path.
// Signed URLs live for 1 hour; we treat them as valid for 50 minutes.
// MAX_CACHE_SIZE caps memory — in a long SPA session a user could scroll
// through a very long thread (or multiple threads) and otherwise grow the
// map without bound. When the cap is hit we evict the least-recently-used
// entry, which JavaScript Maps give us for free: iteration order is
// insertion order, so deleting and re-inserting on access produces LRU
// semantics.
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;
const MAX_SIGNED_URL_CACHE_SIZE = 200;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const touchCache = (path: string, entry: { url: string; expiresAt: number }) => {
  // Re-insert to move to the end (most-recently-used position)
  signedUrlCache.delete(path);
  signedUrlCache.set(path, entry);
  // Evict oldest if over cap
  while (signedUrlCache.size > MAX_SIGNED_URL_CACHE_SIZE) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (oldestKey === undefined) break;
    signedUrlCache.delete(oldestKey);
  }
};

export const useMessageAttachments = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image dimensions'));
      };
      img.src = objectUrl;
    });

  /**
   * Prepare a single file for upload: HEIC→JPEG conversion, compression to
   * stay under the 1 MB cap, and dimension extraction.
   * Throws with a user-friendly message if the file is invalid or can't
   * be compressed below the limit.
   */
  const prepareAttachment = async (input: File): Promise<PreparedAttachment> => {
    // Browser-only: dynamically imports heic2any (libheif WASM) +
    // browser-image-compression. The guard keeps both out of the SSR/server
    // build so they aren't traced into the Vercel serverless function.
    if (!import.meta.client) throw new Error('prepareAttachment is browser-only');
    let file: File = input;

    // HEIC conversion (iOS Safari) — done BEFORE size check because HEICs
    // are usually small but we want the downstream JPEG for compatibility.
    if (/heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name)) {
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
      });
    }

    if (!MESSAGE_ATTACHMENT_ALLOWED_MIME.includes(file.type as AllowedMime)) {
      throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
    }

    // Compress to fit under 1 MB. browser-image-compression uses a web
    // worker and normalizes EXIF orientation.
    if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        initialQuality: 0.85,
      });
      file = new File([compressed], file.name, { type: compressed.type || file.type });
    }

    if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
      throw new Error('Image is still too large after compression. Try a smaller image.');
    }

    const { width, height } = await readImageDimensions(file);

    return { file, width, height };
  };

  /**
   * Validate a batch of files before any uploads begin. Returns the list
   * of errors (empty array if valid).
   */
  const validateBatch = (files: File[]): string[] => {
    const errors: string[] = [];
    if (files.length > MESSAGE_ATTACHMENT_MAX_COUNT) {
      errors.push(`You can attach at most ${MESSAGE_ATTACHMENT_MAX_COUNT} images per message.`);
    }
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        errors.push(`"${f.name}" is not an image.`);
      }
      // Hard reject files > 10 MB even before compression — protects against
      // the user trying to upload a 50 MB camera raw file.
      if (f.size > 10 * 1024 * 1024) {
        errors.push(`"${f.name}" is too large (max 10 MB before compression).`);
      }
    }
    return errors;
  };

  /**
   * Upload prepared attachments for a specific message and insert DB rows.
   *
   * IMPORTANT: The message row must already exist, otherwise the FK will
   * fail. Callers should create the message first, then call this.
   */
  const attachToMessage = async (
    conversationId: string,
    messageId: string,
    prepared: PreparedAttachment[]
  ): Promise<MessageAttachment[]> => {
    if (!user.value) throw new Error('Not authenticated');
    if (prepared.length === 0) return [];

    const uploadedPaths: string[] = [];
    const rowsToInsert: InsertRow[] = [];

    try {
      for (const { file, width, height } of prepared) {
        const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        // crypto.randomUUID is undefined in non-secure (HTTP) contexts / older browsers.
        const uuid =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              });
        const storagePath = `${conversationId}/${uuid}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('message-images')
          .upload(storagePath, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        uploadedPaths.push(storagePath);

        rowsToInsert.push({
          message_id: messageId,
          storage_path: storagePath,
          mime_type: file.type as AllowedMime,
          size_bytes: file.size,
          width,
          height,
        });
      }

      const { data, error: dbError } = await supabase
        .from('message_attachments')
        .insert(rowsToInsert)
        .select('*');

      if (dbError) {
        throw new Error(`Failed to save attachment records: ${dbError.message}`);
      }

      return (data as MessageAttachment[]) ?? [];
    } catch (err) {
      // Best-effort cleanup of any storage objects we managed to upload
      // before the failure, so we don't leak orphans. The cleanup cron is
      // a safety net if this fails too.
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('message-images').remove(uploadedPaths).catch(() => {
          /* ignore */
        });
      }
      throw err;
    }
  };

  /**
   * Get a short-lived signed URL for a stored message image.
   * Returns null if the object is missing (expired/deleted) so callers
   * can render the "this image has been deleted" fallback.
   */
  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    const now = Date.now();
    // Client-only: signedUrlCache is a module-level Map; on the server it would
    // be shared across all requests/users (cross-request leak of private signed URLs).
    if (import.meta.client) {
      const cached = signedUrlCache.get(storagePath);
      if (cached && cached.expiresAt > now) {
        // Refresh LRU position even on cache hit
        touchCache(storagePath, cached);
        return cached.url;
      }
    }

    const { data, error } = await supabase.storage
      .from('message-images')
      .createSignedUrl(storagePath, 60 * 60); // 1 hour

    if (error || !data?.signedUrl) {
      return null;
    }

    if (import.meta.client) {
      touchCache(storagePath, {
        url: data.signedUrl,
        expiresAt: now + SIGNED_URL_TTL_MS,
      });
    }
    return data.signedUrl;
  };

  return {
    prepareAttachment,
    validateBatch,
    attachToMessage,
    getSignedUrl,
    MESSAGE_ATTACHMENT_MAX_BYTES,
    MESSAGE_ATTACHMENT_MAX_COUNT,
  };
};
