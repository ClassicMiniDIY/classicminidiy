import { Client } from '@langchain/langgraph-sdk';

// Read the config INSIDE each function, never once at module scope. On
// Cloudflare Workers the runtime secrets reach `process.env` before module
// evaluation, so a module-scope snapshot happens to work today — but it also
// freezes whatever was baked at build time if that ever stops being true, and
// the failure mode is a silently empty credential rather than an error. The
// 2026-08-26 chat outage was exactly that shape. Per-call is free here.
function config() {
  return useRuntimeConfig();
}

export function createLangGraphClient() {
  const c = config();
  return new Client({ apiUrl: c.LANGGRAPH_API_URL, apiKey: c.LANGSMITH_API_KEY });
}

export function getApiKey(event: any) {
  return config().LANGSMITH_API_KEY || getHeader(event, 'x-api-key') || '';
}

export function getApiUrl() {
  return config().LANGGRAPH_API_URL;
}

export function forwardHeaders(event: any, headers: Record<string, string>) {
  const forwardHeaders = [
    'authorization',
    'user-agent',
    'accept',
    'accept-encoding',
    'assistant-id',
    'accept-language',
  ];
  forwardHeaders.forEach((headerName) => {
    const headerValue = getHeader(event, headerName);
    if (headerValue) {
      headers[headerName] = headerValue;
    }
  });
}

export async function createThreadIfNeeded(client: Client, threadId: string) {
  if (threadId === 'new' || !threadId) {
    try {
      const newThread = await client.threads.create();
      return newThread.thread_id;
    } catch (error: any) {
      console.error('Failed to create thread:', error);
      throw error;
    }
  }
  return threadId;
}
