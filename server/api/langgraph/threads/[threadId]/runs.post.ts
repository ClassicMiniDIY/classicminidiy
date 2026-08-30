import { createLangGraphClient, createThreadIfNeeded } from '../../../../utils/langgraph';

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig();
  try {
    let threadId = getRouterParam(event, 'threadId');

    if (!threadId) {
      setResponseStatus(event, 400);
      return { error: 'Thread ID is required' };
    }

    const body = await readBody(event);
    const { assistant_id, input, metadata, ...config } = body || {};

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

    // Prepare run options with metadata
    const runOptions: any = {
      input,
      ...config,
    };

    // Add metadata if provided
    if (metadata) {
      runOptions.metadata = {
        environment: runtimeConfig.NODE_ENV || 'development',
        ...metadata,
      };
    }

    const run = await client.runs.create(threadId, assistant_id, runOptions);

    // Wait for the run to complete and return the result
    const result = await client.runs.join(threadId, run.run_id);
    return result;
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
