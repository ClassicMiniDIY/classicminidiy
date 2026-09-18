import { runOmnisearch } from '../../utils/omnisearch';
import { serverRuntimeConfig } from '../../utils/runtimeConfig';
import { shadowSearchIntent } from '../../utils/searchTriage';

/**
 * Omnisearch — one query across every surface (design S2/S3).
 *
 * The implementation lives in `server/utils/omnisearch.ts` so the chat agent's
 * `site-search` tool runs the identical search in-process. Keep this handler a
 * thin adapter; logic added here would be invisible to the assistant.
 *
 * The YouTube key is passed here and NOT by the agent: the agent has its own
 * video tool and rail, so only a visitor's search gets the video surface.
 *
 * The TypeSafe intent shadow starts here, beside the search, and is only
 * logged: it never touches the response, and it is not started by the agent's
 * tool either. Design: the private repo's typesafe phase 4 doc.
 */
export default defineEventHandler(async (event) => {
  const { q, limit } = getQuery(event);
  // The event form: on Workers the no-argument form depends on `process.env`
  // being populated before module evaluation, and an empty key here would
  // silently drop the video surface in production while dev looked fine.
  const config = serverRuntimeConfig(event);
  const response = await runOmnisearch(q, limit, { youtubeApiKey: (config.YOUTUBE_API_KEY as string) || '' });
  if (response.query.length >= 2) {
    shadowSearchIntent(event, response.query, { kind: response.intent.kind, lead: response.intent.surfaceOrder[0]! });
  }
  return response;
});
