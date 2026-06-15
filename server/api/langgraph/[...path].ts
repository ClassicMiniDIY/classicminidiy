import { checkBotId } from 'botid/server';
import { getApiUrl, getApiKey, forwardHeaders } from './_utils';

// Fallback handler for any endpoints not covered by specific files
export default defineEventHandler(async (event) => {
  // Vercel BotID — only POSTs (chat runs/streaming) carry the challenge header
  // (see app/plugins/botid.client.ts); GET reads (thread state) aren't protected,
  // so don't bot-check them or they'd 403 for lack of a token. No-op in local dev.
  if (event.method === 'POST') {
    const { isBot } = await checkBotId();
    if (isBot) {
      throw createError({ statusCode: 403, statusMessage: 'Bot detected' });
    }
  }

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
