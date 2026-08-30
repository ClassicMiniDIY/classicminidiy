import { createLangGraphClient } from '../../utils/langgraph';

export default defineEventHandler(async (event) => {
  try {
    const client = createLangGraphClient();
    const threads = await client.threads.search();
    return threads;
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
