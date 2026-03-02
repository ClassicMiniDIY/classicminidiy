/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock helpers ---
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
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
  })),
);

// Import module under test AFTER mocks are in place
import { requireAdminAuth, isAdminAuthenticated } from '~/server/utils/adminAuth';

// A helper to build a mock H3 event object
function createMockEvent() {
  return { node: { req: {} } } as any;
}

describe('server/utils/adminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdminAuth', () => {
    it('extracts Bearer token from Authorization header', async () => {
      const event = createMockEvent();
      const token = 'my-bearer-token-abc';

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return `Bearer ${token}`;
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'admin@test.com' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      });

      const result = await requireAdminAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-1', email: 'admin@test.com' });
      expect(result.profile).toEqual({ is_admin: true });
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
      mockSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      });

      const result = await requireAdminAuth(event);

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
      mockSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      });

      const result = await requireAdminAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-3' });
    });

    it('throws 401 when no token is found (no header, no cookie)', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation(() => undefined);

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('throws 401 when token is invalid (getUser fails)', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer bad-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
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

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid or expired session',
      });
    });

    it('throws 403 when user exists but is not admin', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer valid-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-regular', email: 'user@test.com' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { is_admin: false },
        error: null,
      });

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Admin access required',
      });
    });

    it('throws 403 when profile query returns an error', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer valid-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-err' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' },
      });

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Admin access required',
      });
    });

    it('returns { user, profile } on success', async () => {
      const event = createMockEvent();
      const user = { id: 'admin-user', email: 'admin@example.com' };
      const profile = { is_admin: true };

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer good-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: profile,
        error: null,
      });

      const result = await requireAdminAuth(event);

      expect(result).toEqual({ user, profile });
      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockSelect).toHaveBeenCalledWith('is_admin');
      expect(mockEq).toHaveBeenCalledWith('id', 'admin-user');
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
      mockSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      });

      await requireAdminAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(bearerToken);
    });

    it('throws 401 when cookie contains invalid JSON', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return 'sb-ref-auth-token=not-valid-json';
        return undefined;
      });

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });
    });

    it('throws 401 when cookie header is empty', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return undefined;
        if (name === 'cookie') return '';
        return undefined;
      });

      await expect(requireAdminAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });
    });
  });

  describe('isAdminAuthenticated', () => {
    it('returns true when requireAdminAuth succeeds', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer admin-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'admin-id' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { is_admin: true },
        error: null,
      });

      const result = await isAdminAuthenticated(event);
      expect(result).toBe(true);
    });

    it('returns false when no token is found', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation(() => undefined);

      const result = await isAdminAuthenticated(event);
      expect(result).toBe(false);
    });

    it('returns false when user is not admin', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer some-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'non-admin' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { is_admin: false },
        error: null,
      });

      const result = await isAdminAuthenticated(event);
      expect(result).toBe(false);
    });

    it('returns false when getUser returns an error', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer broken-token';
        return undefined;
      });

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const result = await isAdminAuthenticated(event);
      expect(result).toBe(false);
    });
  });
});
