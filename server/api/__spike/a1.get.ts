/**
 * SPIKE-ONLY probe for migration amendment A1. DELETE before Phase 1 merges.
 *
 * A1 predicts that `client.send()` in server/utils/s3Models.ts breaks on
 * workerd: nitropack lists node:http/https in `unsupportedNodeModules`, unenv
 * stubs them, and `http.request` is `notImplemented` and throws.
 *
 * The S3 credentials on this worker are deliberately FAKE, which is what makes
 * the probe conclusive:
 *   - throws before any network call (notImplemented / not implemented)  -> A1 CONFIRMED
 *   - returns an AWS auth/404 error (InvalidAccessKeyId, SignatureDoesNotMatch,
 *     NotFound)                                                          -> A1 REFUTED,
 *     because reaching AWS at all proves the HTTP layer works on workerd.
 */
export default defineEventHandler(async () => {
  const out: Record<string, unknown> = {};

  try {
    const res = await headModelObject('spike/does-not-exist.stl');
    out.headModelObject = { threw: false, result: res };
  } catch (err: any) {
    out.headModelObject = {
      threw: true,
      name: err?.name,
      message: String(err?.message || err).slice(0, 300),
      httpStatus: err?.$metadata?.httpStatusCode,
      // The signature that separates "unenv stubbed it" from "AWS said no".
      looksLikeUnenvStub: /not implemented|notimplemented/i.test(String(err?.message || '')),
    };
  }

  return out;
});
