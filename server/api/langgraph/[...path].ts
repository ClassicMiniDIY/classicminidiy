import { getApiUrl, getApiKey, forwardHeaders } from '../../utils/langgraph';

/**
 * Fallback proxy for any LangGraph endpoint without a dedicated file. The chat
 * client reaches `/threads/:id/state` through here.
 *
 * Do NOT re-add `checkBotId()`. Production is Cloudflare, where `botid/server`
 * is aliased to a fail-open stub whose contract states plainly that no route may
 * depend on it — so the call classified nothing while implying this endpoint was
 * bot-screened. Note also that the two POST routes that actually spend money
 * (`runs.post.ts`, `runs/stream.post.ts`) never had the call at all, so the
 * guard was absent exactly where it would have mattered most.
 *
 * What protects this path is an enabled Cloudflare zone rate-limit rule on
 * POST /api/langgraph/*, asserted from outside by
 * scripts/verify-cf-ratelimit.py, plus the in-app limiter in
 * server/middleware/rate-limit.ts.
 */
export default defineEventHandler(async (event) => {
  try {
    const path = getRouterParam(event, 'path') || '';
    const method = event.method;
    const apiUrl = getApiUrl();
    const apiKey = getApiKey(event);

    // Get request body for POST/PUT/PATCH requests
    let body: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      body = await readBody(event);
    }

    // Handle other endpoints by falling back to raw API calls
    // This maintains compatibility with any endpoints not yet covered by specific files
    const targetUrl = `${apiUrl}/${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // Forward other relevant headers
    forwardHeaders(event, headers);

    const response = await $fetch.raw(targetUrl, {
      method,
      headers,
      body,
    });

    // Forward response headers
    const responseHeaders = response.headers;
    if (responseHeaders.get('content-type')) {
      setHeader(event, 'content-type', responseHeaders.get('content-type')!);
    }
    if (responseHeaders.get('cache-control')) {
      setHeader(event, 'cache-control', responseHeaders.get('cache-control')!);
    }

    return response._data;
  } catch (error: any) {
    console.error('LangGraph API Error:', error);

    // Handle SDK errors
    if (error.response) {
      setResponseStatus(event, error.response.status || 500);
      return error.response.data || { error: 'API request failed' };
    }

    // Handle other errors
    setResponseStatus(event, 500);
    return {
      error: 'Internal server error',
      message: error.message,
    };
  }
});
