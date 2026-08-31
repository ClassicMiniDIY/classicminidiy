import { runOmnisearch } from '../../utils/omnisearch';

/**
 * Omnisearch — one query across every surface (design S2/S3).
 *
 * The implementation lives in `server/utils/omnisearch.ts` so the chat agent's
 * `site-search` tool runs the identical search in-process. Keep this handler a
 * thin adapter; logic added here would be invisible to the assistant.
 */
export default defineEventHandler(async (event) => {
  const { q, limit } = getQuery(event);
  return runOmnisearch(q, limit);
});
