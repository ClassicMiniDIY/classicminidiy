/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch } = vi.hoisted(() => {
  const mockFetch = vi.fn();
  (globalThis as any).defineEventHandler = (fn: any) => fn;
  (globalThis as any).createError = (opts: any) => {
    const err: any = new Error(opts.statusMessage || opts.message);
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  };
  (globalThis as any).setResponseHeaders = vi.fn();
  (globalThis as any).$fetch = mockFetch;
  return { mockFetch };
});

const manifest = {
  schemaVersion: 1,
  updated: '2026-09-22',
  features: [
    { id: 'ignitionMap', label: 'Ignition Map' },
    { id: 'sixteenVEngine', label: '16V Engine Version' },
  ],
  platforms: [
    {
      id: 'haltech',
      name: 'Haltech',
      directory: 'haltech/',
      features: { ignitionMap: 'included', sixteenVEngine: 'included' },
    },
    {
      id: 'emerald',
      name: 'Emerald',
      directory: 'emerald/',
      features: { ignitionMap: 'included', sixteenVEngine: 'wip' },
    },
  ],
  files: [{ path: 'haltech/R3/5-port/x.nexmap' }],
  diagrams: [{ id: 'tps' }],
};

describe('server/api/github/maps-manifest', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    (globalThis as any).setResponseHeaders = vi.fn();
    handler = (await import('~/server/api/github/maps-manifest')).default;
  });

  it('fetches maps.json from the ClassicMiniDIY repo main branch as JSON', async () => {
    mockFetch.mockResolvedValueOnce(manifest);
    await handler({});
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/ClassicMiniDIY/MiniECUMaps/main/maps.json',
      expect.objectContaining({ responseType: 'json' })
    );
  });

  it('returns features and platforms but not files or diagrams', async () => {
    mockFetch.mockResolvedValueOnce(manifest);
    const result = await handler({});
    expect(result).toEqual({
      updated: '2026-09-22',
      features: manifest.features,
      platforms: [
        { id: 'haltech', name: 'Haltech', features: { ignitionMap: 'included', sixteenVEngine: 'included' } },
        { id: 'emerald', name: 'Emerald', features: { ignitionMap: 'included', sixteenVEngine: 'wip' } },
      ],
    });
  });

  it('parses a text/plain string body', async () => {
    mockFetch.mockResolvedValueOnce(JSON.stringify(manifest));
    const result = await handler({});
    expect(result.platforms).toHaveLength(2);
  });

  it('sets 30 minute cache headers', async () => {
    mockFetch.mockResolvedValueOnce(manifest);
    const event = { id: 'e' };
    await handler(event);
    expect((globalThis as any).setResponseHeaders).toHaveBeenCalledWith(event, {
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      'CDN-Cache-Control': 'public, max-age=1800',
    });
  });

  it('throws 502 when the fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('404 Not Found'));
    await expect(handler({})).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws 502 on an unsupported schemaVersion', async () => {
    mockFetch.mockResolvedValueOnce({ ...manifest, schemaVersion: 2 });
    await expect(handler({})).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: expect.stringContaining('schemaVersion 2'),
    });
  });

  it('serves a second request from the per-instance cache', async () => {
    mockFetch.mockResolvedValueOnce(manifest);
    await handler({});
    const result = await handler({});
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.platforms).toHaveLength(2);
  });

  it('does not set the 30 minute cache headers on a 502', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    await expect(handler({})).rejects.toMatchObject({ statusCode: 502 });
    expect((globalThis as any).setResponseHeaders).not.toHaveBeenCalled();
  });

  it('serves the last good manifest when a refresh fails', async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockResolvedValueOnce(manifest);
      await handler({});
      vi.advanceTimersByTime(31 * 60 * 1000);
      mockFetch.mockRejectedValueOnce(new Error('429 Too Many Requests'));
      const event = { id: 'stale' };
      const result = await handler(event);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.platforms).toHaveLength(2);
      expect((globalThis as any).setResponseHeaders).toHaveBeenLastCalledWith(event, {
        'Cache-Control': 'public, max-age=60',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws 502 when features or platforms are missing', async () => {
    mockFetch.mockResolvedValueOnce({ schemaVersion: 1, features: [] });
    await expect(handler({})).rejects.toMatchObject({ statusCode: 502 });
  });
});
