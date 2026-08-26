import axios from 'axios';
import type { YoutubeStatsFEResponse, YoutubeStatsResponse } from '../../../data/models/youtube';

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
    // Create axios instance with timeout
    const axiosInstance = axios.create({
      timeout: 5000, // 5 second timeout
    });

    // Implement retry logic
    let retries = 0;
    const maxRetries = 3;
    let response;

    while (retries < maxRetries) {
      try {
        response = await axiosInstance.get<YoutubeStatsResponse>(feed);
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

    if (!response || !response.data || !response.data.items || !response.data.items[0]) {
      throw new Error('Invalid response from YouTube API');
    }

    const items = response.data.items[0].statistics;
    const niceResponse: YoutubeStatsFEResponse = {
      views: Number(items.viewCount).toLocaleString(),
      subscribers: Number(items.subscriberCount).toLocaleString(),
      videos: Number(items.videoCount).toLocaleString(),
    };
    return niceResponse;
  } catch (error: any) {
    console.error('YouTube stats API error:', error);
    throw createError({
      statusCode: error.response?.status || 500,
      statusMessage: `Error with YouTube stats API: ${error.message || 'Unknown error'}`,
    });
  }
});
