/**
 * SPIKE-ONLY. DELETE before Phase 1 merges.
 *
 * Verifies the aws4fetch rewrite on workerd. The worker's S3 credentials are
 * deliberately FAKE, which is what makes this conclusive:
 *   - the old AWS SDK path died at `new S3Client()` with
 *     `emitWarningIfUnsupportedVersion is not a function` — it never reached AWS.
 *   - the aws4fetch path should REACH S3 and be told 403 (InvalidAccessKeyId).
 *     A real HTTP status from S3 is the proof that signing + fetch work here.
 */
export default defineEventHandler(async () => {
  const out: Record<string, unknown> = {};

  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = { ok: true, detail: await fn() };
    } catch (err: any) {
      out[name] = { ok: false, name: err?.name, message: String(err?.message || err).slice(0, 200) };
    }
  };

  // Signing only — no network. Proves SubtleCrypto signing runs on workerd.
  await step('createModelUploadUrl (sign)', async () => {
    const r = await createModelUploadUrl({
      key: 'spike/nope.stl',
      contentType: 'application/octet-stream',
      sizeBytes: 1024,
    });
    const p = new URL(r.url).searchParams;
    return {
      method: r.method,
      signedHeaders: p.get('X-Amz-SignedHeaders'),
      expires: p.get('X-Amz-Expires'),
      hasSignature: Boolean(p.get('X-Amz-Signature')),
    };
  });

  await step('createModelDownloadUrl (sign)', async () => {
    const url = await createModelDownloadUrl({ key: 'spike/nope.stl', fileName: 'nope.stl' });
    return { expires: new URL(url).searchParams.get('X-Amz-Expires') };
  });

  // Sign AND fetch. With fake creds S3 should answer 403 — reaching it is the point.
  await step('headModelObject (sign + fetch)', async () => {
    const res = await headModelObject('spike/nope.stl');
    return { reachedS3: true, result: res };
  });

  await step('getModelObjectHead (sign + fetch)', async () => {
    const buf = await getModelObjectHead('spike/nope.stl', 512);
    return { reachedS3: true, bytes: buf.length };
  });

  return out;
});
