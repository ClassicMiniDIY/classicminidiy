import { createLangGraphClient } from '../../langgraph/_utils';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * Admin API endpoint to get a specific thread and its state/history
 * Requires admin authentication
 */
export default defineEventHandler(async (event) => {
  try {
    await requireAdminAuth(event);

    // Get thread ID from route params
    const threadId = getRouterParam(event, 'threadId');

    if (!threadId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Thread ID is required',
      });
    }

    // Create LangGraph client
    const client = createLangGraphClient();

    // Get thread details
    const thread = await client.threads.get(threadId);

    // Get thread state/history
    const state = await client.threads.getState(threadId);

    // Get thread history (runs)
    let history;
    try {
      history = await client.runs.list(threadId);
    } catch (error) {
      console.warn('Could not fetch thread history:', error);
      history = [];
    }

    return {
      success: true,
      thread,
      state,
      history,
    };
  } catch (error: any) {
    console.error('Error fetching thread details:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch thread details',
      message: error.message,
    });
  }
});
