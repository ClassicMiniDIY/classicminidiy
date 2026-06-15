import { checkBotId } from 'botid/server';
import { createLangGraphClient } from './_utils';

export default defineEventHandler(async (event) => {
  // Vercel BotID — reject classified bots before spending any LangGraph budget.
  // Protected in app/plugins/botid.client.ts. No-op (always human) in local dev.
  const { isBot } = await checkBotId();
  if (isBot) {
    throw createError({ statusCode: 403, statusMessage: 'Bot detected' });
  }

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
