import { createLangGraphClient } from '../../langgraph/_utils';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * Admin API endpoint to list all LangGraph chat threads
 * Requires admin authentication
 */
export default defineEventHandler(async (event) => {
  try {
    await requireAdminAuth(event);

    // Get query parameters for filtering
    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit as string) : 50;
    const status = query.status as string | undefined;
    const metadata = query.metadata ? JSON.parse(query.metadata as string) : undefined;

    // Create LangGraph client
    const client = createLangGraphClient();

    // Search threads with filters
    const searchParams: any = { limit };
    if (status) searchParams.status = status;
    if (metadata) searchParams.metadata = metadata;

    const threads = await client.threads.search(searchParams);

    // Return threads data
    return {
      success: true,
      threads: threads,
      count: threads.length,
      filters: {
        limit,
        status,
        metadata,
      },
    };
  } catch (error: any) {
    console.error('Error fetching LangGraph threads:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch threads',
      message: error.message,
    });
  }
});
