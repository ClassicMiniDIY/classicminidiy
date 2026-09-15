import { runOmnisearch } from '../../utils/omnisearch';

/**
 * Omnisearch — one query across every surface (design S2/S3).
 *
 * The implementation lives in `server/utils/omnisearch.ts` so the chat agent's
 * `site-search` tool runs the identical search in-process. Keep this handler a
 * thin adapter; logic added here would be invisible to the assistant.
 *
 * The YouTube key is passed here and NOT by the agent: the agent has its own
 * video tool and rail, so only a visitor's search gets the video surface.
 */
export default defineEventHandler(async (event) => {
  const { q, limit } = getQuery(event);
  const config = useRuntimeConfig();
  return runOmnisearch(q, limit, { youtubeApiKey: (config.YOUTUBE_API_KEY as string) || '' });
});
