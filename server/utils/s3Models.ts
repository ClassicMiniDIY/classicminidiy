/**
 * S3 plumbing for the 3D Model Library (keystone §5).
 *
 * Model file bytes live in a PRIVATE bucket `classicminidiy-models`
 * (Block Public Access on, SSE-S3, versioning on), written directly by the
 * browser via presigned POST and read back via short-lived presigned GET. This
 * bucket and its dedicated IAM user are intentionally separate from the public
 * static-assets S3 — never reuse those credentials here.
 *
 * Objects are written with `StorageClass: INTELLIGENT_TIERING` so AWS moves
 * cold files to cheaper tiers automatically (all millisecond retrieval). There
 * are NO lifecycle transition rules — the storage class on the object is the
 * whole story (keystone §5).
 *
 * Key scheme: `models/{model_id}/v{version_number}/{file_id}/{safe_filename}`.
 */
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost, type PresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client: S3Client | null = null;
let cachedBucket: string | null = null;

interface ModelsS3Config {
  client: S3Client;
  bucket: string;
}

/**
 * Lazily build the S3 client + bucket from server-only runtime config. Throws a
 * 500 (not a leak of which var is missing) if the bucket/credentials are unset,
 * so a misconfigured deploy fails loudly rather than silently presigning into a
 * nonexistent bucket.
 */
function getModelsS3(): ModelsS3Config {
  const config = useRuntimeConfig();
  const bucket = config.S3_MODELS_BUCKET as string;
  const region = (config.S3_MODELS_REGION as string) || 'us-east-1';
  const accessKeyId = config.S3_MODELS_ACCESS_KEY_ID as string;
  const secretAccessKey = config.S3_MODELS_SECRET_ACCESS_KEY as string;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw createError({ statusCode: 500, statusMessage: 'Model storage is not configured' });
  }

  if (!client || cachedBucket !== bucket) {
    client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    cachedBucket = bucket;
  }

  return { client, bucket };
}

/**
 * Build the canonical S3 key. `file_id` (a uuid) guarantees uniqueness even if
 * two files share a sanitized name; the trailing name keeps the console legible.
 */
export function buildModelKey(opts: {
  modelId: string;
  versionNumber: number;
  fileId: string;
  safeFilename: string;
}): string {
  return `models/${opts.modelId}/v${opts.versionNumber}/${opts.fileId}/${opts.safeFilename}`;
}

/**
 * Sanitize an uploaded filename into an S3-key-safe segment, forcing the
 * lowercase extension (the DB `file_ext` constraint is lowercase-only). Strips
 * any path components, collapses unsafe characters, and bounds the length.
 */
export function sanitizeModelFilename(original: string, ext: string): string {
  const base =
    String(original || '')
      .split(/[\\/]/)
      .pop() || '';
  // Drop any existing extension; we re-append the normalized one.
  const stem = base.replace(/\.[^.]*$/, '');
  const cleaned =
    stem
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'file';
  return `${cleaned}.${ext.toLowerCase()}`;
}

/**
 * Create a presigned POST for a direct browser → S3 upload (keystone §5 step 1).
 * Policy pins the exact key, a content-length-range, the content type, and the
 * INTELLIGENT_TIERING storage class. When a base64 SHA-256 is supplied it is
 * bound as `x-amz-checksum-sha256` so S3 verifies the hash during the upload.
 */
export function createModelUploadPost(opts: {
  key: string;
  contentType: string;
  maxBytes: number;
  /** Base64-encoded SHA-256 digest. Optional; when set S3 verifies the upload. */
  checksumSha256?: string | null;
  expiresInSeconds?: number;
}): Promise<PresignedPost> {
  const { client, bucket } = getModelsS3();

  // Fields are automatically added to the POST policy as exact-match
  // conditions by createPresignedPost.
  const fields: Record<string, string> = {
    'Content-Type': opts.contentType,
    'x-amz-storage-class': 'INTELLIGENT_TIERING',
  };
  if (opts.checksumSha256) {
    fields['x-amz-checksum-sha256'] = opts.checksumSha256;
  }

  return createPresignedPost(client, {
    Bucket: bucket,
    Key: opts.key,
    Fields: fields,
    Conditions: [['content-length-range', 1, opts.maxBytes]],
    Expires: opts.expiresInSeconds ?? 900, // 15 minutes
  });
}

/** HeadObject — returns the object's size (and existence) for finalize. */
export async function headModelObject(key: string): Promise<{ exists: boolean; size: number }> {
  const { client, bucket } = getModelsS3();
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true, size: res.ContentLength ?? 0 };
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
      return { exists: false, size: 0 };
    }
    throw err;
  }
}

/**
 * Read the first `length` bytes of an object for magic-byte sniffing. Uses a
 * Range request so we never pull a 200 MB file through the function.
 */
export async function getModelObjectHead(key: string, length = 512): Promise<Buffer> {
  const { client, bucket } = getModelsS3();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${length - 1}` }));
  if (!res.Body) return Buffer.alloc(0);
  // The Node SDK augments Body with transformToByteArray().
  const bytes = await (res.Body as any).transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Create a short-lived presigned GET for a download (keystone §5). Default 60 s.
 * `disposition` is `attachment` for real downloads and `inline` for the viewer.
 */
export function createModelDownloadUrl(opts: {
  key: string;
  fileName: string;
  disposition?: 'attachment' | 'inline';
  expiresInSeconds?: number;
}): Promise<string> {
  const { client, bucket } = getModelsS3();
  const disposition = opts.disposition ?? 'attachment';
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ResponseContentDisposition: contentDisposition(disposition, opts.fileName),
  });
  return getSignedUrl(client, command, { expiresIn: opts.expiresInSeconds ?? 60 });
}

/**
 * Build a safe Content-Disposition value. Quote-strips/control-strips the ASCII
 * filename to prevent header injection and adds an RFC 5987 `filename*` for
 * non-ASCII names.
 */
export function contentDisposition(disposition: 'attachment' | 'inline', fileName: string): string {
  const raw = String(fileName || 'download');
  const asciiFallback = raw.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
  const encoded = encodeURIComponent(raw).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
