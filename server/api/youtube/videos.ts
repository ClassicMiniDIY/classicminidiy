import axios from 'axios';
import type { YoutubeDataResponse, YoutubeThumbnails, YoutubeThumbnailsParsed } from '../../../data/models/youtube';
import * as _ from 'lodash';
import { DateTime } from 'luxon';

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
  const feed = `${baseURL}?key=${config.youtubeAPIKey}&playlistId=${id}&part=${details}&maxResults=${fetchCount}`;

  // Set cache headers - cache for 1 hour since YouTube content changes more frequently
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'CDN-Cache-Control': 'public, max-age=3600',
  });

  try {
    // Create axios instance with timeout and retry config
    const axiosInstance = axios.create({
      timeout: 5000, // 5 second timeout
    });

    // Implement retry logic
    let retries = 0;
    const maxRetries = 3;
    let response;

    while (retries < maxRetries) {
      try {
        response = await axiosInstance.get<YoutubeDataResponse>(feed);
        break; // Success, exit retry loop
      } catch (retryError) {
        retries++;
        if (retries >= maxRetries) {
          throw retryError; // Max retries reached, rethrow
        }
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }

    if (!response || !response.data || !response.data.items) {
      throw new Error('Invalid response from YouTube API');
    }

    const items = response.data.items
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
      statusCode: error.response?.status || 500,
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
