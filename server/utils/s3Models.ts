/**
 * S3 plumbing for the 3D Model Library (keystone §5).
 *
 * Model file bytes live in a PRIVATE bucket `classicminidiy-models`
 * (Block Public Access on, SSE-S3, versioning on), written directly by the
 * browser via presigned PUT and read back via short-lived presigned GET. This
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
import { AwsClient } from 'aws4fetch';

let client: AwsClient | null = null;
let cachedBucket: string | null = null;
let cachedHost: string | null = null;

interface ModelsS3Config {
  client: AwsClient;
  bucket: string;
  /** Virtual-hosted-style origin, e.g. https://my-bucket.s3.us-east-1.amazonaws.com */
  origin: string;
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
    client = new AwsClient({ accessKeyId, secretAccessKey, region, service: 's3' });
    cachedBucket = bucket;
    cachedHost = `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  return { client, bucket, origin: cachedHost as string };
}

/** Virtual-hosted-style object URL. Each key segment is encoded, `/` separators kept. */
function objectUrl(origin: string, key: string): string {
  return `${origin}/${key.split('/').map(encodeURIComponent).join('/')}`;
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
      // Drop combining diacritical marks so "café" -> "cafe", not "caf-".
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'file';
  return `${cleaned}.${ext.toLowerCase()}`;
}

/**
 * Create a presigned PUT for a direct browser -> S3 upload (keystone §5 step 1).
 *
 * Replaces the former presigned POST + policy document. The AWS SDK cannot run on
 * Cloudflare Workers at all: `new S3Client()` throws there because `@aws-sdk/core`
 * resolves to its BROWSER build (Node-only exports become `Symbol.for("node-only")`
 * sentinels) while `@aws-sdk/client-s3` keeps its NODE `getRuntimeConfig` and calls
 * one of those sentinels as a function. aws4fetch signs with SubtleCrypto + fetch
 * and behaves identically on Node and on workerd.
 *
 * **`content-length` is signed, and that is what enforces the size cap.** It replaces
 * the old policy's `['content-length-range', 1, maxBytes]`. A client that presigns for
 * N bytes then sends more gets `SignatureDoesNotMatch` from S3. Verified against the
 * real bucket: signed 1024 / sent 4096 -> 403; signed 1024 / sent 1024 -> 200.
 * DO NOT drop `content-length` from the signed headers — that silently removes the
 * upload size limit.
 *
 * `x-amz-storage-class: INTELLIGENT_TIERING` and the optional base64
 * `x-amz-checksum-sha256` are signed too, so S3 rejects an upload that alters either —
 * the same guarantee the POST policy's exact-match fields provided.
 */
export async function createModelUploadUrl(opts: {
  key: string;
  contentType: string;
  /** Exact byte length of the upload. Signed, therefore enforced by S3. */
  sizeBytes: number;
  /** Base64-encoded SHA-256 digest. Optional; when set S3 verifies the upload. */
  checksumSha256?: string | null;
  expiresInSeconds?: number;
}): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }> {
  const { client, origin } = getModelsS3();

  // Every header here is signed (allHeaders), so the browser must send them back
  // verbatim or the signature fails.
  const headers: Record<string, string> = {
    'content-type': opts.contentType,
    'content-length': String(opts.sizeBytes),
    'x-amz-storage-class': 'INTELLIGENT_TIERING',
  };
  if (opts.checksumSha256) {
    headers['x-amz-checksum-sha256'] = opts.checksumSha256;
  }

  // Expiry is carried as the X-Amz-Expires QUERY PARAM, not a signing option.
  // aws4fetch defaults it to 86400 (24 h) for s3 when absent — always set it.
  const url = new URL(objectUrl(origin, opts.key));
  url.searchParams.set('X-Amz-Expires', String(opts.expiresInSeconds ?? 900)); // 15 minutes

  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers,
    aws: { signQuery: true, allHeaders: true },
  });

  return { url: signed.url.toString(), method: 'PUT', headers };
}


/** HeadObject — returns the object's size (and existence) for finalize. */
export async function headModelObject(key: string): Promise<{ exists: boolean; size: number }> {
  const { client, origin } = getModelsS3();
  const res = await client.fetch(objectUrl(origin, key), { method: 'HEAD' });

  // S3 answers 403 rather than 404 for a missing key when the caller lacks
  // s3:ListBucket, so both mean "not there" as far as finalize is concerned.
  if (res.status === 404 || res.status === 403) return { exists: false, size: 0 };
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `S3 HeadObject failed (${res.status})` });
  }

  const len = res.headers.get('content-length');
  return { exists: true, size: len ? Number.parseInt(len, 10) || 0 : 0 };
}

/**
 * Read the first `length` bytes of an object for magic-byte sniffing. Uses a
 * Range request so we never pull a 200 MB file through the function.
 */
export async function getModelObjectHead(key: string, length = 512): Promise<Buffer> {
  const { client, origin } = getModelsS3();
  const res = await client.fetch(objectUrl(origin, key), {
    headers: { Range: `bytes=0-${length - 1}` },
  });

  // 206 is the expected answer to a ranged GET; 200 means the object was smaller
  // than the requested range and S3 returned the whole thing.
  if (res.status === 404 || res.status === 403) return Buffer.alloc(0);
  if (!res.ok && res.status !== 206) {
    throw createError({ statusCode: 502, statusMessage: `S3 GetObject range failed (${res.status})` });
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  return Buffer.from(bytes.subarray(0, length));
}

/**
 * Create a short-lived presigned GET for a download (keystone §5). Default 60 s.
 * `disposition` is `attachment` for real downloads and `inline` for the viewer.
 */
export async function createModelDownloadUrl(opts: {
  key: string;
  fileName: string;
  disposition?: 'attachment' | 'inline';
  expiresInSeconds?: number;
}): Promise<string> {
  const { client, origin } = getModelsS3();
  const disposition = opts.disposition ?? 'attachment';

  // response-content-disposition is a signed QUERY parameter, so S3 rejects a
  // tampered filename rather than honouring it.
  const url = new URL(objectUrl(origin, opts.key));
  url.searchParams.set('response-content-disposition', contentDisposition(disposition, opts.fileName));
  // See createModelUploadUrl: without an explicit X-Amz-Expires this would be a
  // 24-hour download URL instead of a 60-second one.
  url.searchParams.set('X-Amz-Expires', String(opts.expiresInSeconds ?? 60));

  const signed = await client.sign(url.toString(), {
    method: 'GET',
    aws: { signQuery: true },
  });
  return signed.url.toString();
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
