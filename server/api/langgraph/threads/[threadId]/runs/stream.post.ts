import { createLangGraphClient, createThreadIfNeeded } from '../../../../../utils/langgraph';

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

    // Create a streaming response using server-sent events
    setHeader(event, 'Content-Type', 'text/event-stream');
    setHeader(event, 'Cache-Control', 'no-cache');
    setHeader(event, 'Connection', 'keep-alive');
    setHeader(event, 'Access-Control-Allow-Origin', '*');
    setHeader(event, 'Access-Control-Allow-Headers', 'Cache-Control');

    // Create a readable stream for server-sent events
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send thread ID as first event
          const threadInfo = JSON.stringify({ event: 'thread_id', data: { thread_id: threadId } });
          controller.enqueue(`data: ${threadInfo}\n\n`);

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
            // Send each chunk as a server-sent event
            const data = JSON.stringify(chunk);
            controller.enqueue(`data: ${data}\n\n`);
          }
        } catch (error: any) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({ error: error.message });
          controller.enqueue(`data: ${errorData}\n\n`);
        } finally {
          controller.enqueue('data: [DONE]\n\n');
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
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
