import type { YoutubeStatsFEResponse, YoutubeStatsResponse } from '../../../data/models/youtube';
import { fetchJsonWithRetry } from '../../utils/fetchJsonWithRetry';

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
