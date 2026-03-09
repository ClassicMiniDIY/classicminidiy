/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock helpers ---
const mockGetUser = vi.fn();

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
};

// Mock the supabase module before importing the module under test
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabaseClient),
}));

// Mock Nitro/H3 globals
vi.stubGlobal('getHeader', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e = new Error(opts.statusMessage || opts.message);
  (e as any).statusCode = opts.statusCode;
  return e;
});
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({
    public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
    SUPABASE_SERVICE_KEY: 'test-service-key',
  }))
);

// Import module under test AFTER mocks are in place
import { requireUserAuth } from '~/server/utils/userAuth';

// A helper to build a mock H3 event object
function createMockEvent() {
  return { node: { req: {} } } as any;
}

describe('server/utils/userAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireUserAuth', () => {
    it('extracts Bearer token from Authorization header', async () => {
      const event = createMockEvent();
      const token = 'my-bearer-token-abc';

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return `Bearer ${token}`;
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'user@test.com' } },
        error: null,
      });

      const result = await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-1', email: 'user@test.com' });
    });

    it('extracts token from Supabase auth cookie (JSON object with access_token)', async () => {
      const event = createMockEvent();
      const token = 'cookie-token-obj';
      const cookieValue = encodeURIComponent(JSON.stringify({ access_token: token }));

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return `sb-testref-auth-token=${cookieValue}; other=value`;
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-2' } },
        error: null,
      });

      const result = await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-2' });
    });

    it('extracts token from Supabase auth cookie (JSON array format)', async () => {
      const event = createMockEvent();
      const token = 'cookie-token-arr';
      const cookieValue = encodeURIComponent(JSON.stringify([token, 'refresh-token', null]));

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return `sb-proj-auth-token=${cookieValue}`;
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-3' } },
        error: null,
      });

      const result = await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-3' });
    });

    it('prefers Bearer token over cookie when both are present', async () => {
      const event = createMockEvent();
      const bearerToken = 'bearer-wins';
      const cookieValue = encodeURIComponent(JSON.stringify({ access_token: 'cookie-loses' }));

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return `Bearer ${bearerToken}`;
        if (name === 'cookie') return `sb-ref-auth-token=${cookieValue}`;
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-bearer' } },
        error: null,
      });

      await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(bearerToken);
    });

    it('throws 401 when no token is found (no header, no cookie)', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation(() => undefined);

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('throws 401 when no Authorization header and empty cookie header', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return '';
        return undefined;
      });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('throws 401 when cookie contains invalid JSON', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return 'sb-ref-auth-token=not-valid-json';
        return undefined;
      });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('throws 401 when cookie has no matching sb- auth-token key', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return 'some-other-cookie=some-value; another=foo';
        return undefined;
      });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });
    });

    it('throws 401 when token is invalid (getUser returns error)', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer bad-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or expired session',
      });
    });

    it('throws 401 when getUser returns no error but user is null', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer some-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or expired session',
      });
    });

    it('returns { user } on successful authentication', async () => {
      const event = createMockEvent();
      const user = { id: 'user-success', email: 'success@example.com' };

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer good-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user },
        error: null,
      });

      const result = await requireUserAuth(event);

      expect(result).toEqual({ user });
      expect(mockGetUser).toHaveBeenCalledWith('good-token');
    });

    it('handles cookie with multiple entries and picks the sb- auth-token key', async () => {
      const event = createMockEvent();
      const token = 'multi-cookie-token';
      const cookieValue = encodeURIComponent(JSON.stringify({ access_token: token }));

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return `session=abc123; csrf=xyz; sb-myproject-auth-token=${cookieValue}; theme=dark`;
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-multi-cookie' } },
        error: null,
      });

      const result = await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-multi-cookie' });
    });

    it('calls getServiceClient to obtain the supabase client', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer test-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-check-client' } },
        error: null,
      });

      const { getServiceClient } = await import('~/server/utils/supabase');

      await requireUserAuth(event);

      expect(getServiceClient).toHaveBeenCalled();
    });
  });
});
