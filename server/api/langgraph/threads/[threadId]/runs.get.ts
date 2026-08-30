import { getApiUrl, getApiKey, forwardHeaders } from '../../../../utils/langgraph';

export default defineEventHandler(async (event) => {
  try {
    const threadId = getRouterParam(event, 'threadId');

    if (!threadId) {
      setResponseStatus(event, 400);
      return { error: 'Thread ID is required' };
    }

    const apiUrl = getApiUrl();
    const apiKey = getApiKey(event);
    const targetUrl = `${apiUrl}/threads/${threadId}/runs`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    forwardHeaders(event, headers);

    const response = await $fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    return response;
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
