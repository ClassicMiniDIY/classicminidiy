import { createLangGraphClient, createThreadIfNeeded } from '../../../../../utils/langgraph';

/**
 * SSE proxy for a LangGraph run. The only chat transport the UI actually uses.
 *
 * Two things here are load-bearing and were both defects until 2026-08-31:
 *
 *  1. **Chunks are encoded to `Uint8Array`.** A `Response` body must be a byte
 *     stream; enqueuing raw strings leaves the runtime to coerce them, which is
 *     what kept true incremental streaming from working on workerd (the
 *     "Phase 1 byte-stream fix" deferred in
 *     docs/plans/2026-08-06-cloudflare-workers-migration.md). The wire format is
 *     unchanged — `data: {json}\n\n` per event, terminated by `data: [DONE]`.
 *     Verify a change here by measuring time-to-FIRST-byte against
 *     time-to-LAST-byte on a real run under `wrangler dev --local`; if they are
 *     equal the response is still buffered and no unit test will tell you.
 *
 *  2. **No CORS headers.** This route spends money on every call and is
 *     same-origin by design, so `Access-Control-Allow-Origin: '*'` was handing
 *     any site on the internet a browser-callable LLM billed to us. Emitting
 *     nothing restores the browser's own same-origin protection. The native
 *     iOS/Android clients are unaffected — they are not browsers and do not
 *     enforce CORS. If a second web origin is ever genuinely needed, use an
 *     explicit allowlist plus `Vary: Origin`, never `*`.
 *     `tests/static/no-wildcard-cors.test.ts` enforces this repo-wide.
 */
const encoder = new TextEncoder();

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig();
  try {
    let threadId = getRouterParam(event, 'threadId');

    if (!threadId) {
      setResponseStatus(event, 400);
      return { error: 'Thread ID is required' };
    }

    const body = await readBody(event);
    const { assistant_id, input, stream_mode = 'updates', metadata, ...config } = body || {};

    if (!assistant_id) {
      setResponseStatus(event, 400);
      return { error: 'assistant_id is required' };
    }

    const client = createLangGraphClient();

    // Create a new thread if threadId is 'new' or invalid
    try {
      threadId = await createThreadIfNeeded(client, threadId);
    } catch (error: any) {
      setResponseStatus(event, 500);
      return { error: 'Failed to create thread', message: error.message };
    }

    const send = (controller: ReadableStreamDefaultController, payload: string) =>
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send thread ID as first event
          send(controller, JSON.stringify({ event: 'thread_id', data: { thread_id: threadId } }));

          // Prepare stream options with metadata
          const streamOptions: any = {
            input,
            streamMode: stream_mode,
            ...config,
          };

          // Add metadata if provided
          if (metadata) {
            streamOptions.metadata = {
              environment: runtimeConfig.NODE_ENV || 'development',
              ...metadata,
            };
          }

          const streamResponse = client.runs.stream(threadId, assistant_id, streamOptions);

          for await (const chunk of streamResponse) {
            send(controller, JSON.stringify(chunk));
          }
        } catch (error: any) {
          console.error('Streaming error:', error);
          send(controller, JSON.stringify({ error: error.message }));
        } finally {
          // The client treats this sentinel as end-of-stream, so it must be
          // emitted on the error path too or the composer stays spinning.
          send(controller, '[DONE]');
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('LangGraph API Error:', error);

    if (error.response) {
      setResponseStatus(event, error.response.status || 500);
      return error.response.data || { error: 'API request failed' };
    }

    setResponseStatus(event, 500);
    return {
      error: 'Internal server error',
      message: error.message,
    };
  }
});
