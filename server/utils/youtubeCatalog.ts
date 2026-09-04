import Fuse from 'fuse.js';
import { fetchJsonWithRetry } from './fetchJsonWithRetry';
import { rankByWord } from './fuzzyRank';
import type { YoutubeDataResponse } from '../../data/models/youtube';

/**
 * The whole Classic Mini DIY channel, searchable.
 *
 * `server/api/youtube/videos.ts` fetches the newest three uploads for the
 * homepage rail. That is all the site had, so the assistant could not link
 * Cole's own videos even for questions he has covered on camera — it answered
 * "the archive doesn't have windshield installation instructions" while a video
 * on the subject existed. See
 * `docs/plans/2026-09-04-chat-agent-knowledge-expansion.md`.
 *
 * WHY AN INDEX RATHER THAN THE SEARCH ENDPOINT. YouTube's `search.list` costs
 * 100 quota units per call against a 10,000/day default — roughly 100 chat
 * questions a day before the channel's own homepage rail starts failing. Paging
 * the uploads playlist costs 1 unit per 50 videos, so the entire 466-video
 * channel is ~10 units, fetched twice a day. Search then runs in-process with
 * no quota cost at all, and cannot take the homepage down.
 */

/** The channel's uploads playlist. Same id `server/api/youtube/videos.ts` uses. */
const UPLOADS_PLAYLIST_ID = 'UUZIUfOFhrQ9nrR06IOoAJ2Q';

/** YouTube's per-page maximum. Fewer pages is fewer chances to fail mid-walk. */
const PAGE_SIZE = 50;

/**
 * Hard ceiling on pages walked, so a paging bug cannot spin.
 *
 * 12 pages is 600 videos against a channel of 466 — headroom for growth without
 * being an effectively unbounded loop.
 */
const MAX_PAGES = 12;

/**
 * Descriptions are truncated before they are stored.
 *
 * Cole's descriptions run to affiliate links, chapter lists and social blurbs,
 * often over 2kB. The useful part — what the video actually covers — is at the
 * top. Storing all of it would put ~1MB in KV and make every Fuse match compete
 * against boilerplate that appears in all 466 rows.
 */
const DESCRIPTION_CHARS = 400;

export interface IndexedVideo {
  videoId: string;
  title: string;
  /** Truncated. See DESCRIPTION_CHARS. */
  description: string;
  /** ISO 8601, as YouTube returns it. Formatted at the edge, not here. */
  publishedAt: string;
  /** Highest-quality thumbnail the API offered for this video. */
  thumbnail: string;
  url: string;
}

/**
 * One page of the uploads playlist.
 *
 * Separated from the walk so the retry/one-page failure is testable without
 * standing up a twelve-page fixture.
 */
async function fetchPage(apiKey: string, pageToken: string): Promise<YoutubeDataResponse> {
  const params = new URLSearchParams({
    key: apiKey,
    playlistId: UPLOADS_PLAYLIST_ID,
    part: 'snippet',
    maxResults: String(PAGE_SIZE),
  });
  if (pageToken) params.set('pageToken', pageToken);

  return fetchJsonWithRetry<YoutubeDataResponse>(
    `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`
  );
}

/** Best available thumbnail, largest first, falling back down the ladder. */
function bestThumbnail(thumbs: any): string {
  return (
    thumbs?.maxres?.url ??
    thumbs?.standard?.url ??
    thumbs?.high?.url ??
    thumbs?.medium?.url ??
    thumbs?.default?.url ??
    ''
  );
}

/**
 * Walk every page of the uploads playlist.
 *
 * A page that throws ABORTS the walk rather than returning a partial index,
 * because a partial index is the worst outcome available here: it caches
 * cleanly, looks healthy, and silently makes some of Cole's videos unfindable
 * for the next twelve hours. Throwing means the caller reports degraded and the
 * previous cached index keeps serving.
 */
export async function fetchVideoIndex(apiKey: string): Promise<IndexedVideo[]> {
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not configured');

  const videos: IndexedVideo[] = [];
  let pageToken = '';

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchPage(apiKey, pageToken);
    if (!data?.items) throw new Error('Invalid response from the YouTube API');

    for (const item of data.items) {
      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      // Deleted and private uploads stay in the playlist with no resourceId.
      // They are not an error and must not abort the walk.
      if (!videoId || !snippet?.title) continue;

      videos.push({
        videoId,
        title: snippet.title,
        description: (snippet.description ?? '').slice(0, DESCRIPTION_CHARS),
        // Defaulted, like every other snippet field here. It is typed as a
        // required string but this function already assumes the API can return
        // incomplete snippets — it guards `resourceId` and `title` — and this
        // one is dereferenced by `.localeCompare` in the sort below. An item
        // missing it would throw there, AFTER all ten pages had been fetched,
        // discarding the whole index and leaving `video-search` degraded.
        publishedAt: snippet.publishedAt ?? '',
        thumbnail: bestThumbnail(snippet.thumbnails),
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    pageToken = data.nextPageToken ?? '';
    if (!pageToken) break;

    // The ceiling was reached with pages still to walk. This is the silently
    // partial index the doc comment above calls the worst available outcome, so
    // it must not be silent: the index is still served (better than nothing),
    // but the oldest videos are missing and only this line says so.
    if (page === MAX_PAGES - 1) {
      console.warn(
        `[youtube] uploads playlist exceeded ${MAX_PAGES} pages — index truncated at ${videos.length} videos, oldest uploads are unsearchable. Raise MAX_PAGES.`
      );
    }
  }

  // ISO 8601 sorts lexicographically, so this is newest-first without parsing.
  return videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * The index, cached for twelve hours.
 *
 * `swr` is what keeps a chat turn fast: once the entry is stale the cached copy
 * is served immediately and the ten-page refetch happens behind it, so no
 * visitor ever waits on the walk except the very first one after a deploy.
 *
 * On Cloudflare this lands in the `CACHE` KV namespace, mounted as nitro's
 * `cache` storage in `nuxt.config.ts`. Off Cloudflare it is per-isolate memory,
 * which is correct for local dev and means `bun run dev` pays the walk once.
 */
let cachedIndex: ((apiKey: string) => Promise<IndexedVideo[]>) | null = null;

export function getVideoIndex(apiKey: string): Promise<IndexedVideo[]> {
  /**
   * Built on FIRST CALL, not at module scope.
   *
   * `defineCachedFunction` is a Nitro auto-import. Calling it while the module
   * evaluates means anything that imports this file — including
   * `server/agent/tools.ts`, and therefore the whole agent test suite — throws
   * `defineCachedFunction is not defined` outside a Nitro runtime, before a
   * single test body runs. Deferring it costs one null check per call and lets
   * the tool set be constructed anywhere.
   *
   * Memoised because the helper builds a wrapper that owns the stale-while-
   * revalidate bookkeeping; constructing a fresh one per call would throw that
   * state away and turn `swr` into a plain TTL.
   */
  if (!cachedIndex) {
    cachedIndex = defineCachedFunction(fetchVideoIndex, {
      maxAge: 60 * 60 * 12,
      swr: true,
      group: 'youtube',
      name: 'video-index',
      // The API key is the only argument and must never reach a cache key.
      getKey: () => 'uploads',
    });
  }
  return cachedIndex(apiKey);
}

/** Test seam. Drops the memoised wrapper so a suite can swap the Nitro helper. */
export function resetVideoIndexCache(): void {
  cachedIndex = null;
}

export interface VideoSearchHit extends IndexedVideo {
  /** 0-1, higher is better. Derived from the Fuse distance, not returned by it. */
  score: number;
}

/**
 * Rank the index against a query, scoring each word separately.
 *
 * Title is weighted well above description: Cole titles videos after the job
 * ("How To Replace Your Mini's Windscreen"), while descriptions carry chapter
 * lists and boilerplate that match too readily. `ignoreLocation` matters for the
 * same reason — the useful phrase is rarely at character zero of a description.
 *
 * Ranked WORD BY WORD via `rankByWord`, not as one fuzzy phrase. That is not a
 * refinement — the phrase form was measurably wrong here: "windscreen
 * replacement" ranked a gearbox rebuild first, because its description says
 * "Synchro replacement". See `server/utils/fuzzyRank.ts` for the full argument.
 */
export function searchVideoIndex(index: IndexedVideo[], query: string, limit: number): VideoSearchHit[] {
  if (!index.length) return [];

  const fuse = new Fuse(index, {
    keys: [
      { name: 'title', weight: 0.75 },
      { name: 'description', weight: 0.25 },
    ],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.4,
    minMatchCharLength: 3,
  });

  return (
    rankByWord(fuse, query)
      .map(({ item, score }) => ({ ...item, score }))
      // Newest first among equally good matches. Cole re-covers subjects as the
      // cars age and the tooling changes, so the later video is the better answer.
      .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit)
  );
}
