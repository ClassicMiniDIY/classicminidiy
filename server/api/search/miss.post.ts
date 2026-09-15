import { getServiceClient } from '../../utils/supabase';

/**
 * POST /api/search/miss — a person searched, committed, and got nothing.
 *
 * Feeds `archive_search_misses`, which an admin promotes into public Most
 * Wanted rows. The signal is supposed to mean "a human wanted this and we did
 * not have it", and until this route existed it did not: misses were recorded
 * by the search call itself, on a 180ms debounce, so every pause while typing
 * `bad wolf` produced a row. The client now posts here on a COMMIT only —
 * Enter, a result click, the palette closing, or 1.5s idle — and only when
 * the last response was empty.
 *
 * Nothing here is publicly readable and the RPC clamps the text (3..120
 * chars, whitespace collapsed), so an anonymous caller cannot influence
 * anything a visitor sees. The write rate limit in
 * `server/middleware/rate-limit.ts` covers this like every other POST.
 */
const MAX_QUERY_LENGTH = 120;

export default defineEventHandler(async (event) => {
  const body = await readBody<{ q?: unknown }>(event).catch(() => ({}) as { q?: unknown });
  const query = String(body?.q ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY_LENGTH);

  // Mirrors the RPC's own floor so a rejected call never costs a round trip.
  if (query.length < 3) {
    setResponseStatus(event, 204);
    return null;
  }

  const { error } = await getServiceClient().rpc('record_search_miss', { p_query: query });
  if (error) {
    // Telemetry never surfaces as a failure to the person searching.
    console.error('[search] record_search_miss failed:', error.message);
  }

  setResponseStatus(event, 204);
  return null;
});
