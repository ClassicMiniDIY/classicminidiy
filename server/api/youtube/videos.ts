import type { YoutubeDataResponse, YoutubeThumbnails, YoutubeThumbnailsParsed } from '../../../data/models/youtube';
import * as _ from 'lodash';
import { DateTime } from 'luxon';

/**
 * Fetch JSON with a timeout and bounded retries.
 *
 * Replaces axios. axios routes through Node's `http`/`https` modules, which
 * nitropack lists in `unsupportedNodeModules` and unenv stubs on workerd — so on
 * Cloudflare Workers every call threw and this endpoint returned 500, while the
 * identical code kept working on Vercel. `$fetch` (ofetch) is platform-neutral
 * and behaves the same on Node and on workerd.
 *
 * Same failure class as the AWS SDK removal: a Node-transport HTTP client cannot
 * run in a worker. New server routes should use `$fetch`.
 */
async function fetchJsonWithRetry<T>(url: string, timeoutMs = 5000, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await $fetch<T>(url, { timeout: timeoutMs, retry: 0 });
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt + 1)));
    }
  }
  throw lastError;
}


export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const baseURL = 'https://www.googleapis.com/youtube/v3/playlistItems';
  const id = 'UUZIUfOFhrQ9nrR06IOoAJ2Q';
  const details = 'snippet';
  const query = getQuery(event);
  const requestedLimit = Number(query.limit);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit >= 1 ? Math.min(Math.trunc(requestedLimit), 50) : 3;
  // Fetch a buffer beyond the requested limit: the uploads playlist isn't
  // guaranteed to be returned newest-first, so the latest upload could fall
  // outside the first `limit` results. Sort the full buffer, then slice.
  const fetchCount = Math.min(Math.max(limit, 20), 50);
  const feed = `${baseURL}?key=${config.YOUTUBE_API_KEY}&playlistId=${id}&part=${details}&maxResults=${fetchCount}`;

  // Set cache headers - cache for 1 hour since YouTube content changes more frequently
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'CDN-Cache-Control': 'public, max-age=3600',
  });

  try {
      const data = await fetchJsonWithRetry<YoutubeDataResponse>(feed);

    if (!data || !data.items) {
      throw new Error('Invalid response from YouTube API');
    }

    const items = data.items
      // ISO 8601 timestamps sort lexicographically, so localeCompare orders newest-first.
      .sort((a, b) => b.snippet.publishedAt.localeCompare(a.snippet.publishedAt))
      .map((item) => ({
        title: item.snippet.title,
        thumbnails: organizeThumbnails(item.snippet.thumbnails),
        publishedOn: DateTime.fromISO(item.snippet.publishedAt).toFormat('LLL dd, yyyy'),
        videoUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      }));
    return items.slice(0, limit);
  } catch (error: any) {
    console.error('YouTube API error:', error);
    // Return a fallback or cached response if available
    throw createError({
      statusCode: error?.statusCode || error?.response?.status || 500,
      statusMessage: `Error with YouTube API: ${error.message || 'Unknown error'}`,
    });
  }

  function organizeThumbnails(thumbs: YoutubeThumbnails): YoutubeThumbnailsParsed {
    const defaultThumb = thumbs.default?.url || '';
    const standardThumb = thumbs.standard?.url || defaultThumb;
    return {
      default: defaultThumb,
      medium: thumbs.medium?.url || defaultThumb,
      high: thumbs.high?.url || defaultThumb,
      standard: standardThumb,
      maxres: thumbs.maxres?.url || standardThumb,
    };
  }
});
