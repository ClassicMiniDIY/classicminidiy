/** SPIKE-ONLY. DELETE before Phase 1. Isolates WHICH AWS SDK step breaks on workerd. */
export default defineEventHandler(async () => {
  const steps: Record<string, unknown> = {};
  const cfg = useRuntimeConfig();

  const step = async (name: string, fn: () => Promise<unknown> | unknown) => {
    try {
      const v = await fn();
      steps[name] = { ok: true, detail: typeof v === 'object' ? 'object' : String(v).slice(0, 80) };
      return v as any;
    } catch (err: any) {
      steps[name] = {
        ok: false,
        name: err?.name,
        message: String(err?.message || err).slice(0, 200),
        stack: String(err?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 400),
      };
      return undefined;
    }
  };

  const s3mod: any = await step('import @aws-sdk/client-s3', () => import('@aws-sdk/client-s3'));
  const presignMod: any = await step('import s3-request-presigner', () => import('@aws-sdk/s3-request-presigner'));

  const client = await step('new S3Client()', () =>
    new s3mod.S3Client({
      region: (cfg.S3_MODELS_REGION as string) || 'us-east-1',
      credentials: {
        accessKeyId: cfg.S3_MODELS_ACCESS_KEY_ID as string,
        secretAccessKey: cfg.S3_MODELS_SECRET_ACCESS_KEY as string,
      },
    })
  );

  const cmd = await step('new HeadObjectCommand()', () =>
    new s3mod.HeadObjectCommand({ Bucket: cfg.S3_MODELS_BUCKET as string, Key: 'spike/nope.stl' })
  );

  const url = await step('getSignedUrl()', () =>
    presignMod.getSignedUrl(client, cmd, { expiresIn: 60 })
  );

  if (typeof url === 'string') {
    await step('fetch(presigned)', async () => {
      const r = await fetch(url, { method: 'HEAD' });
      return `status=${r.status} amzReqId=${r.headers.get('x-amz-request-id') ? 'present' : 'absent'}`;
    });
  }

  return steps;
});
