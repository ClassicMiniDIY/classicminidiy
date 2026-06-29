/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { caminoFetch } from '~~/server/utils/exchange/camino';

const CAMINO_API_BASE = 'https://api.getcamino.ai';

// Build a runtimeConfig stub that mirrors vitest.setup.ts's public defaults but
// lets us control the private `caminoApiKey` per test (the global stub does NOT
// include it).
function stubRuntimeConfig(caminoApiKey: unknown) {
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: {
      siteUrl: 'https://www.classicminidiy.com',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-anon-key',
    },
    caminoApiKey,
  }));
}

describe('caminoFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // $fetch is the global Nuxt helper the source calls. Default to resolving
    // an empty object; individual tests override the resolved/rejected value.
    fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal('$fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('missing / falsy API key (graceful failure invariant)', () => {
    it('throws a descriptive error when caminoApiKey is undefined', async () => {
      stubRuntimeConfig(undefined);
      await expect(caminoFetch('/relationship')).rejects.toThrow('CAMINO_API_KEY is not configured');
    });

    it('throws when caminoApiKey is missing from the config entirely', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://x' } }));
      await expect(caminoFetch('/relationship')).rejects.toThrow('CAMINO_API_KEY is not configured');
    });

    it('throws when caminoApiKey is an empty string (falsy)', async () => {
      stubRuntimeConfig('');
      await expect(caminoFetch('/query')).rejects.toThrow('CAMINO_API_KEY is not configured');
    });

    it('throws when caminoApiKey is null', async () => {
      stubRuntimeConfig(null);
      await expect(caminoFetch('/query')).rejects.toThrow('CAMINO_API_KEY is not configured');
    });

    it('does NOT call $fetch when the key is missing (fails before the network)', async () => {
      stubRuntimeConfig(undefined);
      await expect(caminoFetch('/relationship')).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('successful GET requests', () => {
    beforeEach(() => stubRuntimeConfig('test-camino-key'));

    it('returns the parsed JSON payload from $fetch', async () => {
      const payload = { results: [{ name: 'Garage', lat: 51.5, lon: -0.1 }], answer: 'found one' };
      fetchMock.mockResolvedValueOnce(payload);

      const result = await caminoFetch('/query');
      expect(result).toEqual(payload);
    });

    it('defaults to the GET method when no method is provided', async () => {
      fetchMock.mockResolvedValueOnce({ ok: 1 });
      await caminoFetch('/relationship');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('GET');
    });

    it('builds the URL from the API base + endpoint', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/relationship');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${CAMINO_API_BASE}/relationship`);
    });

    it('omits the body for GET requests (no body option provided)', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/query');

      const [, options] = fetchMock.mock.calls[0];
      expect(options).not.toHaveProperty('body');
    });
  });

  describe('request shape: API key header', () => {
    it('sends the API key in the X-API-Key header', async () => {
      stubRuntimeConfig('super-secret-key');
      fetchMock.mockResolvedValueOnce({});

      await caminoFetch('/query');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toEqual({ 'X-API-Key': 'super-secret-key' });
    });

    it('uses the exact key value from runtimeConfig (no transformation)', async () => {
      stubRuntimeConfig('  spaced-key  ');
      fetchMock.mockResolvedValueOnce({});

      await caminoFetch('/relationship');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-API-Key']).toBe('  spaced-key  ');
    });
  });

  describe('query params', () => {
    beforeEach(() => stubRuntimeConfig('k'));

    it('appends string params to the URL query string', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/query', { params: { q: 'classic mini garage' } });

      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(`${CAMINO_API_BASE}/query`);
      expect(parsed.searchParams.get('q')).toBe('classic mini garage');
    });

    it('stringifies number and boolean params', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/relationship', {
        params: { lat: 51.5074, lon: -0.1278, limit: 5, verbose: true, exclude: false },
      });

      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.searchParams.get('lat')).toBe('51.5074');
      expect(parsed.searchParams.get('lon')).toBe('-0.1278');
      expect(parsed.searchParams.get('limit')).toBe('5');
      expect(parsed.searchParams.get('verbose')).toBe('true');
      expect(parsed.searchParams.get('exclude')).toBe('false');
    });

    it('sets multiple params and preserves all of them', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/query', { params: { a: '1', b: '2', c: '3' } });

      const [url] = fetchMock.mock.calls[0];
      const parsed = new URL(url);
      expect([...parsed.searchParams.entries()].sort()).toEqual([
        ['a', '1'],
        ['b', '2'],
        ['c', '3'],
      ]);
    });

    it('produces no query string when params is omitted', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/relationship');

      const [url] = fetchMock.mock.calls[0];
      expect(url).not.toContain('?');
    });

    it('URL-encodes special characters in param values', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/query', { params: { q: 'a&b=c d' } });

      const [url] = fetchMock.mock.calls[0];
      // raw URL string should be percent-encoded...
      expect(url).toContain('q=a%26b%3Dc+d');
      // ...and decode back to the original value.
      expect(new URL(url).searchParams.get('q')).toBe('a&b=c d');
    });
  });

  describe('POST requests with a body', () => {
    beforeEach(() => stubRuntimeConfig('k'));

    it('forwards the method and body to $fetch', async () => {
      const body = { query: 'find garages', location: { lat: 51.5, lon: -0.1 } };
      fetchMock.mockResolvedValueOnce({ results: [] });

      await caminoFetch('/query', { method: 'POST', body });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`${CAMINO_API_BASE}/query`);
      expect(options.method).toBe('POST');
      expect(options.body).toEqual(body);
      expect(options.headers).toEqual({ 'X-API-Key': 'k' });
    });

    it('supports POST with both params and body simultaneously', async () => {
      const body = { foo: 'bar' };
      fetchMock.mockResolvedValueOnce({});

      await caminoFetch('/query', { method: 'POST', params: { v: '2' }, body });

      const [url, options] = fetchMock.mock.calls[0];
      expect(new URL(url).searchParams.get('v')).toBe('2');
      expect(options.method).toBe('POST');
      expect(options.body).toEqual(body);
    });

    it('omits the body when an empty body is not supplied for POST', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/query', { method: 'POST' });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options).not.toHaveProperty('body');
    });

    it('includes a falsy-but-present body object (empty object) — empty {} is truthy', async () => {
      fetchMock.mockResolvedValueOnce({});
      await caminoFetch('/query', { method: 'POST', body: {} });

      const [, options] = fetchMock.mock.calls[0];
      // An empty object is truthy, so the spread `...(body ? { body } : {})` includes it.
      expect(options).toHaveProperty('body');
      expect(options.body).toEqual({});
    });
  });

  describe('non-ok / error response handling', () => {
    beforeEach(() => stubRuntimeConfig('k'));

    it('propagates errors thrown by $fetch (ofetch rejects on non-2xx)', async () => {
      // ofetch's $fetch throws a FetchError on non-ok responses; the source does
      // not catch it, so the rejection should bubble straight up to the caller.
      const fetchError = Object.assign(new Error('[GET] "https://api.getcamino.ai/query": 500 Internal Server Error'), {
        status: 500,
        statusText: 'Internal Server Error',
      });
      fetchMock.mockRejectedValueOnce(fetchError);

      await expect(caminoFetch('/query')).rejects.toBe(fetchError);
    });

    it('propagates a 401 (bad API key) error unchanged', async () => {
      const err = Object.assign(new Error('401 Unauthorized'), { status: 401 });
      fetchMock.mockRejectedValueOnce(err);

      await expect(caminoFetch('/relationship')).rejects.toThrow('401 Unauthorized');
    });

    it('propagates a 404 error unchanged', async () => {
      const err = Object.assign(new Error('404 Not Found'), { status: 404 });
      fetchMock.mockRejectedValueOnce(err);

      await expect(caminoFetch('/missing')).rejects.toThrow('404 Not Found');
    });

    it('propagates a network failure (DNS / connection refused)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fetch failed'));
      await expect(caminoFetch('/query')).rejects.toThrow('fetch failed');
    });

    it('still attempted the request with the key before failing', async () => {
      fetchMock.mockRejectedValueOnce(new Error('boom'));
      await expect(caminoFetch('/query')).rejects.toThrow('boom');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['X-API-Key']).toBe('k');
    });
  });

  describe('generic typing / return passthrough', () => {
    beforeEach(() => stubRuntimeConfig('k'));

    it('returns whatever $fetch resolves, including primitives', async () => {
      fetchMock.mockResolvedValueOnce('plain-string');
      const result = await caminoFetch<string>('/echo');
      expect(result).toBe('plain-string');
    });

    it('returns null when $fetch resolves null', async () => {
      fetchMock.mockResolvedValueOnce(null);
      const result = await caminoFetch('/query');
      expect(result).toBeNull();
    });

    it('returns a typed relationship-shaped object verbatim', async () => {
      const rel = {
        distance: '5 km',
        direction: 'north',
        walking_time: '1h',
        actual_distance_km: 5,
        duration_seconds: 3600,
        driving_time: '10m',
        description: 'nearby',
      };
      fetchMock.mockResolvedValueOnce(rel);

      const result = await caminoFetch('/relationship');
      expect(result).toEqual(rel);
    });
  });

  describe('config read freshness', () => {
    it('reads the key on every call (not cached at module load)', async () => {
      // First call with no key -> throws.
      stubRuntimeConfig(undefined);
      await expect(caminoFetch('/query')).rejects.toThrow('CAMINO_API_KEY is not configured');

      // Re-stub with a key -> now succeeds.
      stubRuntimeConfig('late-key');
      fetchMock.mockResolvedValueOnce({ ok: true });
      const result = await caminoFetch('/query');
      expect(result).toEqual({ ok: true });

      const [, options] = fetchMock.mock.calls.at(-1)!;
      expect(options.headers['X-API-Key']).toBe('late-key');
    });
  });
});
