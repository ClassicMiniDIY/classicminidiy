/**
 * Fetch JSON with a timeout and bounded retries, for server routes.
 *
 * Use this instead of a Node-transport HTTP client. axios (and anything else
 * built on Node's `http`/`https`) cannot run on Cloudflare Workers: nitropack
 * lists those modules in `unsupportedNodeModules` and unenv stubs them on
 * workerd, so `import axios from 'axios'` bundles to a namespace whose
 * `.default` is not callable. `/api/youtube/*` returned 500 on Workers for
 * exactly that reason while the identical code kept working on Vercel — the
 * same failure class as the AWS SDK removal. `$fetch` (ofetch) is
 * platform-neutral and behaves the same on Node and on workerd.
 *
 * Lives here rather than beside a route because two handlers need it and the
 * timeout / attempt-count / backoff decisions must stay in one place.
 */

/**
 * Only transient failures are worth another attempt.
 *
 * A 4xx from an upstream API is deterministic — a bad key or an exhausted quota
 * answers 403 identically every time — so retrying it just multiplies latency
 * on a request that is already going to fail. 429 is the exception: it is a
 * rate limit rather than a rejection, so it can clear. An error with no status
 * at all is a network fault or a timeout, which is the case retries exist for.
 */
function isRetryable(error: unknown): boolean {
  const status = (error as any)?.statusCode ?? (error as any)?.response?.status;
  if (typeof status !== 'number') return true;
  return status >= 500 || status === 429;
}

export async function fetchJsonWithRetry<T>(url: string, timeoutMs = 5000, maxRetries = 3): Promise<T> {
  // Always make at least one attempt, so a caller passing 0 gets a real error
  // from the request rather than `throw undefined` out of an unentered loop.
  const attempts = Math.max(1, Math.trunc(maxRetries) || 1);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await $fetch<T>(url, { timeout: timeoutMs, retry: 0 });
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1 || !isRetryable(err)) break;
      // Exponential backoff: 2s, then 4s.
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt + 1)));
    }
  }

  throw lastError;
}
