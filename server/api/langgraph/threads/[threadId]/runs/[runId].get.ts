import { createLangGraphClient } from '../../../../../utils/langgraph';

export default defineEventHandler(async (event) => {
  try {
    const threadId = getRouterParam(event, 'threadId');
    const runId = getRouterParam(event, 'runId');

    if (!threadId) {
      setResponseStatus(event, 400);
      return { error: 'Thread ID is required' };
    }

    if (!runId) {
      setResponseStatus(event, 400);
      return { error: 'Run ID is required' };
    }

    const client = createLangGraphClient();
    const run = await client.runs.get(threadId, runId);
    return run;
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
