export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') || '';
  const isStatic = path.startsWith('static/');
  const baseUrl = isStatic ? 'https://us-assets.i.posthog.com' : 'https://us.i.posthog.com';
  const targetUrl = `${baseUrl}/${path}`;

  const headers: Record<string, string> = {};
  const incomingHeaders = getRequestHeaders(event);

  // Forward only safe headers, strip cookies and auth
  const safeHeaders = ['content-type', 'content-length', 'accept', 'accept-encoding', 'user-agent', 'origin'];
  for (const key of safeHeaders) {
    if (incomingHeaders[key]) {
      headers[key] = incomingHeaders[key] as string;
    }
  }

  const method = getMethod(event);
  const body = method === 'POST' ? await readRawBody(event) : undefined;

  const response = await $fetch.raw(targetUrl, {
    method,
    headers,
    body,
    query: getQuery(event),
  });

  // Forward response headers
  const responseHeaders = response.headers;
  if (responseHeaders.get('content-type')) {
    setResponseHeader(event, 'content-type', responseHeaders.get('content-type')!);
  }

  return response._data;
});
