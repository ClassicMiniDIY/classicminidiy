/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock setup so it runs before any imports
const { mockAxiosGet } = vi.hoisted(() => {
  const mockAxiosGet = vi.fn();

  // Nitro globals
  (globalThis as any).defineEventHandler = (fn: any) => fn;
  (globalThis as any).createError = (opts: any) => {
    const err: any = new Error(opts.statusMessage || opts.message);
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  };
  (globalThis as any).useRuntimeConfig = () => ({
    youtubeAPIKey: 'test-yt-key',
  });
  (globalThis as any).setResponseHeaders = vi.fn();

  return { mockAxiosGet };
});

vi.mock('axios', () => ({
  default: {
    create: () => ({ get: mockAxiosGet }),
  },
}));

vi.mock('lodash', () => ({
  default: {},
}));

// Override setTimeout so retry backoff resolves immediately
const originalSetTimeout = globalThis.setTimeout;
function patchSetTimeout() {
  (globalThis as any).setTimeout = (fn: Function, _ms?: number) => {
    return originalSetTimeout(fn, 0);
  };
}
function restoreSetTimeout() {
  globalThis.setTimeout = originalSetTimeout;
}

// ─── YouTube Stats ───────────────────────────────────────────────────────────

describe('server/api/youtube/stats', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    patchSetTimeout();
    mockAxiosGet.mockReset();
    (globalThis as any).setResponseHeaders = vi.fn();

    const mod = await import('~/server/api/youtube/stats');
    handler = mod.default;
  });

  afterEach(() => {
    restoreSetTimeout();
    vi.clearAllMocks();
  });

  function makeStatsResponse(viewCount: string, subscriberCount: string, videoCount: string) {
    return {
      data: {
        kind: 'youtube#channelListResponse',
        etag: 'abc',
        pageInfo: { totalResults: 1, resultsPerPage: 5 },
        items: [
          {
            kind: 'youtube#channel',
            etag: 'def',
            id: 'UCZIUfOFhrQ9nrR06IOoAJ2Q',
            statistics: { viewCount, subscriberCount, hiddenSubscriberCount: false, videoCount },
          },
        ],
      },
    };
  }

  it('returns formatted stats with locale strings', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeStatsResponse('1234567', '50000', '250'));
    const result = await handler({});
    expect(result).toEqual({
      views: Number(1234567).toLocaleString(),
      subscribers: Number(50000).toLocaleString(),
      videos: Number(250).toLocaleString(),
    });
  });

  it('formats large view counts with commas', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeStatsResponse('10000000', '100000', '500'));
    const result = await handler({});
    expect(result.views).toBe(Number(10000000).toLocaleString());
  });

  it('formats small counts correctly', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeStatsResponse('100', '50', '5'));
    const result = await handler({});
    expect(result.views).toBe('100');
    expect(result.subscribers).toBe('50');
    expect(result.videos).toBe('5');
  });

  it('sets cache headers on the event', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeStatsResponse('1000', '500', '50'));
    const mockEvent = { id: 'test' };
    await handler(mockEvent);
    expect((globalThis as any).setResponseHeaders).toHaveBeenCalledWith(mockEvent, {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'CDN-Cache-Control': 'public, max-age=3600',
    });
  });

  it('throws when all retries fail', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network error'));
    await expect(handler({})).rejects.toThrow();
  });

  it('throws when response data has empty items array', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { items: [] } });
    await expect(handler({})).rejects.toThrow();
  });

  it('throws when response data is missing items key', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: {} });
    await expect(handler({})).rejects.toThrow();
  });

  it('throws when response data is null', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: null });
    await expect(handler({})).rejects.toThrow();
  });

  it('throws with 500 status on API errors without response status', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network failure'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(500);
      expect(error.statusMessage).toContain('network failure');
    }
  });

  it('throws with API response status code (403)', async () => {
    const apiError: any = new Error('Forbidden');
    apiError.response = { status: 403 };
    mockAxiosGet.mockRejectedValue(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(403);
    }
  });

  it('throws with API response status code (429 rate limit)', async () => {
    const apiError: any = new Error('Too Many Requests');
    apiError.response = { status: 429 };
    mockAxiosGet.mockRejectedValue(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
    }
  });

  it('retries on failure and succeeds on second attempt', async () => {
    mockAxiosGet
      .mockRejectedValueOnce(new Error('transient error'))
      .mockResolvedValueOnce(makeStatsResponse('999', '100', '10'));
    const result = await handler({});
    expect(result.views).toBe('999');
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  it('retries up to 3 times before throwing', async () => {
    mockAxiosGet.mockRejectedValue(new Error('persistent error'));
    await expect(handler({})).rejects.toThrow();
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });

  it('retries on failure and succeeds on third attempt', async () => {
    mockAxiosGet
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce(makeStatsResponse('777', '77', '7'));
    const result = await handler({});
    expect(result.views).toBe('777');
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });

  it('includes error message in thrown error statusMessage', async () => {
    mockAxiosGet.mockRejectedValue(new Error('custom error message'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusMessage).toContain('custom error message');
    }
  });

  it('handles zero counts', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeStatsResponse('0', '0', '0'));
    const result = await handler({});
    expect(result.views).toBe('0');
    expect(result.subscribers).toBe('0');
    expect(result.videos).toBe('0');
  });

  it('returns all three expected keys and no extras', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeStatsResponse('1', '2', '3'));
    const result = await handler({});
    expect(result).toHaveProperty('views');
    expect(result).toHaveProperty('subscribers');
    expect(result).toHaveProperty('videos');
    expect(Object.keys(result)).toHaveLength(3);
  });
});

// ─── YouTube Videos ──────────────────────────────────────────────────────────

describe('server/api/youtube/videos', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    patchSetTimeout();
    mockAxiosGet.mockReset();
    (globalThis as any).setResponseHeaders = vi.fn();

    const mod = await import('~/server/api/youtube/videos');
    handler = mod.default;
  });

  afterEach(() => {
    restoreSetTimeout();
    vi.clearAllMocks();
  });

  function makeVideoItem(title: string, videoId: string, publishedAt: string, thumbnails?: any) {
    return {
      kind: 'youtube#playlistItem',
      etag: 'etag-' + videoId,
      id: videoId,
      snippet: {
        publishedAt,
        channelId: 'UCZIUfOFhrQ9nrR06IOoAJ2Q',
        title,
        description: 'Test description',
        thumbnails: thumbnails || {
          default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg`, width: 120, height: 90 },
          standard: { url: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`, width: 640, height: 480 },
          medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 },
          high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
          maxres: { url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
        },
        channelTitle: 'Classic Mini DIY',
        playlistId: 'UUZIUfOFhrQ9nrR06IOoAJ2Q',
        position: 0,
        resourceId: { kind: 'youtube#video', videoId },
        videoOwnerChannelTitle: 'Classic Mini DIY',
        videoOwnerChannelId: 'UCZIUfOFhrQ9nrR06IOoAJ2Q',
      },
    };
  }

  function makeVideosResponse(items: any[]) {
    return {
      data: {
        kind: 'youtube#playlistItemListResponse',
        etag: 'resp-etag',
        nextPageToken: 'TOKEN',
        items,
        pageInfo: { totalResults: items.length, resultsPerPage: 5 },
      },
    };
  }

  it('returns at most 3 videos when more are available', async () => {
    const items = [
      makeVideoItem('Video 1', 'v1', '2024-01-15T10:00:00Z'),
      makeVideoItem('Video 2', 'v2', '2024-01-16T10:00:00Z'),
      makeVideoItem('Video 3', 'v3', '2024-01-17T10:00:00Z'),
      makeVideoItem('Video 4', 'v4', '2024-01-18T10:00:00Z'),
      makeVideoItem('Video 5', 'v5', '2024-01-19T10:00:00Z'),
    ];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result).toHaveLength(3);
  });

  it('returns fewer than 3 when only 2 items exist', async () => {
    const items = [
      makeVideoItem('Video 1', 'v1', '2024-01-15T10:00:00Z'),
      makeVideoItem('Video 2', 'v2', '2024-01-16T10:00:00Z'),
    ];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result).toHaveLength(2);
  });

  it('returns exactly 3 when exactly 3 items exist', async () => {
    const items = [
      makeVideoItem('V1', 'a1', '2024-01-01T00:00:00Z'),
      makeVideoItem('V2', 'a2', '2024-01-02T00:00:00Z'),
      makeVideoItem('V3', 'a3', '2024-01-03T00:00:00Z'),
    ];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result).toHaveLength(3);
  });

  it('each video has title, thumbnails, publishedOn, and videoUrl', async () => {
    const items = [makeVideoItem('My Mini Video', 'abc123', '2024-03-20T15:30:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    const video = result[0];
    expect(video).toHaveProperty('title', 'My Mini Video');
    expect(video).toHaveProperty('thumbnails');
    expect(video).toHaveProperty('publishedOn');
    expect(video).toHaveProperty('videoUrl');
  });

  it('videoUrl is correctly formatted with videoId', async () => {
    const items = [makeVideoItem('Test', 'XyZ_123', '2024-01-01T00:00:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result[0].videoUrl).toBe('https://www.youtube.com/watch?v=XyZ_123');
  });

  it('publishedOn is formatted as "LLL dd, yyyy" (e.g. Jan 15, 2024)', async () => {
    const items = [makeVideoItem('Test', 'v1', '2024-01-15T10:00:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result[0].publishedOn).toBe('Jan 15, 2024');
  });

  it('formats December date correctly', async () => {
    // Use midday UTC to avoid timezone day-shift issues
    const items = [makeVideoItem('Test', 'v1', '2023-12-25T12:00:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result[0].publishedOn).toBe('Dec 25, 2023');
  });

  it('formats June date correctly', async () => {
    const items = [makeVideoItem('Test', 'v1', '2025-06-01T12:00:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result[0].publishedOn).toBe('Jun 01, 2025');
  });

  it('thumbnails are organized with all five sizes', async () => {
    const items = [makeVideoItem('Test', 'v1', '2024-01-01T00:00:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    const thumbs = result[0].thumbnails;
    expect(thumbs).toHaveProperty('default');
    expect(thumbs).toHaveProperty('medium');
    expect(thumbs).toHaveProperty('high');
    expect(thumbs).toHaveProperty('standard');
    expect(thumbs).toHaveProperty('maxres');
  });

  it('thumbnail URLs match the input when all sizes provided', async () => {
    const items = [makeVideoItem('Test', 'vid1', '2024-01-01T00:00:00Z')];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    const thumbs = result[0].thumbnails;
    expect(thumbs.default).toBe('https://i.ytimg.com/vi/vid1/default.jpg');
    expect(thumbs.medium).toBe('https://i.ytimg.com/vi/vid1/mqdefault.jpg');
    expect(thumbs.high).toBe('https://i.ytimg.com/vi/vid1/hqdefault.jpg');
    expect(thumbs.standard).toBe('https://i.ytimg.com/vi/vid1/sddefault.jpg');
    expect(thumbs.maxres).toBe('https://i.ytimg.com/vi/vid1/maxresdefault.jpg');
  });

  it('medium and high fall back to default when missing', async () => {
    const thumbnails = {
      default: { url: 'https://default.jpg', width: 120, height: 90 },
      standard: { url: 'https://standard.jpg', width: 640, height: 480 },
    };
    const items = [makeVideoItem('Test', 'v1', '2024-01-01T00:00:00Z', thumbnails)];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    const thumbs = result[0].thumbnails;
    expect(thumbs.medium).toBe('https://default.jpg');
    expect(thumbs.high).toBe('https://default.jpg');
  });

  it('maxres falls back to standard when maxres is missing', async () => {
    const thumbnails = {
      default: { url: 'https://default.jpg', width: 120, height: 90 },
      standard: { url: 'https://standard.jpg', width: 640, height: 480 },
    };
    const items = [makeVideoItem('Test', 'v1', '2024-01-01T00:00:00Z', thumbnails)];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result[0].thumbnails.maxres).toBe('https://standard.jpg');
  });

  it('standard and maxres fall back to default when both are missing', async () => {
    const thumbnails = {
      default: { url: 'https://default.jpg', width: 120, height: 90 },
    };
    const items = [makeVideoItem('Test', 'v1', '2024-01-01T00:00:00Z', thumbnails)];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    const thumbs = result[0].thumbnails;
    expect(thumbs.standard).toBe('https://default.jpg');
    expect(thumbs.maxres).toBe('https://default.jpg');
  });

  it('all thumbnails fall back to default when only default is provided', async () => {
    const thumbnails = {
      default: { url: 'https://only-default.jpg', width: 120, height: 90 },
    };
    const items = [makeVideoItem('Test', 'v1', '2024-01-01T00:00:00Z', thumbnails)];
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    const thumbs = result[0].thumbnails;
    expect(thumbs.default).toBe('https://only-default.jpg');
    expect(thumbs.medium).toBe('https://only-default.jpg');
    expect(thumbs.high).toBe('https://only-default.jpg');
    expect(thumbs.standard).toBe('https://only-default.jpg');
    expect(thumbs.maxres).toBe('https://only-default.jpg');
  });

  it('sets cache headers on the event', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse([]));
    const mockEvent = { id: 'test' };
    await handler(mockEvent);
    expect((globalThis as any).setResponseHeaders).toHaveBeenCalledWith(mockEvent, {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'CDN-Cache-Control': 'public, max-age=3600',
    });
  });

  it('returns empty array when items is empty', async () => {
    mockAxiosGet.mockResolvedValueOnce(makeVideosResponse([]));
    const result = await handler({});
    expect(result).toEqual([]);
  });

  it('throws when response data has no items key', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: {} });
    await expect(handler({})).rejects.toThrow();
  });

  it('throws when response data is null', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: null });
    await expect(handler({})).rejects.toThrow();
  });

  it('throws with API status code on error (500)', async () => {
    const apiError: any = new Error('Server Error');
    apiError.response = { status: 500 };
    mockAxiosGet.mockRejectedValue(apiError);
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(500);
    }
  });

  it('throws with 500 when error has no response status', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network error'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusCode).toBe(500);
    }
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const items = [makeVideoItem('Retry Success', 'r1', '2024-06-01T00:00:00Z')];
    mockAxiosGet.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(makeVideosResponse(items));
    const result = await handler({});
    expect(result[0].title).toBe('Retry Success');
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  it('retries up to 3 times before throwing', async () => {
    mockAxiosGet.mockRejectedValue(new Error('persistent'));
    await expect(handler({})).rejects.toThrow();
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });

  it('includes error message in the thrown error statusMessage', async () => {
    mockAxiosGet.mockRejectedValue(new Error('specific API failure'));
    try {
      await handler({});
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.statusMessage).toContain('specific API failure');
    }
  });
});
