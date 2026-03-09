import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, mockSession } from '../../setup/mockSupabase';
import { cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

// Capture the onRequest hook so tests can invoke it directly
let capturedOnRequest: ((ctx: { options: any }) => Promise<void>) | undefined;

beforeEach(() => {
  vi.resetModules();
  (global as any).__resetNuxtState();

  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);

  capturedOnRequest = undefined;

  // Override the global useFetch mock to capture options passed to it
  (global as any).useFetch = vi.fn((url: string, opts: Record<string, any>) => {
    capturedOnRequest = opts?.onRequest;
    return { data: { value: null }, pending: { value: false }, error: { value: null }, refresh: vi.fn() };
  });

  // Reset $fetch to a clean mock
  (global as any).$fetch = vi.fn().mockResolvedValue({});
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useAdminFetch()', () => {
  it('delegates to useFetch', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    expect((global as any).useFetch).toHaveBeenCalledTimes(1);
  });

  it('passes the url through to useFetch', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/queue');

    const [calledUrl] = (global as any).useFetch.mock.calls[0];
    expect(calledUrl).toBe('/api/admin/queue');
  });

  it('always sets server:false to skip SSR', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    const [, opts] = (global as any).useFetch.mock.calls[0];
    expect(opts.server).toBe(false);
  });

  it('merges caller-supplied options into the useFetch call', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test', { method: 'POST', lazy: true, key: 'my-key' });

    const [, opts] = (global as any).useFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.lazy).toBe(true);
    expect(opts.key).toBe('my-key');
    // server:false still present despite spread
    expect(opts.server).toBe(false);
  });

  it('attaches an onRequest hook', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    const [, opts] = (global as any).useFetch.mock.calls[0];
    expect(typeof opts.onRequest).toBe('function');
  });

  it('onRequest sets Authorization header when session has an access_token', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    expect(capturedOnRequest).toBeDefined();

    const mockOptions: { headers: Headers } = { headers: new Headers() };
    await capturedOnRequest!({ options: mockOptions });

    expect(mockOptions.headers.get('Authorization')).toBe(`Bearer ${mockSession.access_token}`);
  });

  it('onRequest creates a new Headers instance from existing headers', async () => {
    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    const mockOptions: { headers: any } = {
      headers: { 'X-Custom-Header': 'custom-value' },
    };
    await capturedOnRequest!({ options: mockOptions });

    // Should be a Headers instance after the hook runs
    expect(mockOptions.headers).toBeInstanceOf(Headers);
    expect(mockOptions.headers.get('Authorization')).toBe(`Bearer ${mockSession.access_token}`);
  });

  it('onRequest does NOT set Authorization header when session has no access_token', async () => {
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: null } },
      error: null,
    });

    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    const mockOptions: { headers: Headers } = { headers: new Headers() };
    await capturedOnRequest!({ options: mockOptions });

    expect(mockOptions.headers.has('Authorization')).toBe(false);
  });

  it('onRequest does NOT set Authorization header when session is null', async () => {
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');

    useAdminFetch('/api/admin/test');

    const mockOptions: { headers: Headers } = { headers: new Headers() };
    await capturedOnRequest!({ options: mockOptions });

    expect(mockOptions.headers.has('Authorization')).toBe(false);
  });

  it('returns the result of useFetch', async () => {
    const mockReturn = {
      data: { value: [{ id: 1 }] },
      pending: { value: false },
      error: { value: null },
      refresh: vi.fn(),
    };
    (global as any).useFetch = vi.fn().mockReturnValue(mockReturn);

    const { useAdminFetch } = await import('~/app/composables/useAdminFetch');
    const result = useAdminFetch('/api/admin/test');

    expect(result).toEqual(mockReturn);
  });
});

describe('$adminFetch()', () => {
  it('delegates to $fetch with the provided url', async () => {
    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/queue');

    expect((global as any).$fetch).toHaveBeenCalledTimes(1);
    const [calledUrl] = (global as any).$fetch.mock.calls[0];
    expect(calledUrl).toBe('/api/admin/queue');
  });

  it('includes Authorization header when session has an access_token', async () => {
    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/test');

    const [, opts] = (global as any).$fetch.mock.calls[0];
    expect(opts.headers).toMatchObject({
      Authorization: `Bearer ${mockSession.access_token}`,
    });
  });

  it('omits Authorization header when session has no access_token', async () => {
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: null } },
      error: null,
    });

    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/test');

    const [, opts] = (global as any).$fetch.mock.calls[0];
    expect(opts.headers).not.toHaveProperty('Authorization');
  });

  it('omits Authorization header when session is null', async () => {
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/test');

    const [, opts] = (global as any).$fetch.mock.calls[0];
    expect(opts.headers).not.toHaveProperty('Authorization');
  });

  it('merges caller-supplied headers with the Authorization header', async () => {
    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/test', {
      headers: { 'X-Request-ID': 'req-123', 'Content-Type': 'application/json' },
    });

    const [, opts] = (global as any).$fetch.mock.calls[0];
    expect(opts.headers).toMatchObject({
      'X-Request-ID': 'req-123',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mockSession.access_token}`,
    });
  });

  it('merges other caller-supplied options through to $fetch', async () => {
    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/queue', { method: 'POST', body: { action: 'approve' } });

    const [, opts] = (global as any).$fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toEqual({ action: 'approve' });
  });

  it('returns the value resolved by $fetch', async () => {
    const payload = { id: 'result-1', status: 'approved' };
    (global as any).$fetch = vi.fn().mockResolvedValue(payload);

    const { $adminFetch } = await import('~/app/composables/useAdminFetch');
    const result = await $adminFetch<typeof payload>('/api/admin/test');

    expect(result).toEqual(payload);
  });

  it('propagates errors thrown by $fetch', async () => {
    (global as any).$fetch = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await expect($adminFetch('/api/admin/test')).rejects.toThrow('Unauthorized');
  });

  it('Authorization header from session takes precedence over a caller-supplied Authorization header', async () => {
    const { $adminFetch } = await import('~/app/composables/useAdminFetch');

    await $adminFetch('/api/admin/test', {
      headers: { Authorization: 'Bearer caller-token' },
    });

    const [, opts] = (global as any).$fetch.mock.calls[0];
    // The session token spread after opts.headers, so it wins
    expect(opts.headers.Authorization).toBe(`Bearer ${mockSession.access_token}`);
  });
});
