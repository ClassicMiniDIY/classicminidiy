import { createLangGraphClient } from '../../utils/langgraph';

/**
 * Do NOT re-add `checkBotId()` here — see the note in `[...path].ts`. On
 * Cloudflare it is a fail-open stub, so it rejected nothing while reading as a
 * budget guard. The zone rate-limit rule on POST /api/langgraph/* and the
 * in-app limiter are what stand in front of this.
 */
export default defineEventHandler(async (event) => {
  try {
    const client = createLangGraphClient();
    const thread = await client.threads.create();
    return thread;
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
