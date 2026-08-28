import type { YoutubeStatsFEResponse, YoutubeStatsResponse } from '../../../data/models/youtube';

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
  const baseURL = 'https://www.googleapis.com/youtube/v3/channels';
  const id = 'UCZIUfOFhrQ9nrR06IOoAJ2Q';
  const details = 'snippet,contentDetails,statistics';
  const feed = `${baseURL}?key=${config.YOUTUBE_API_KEY}&id=${id}&part=${details}`;

  // Set cache headers - cache for 1 hour since YouTube stats change more frequently
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'CDN-Cache-Control': 'public, max-age=3600',
  });

  try {
      const data = await fetchJsonWithRetry<YoutubeStatsResponse>(feed);

    if (!data || !data.items || !data.items[0]) {
      throw new Error('Invalid response from YouTube API');
    }

    const items = data.items[0].statistics;
    const niceResponse: YoutubeStatsFEResponse = {
      views: Number(items.viewCount).toLocaleString(),
      subscribers: Number(items.subscriberCount).toLocaleString(),
      videos: Number(items.videoCount).toLocaleString(),
    };
    return niceResponse;
  } catch (error: any) {
    console.error('YouTube stats API error:', error);
    throw createError({
      statusCode: error?.statusCode || error?.response?.status || 500,
      statusMessage: `Error with YouTube stats API: ${error.message || 'Unknown error'}`,
    });
  }
});
