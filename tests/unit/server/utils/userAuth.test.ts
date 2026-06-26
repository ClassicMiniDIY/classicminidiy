/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock helpers ---
const mockGetUser = vi.fn();
// Profile lookup for the ban check: requireUserAuth does
// supabase.from('profiles').select('is_banned').eq('id', uid).maybeSingle().
// Default resolves to "no profile row" → treated as not banned (fail-open).
const mockMaybeSingle = vi.fn(async () => ({ data: null, error: null }));

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockMaybeSingle,
      })),
    })),
  })),
};

// Mock the supabase module before importing the module under test
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabaseClient),
  getUserClient: vi.fn(() => mockSupabaseClient),
}));

// Mock Nitro/H3 globals. Cookie parsing now goes through h3's parseCookies
// (auto-imported in Nitro), so the cookie cases stub that instead of the raw header.
vi.stubGlobal('getHeader', vi.fn());
const mockParseCookies = vi.fn(() => ({}) as Record<string, string>);
vi.stubGlobal('parseCookies', mockParseCookies);
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
import { requireUserAuth, _resetBanCache } from '~/server/utils/userAuth';

// A helper to build a mock H3 event object
function createMockEvent() {
  return { node: { req: {} } } as any;
}

describe('server/utils/userAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseCookies.mockReturnValue({});
    // Default: no profile row → not banned. Individual tests override.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    // Prevent the in-memory ban cache from leaking state across tests.
    _resetBanCache();
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

      (getHeader as any).mockReturnValue(undefined);
      // parseCookies returns already URI-decoded values.
      mockParseCookies.mockReturnValue({ 'sb-testref-auth-token': JSON.stringify({ access_token: token }) });

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

      (getHeader as any).mockReturnValue(undefined);
      mockParseCookies.mockReturnValue({ 'sb-proj-auth-token': JSON.stringify([token, 'refresh-token', null]) });

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

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return `Bearer ${bearerToken}`;
        return undefined;
      });
      mockParseCookies.mockReturnValue({ 'sb-ref-auth-token': JSON.stringify({ access_token: 'cookie-loses' }) });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-bearer' } },
        error: null,
      });

      await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(bearerToken);
    });

    it('throws 401 when no token is found (no header, no cookie)', async () => {
      const event = createMockEvent();

      (getHeader as any).mockReturnValue(undefined);
      mockParseCookies.mockReturnValue({});

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('throws 401 when cookie contains invalid JSON', async () => {
      const event = createMockEvent();

      (getHeader as any).mockReturnValue(undefined);
      mockParseCookies.mockReturnValue({ 'sb-ref-auth-token': 'not-valid-json' });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Authentication required',
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('throws 401 when cookie has no matching sb- auth-token key', async () => {
      const event = createMockEvent();

      (getHeader as any).mockReturnValue(undefined);
      mockParseCookies.mockReturnValue({ 'some-other-cookie': 'some-value', another: 'foo' });

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

    it('picks the sb- auth-token key out of multiple cookies', async () => {
      const event = createMockEvent();
      const token = 'multi-cookie-token';

      (getHeader as any).mockReturnValue(undefined);
      mockParseCookies.mockReturnValue({
        session: 'abc123',
        csrf: 'xyz',
        'sb-myproject-auth-token': JSON.stringify({ access_token: token }),
        theme: 'dark',
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-multi-cookie' } },
        error: null,
      });

      const result = await requireUserAuth(event);

      expect(mockGetUser).toHaveBeenCalledWith(token);
      expect(result.user).toEqual({ id: 'user-multi-cookie' });
    });

    it('throws 403 when the account is banned (is_banned === true)', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer valid-but-banned';
        return undefined;
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'banned-user' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValue({ data: { is_banned: true }, error: null });

      await expect(requireUserAuth(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('allows the request when the profile exists and is not banned', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer good';
        return undefined;
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'ok-user' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValue({ data: { is_banned: false }, error: null });

      const result = await requireUserAuth(event);
      expect(result.user).toEqual({ id: 'ok-user' });
    });

    it('fails open: allows the request when the profile lookup errors', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer good';
        return undefined;
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'no-profile-user' } },
        error: null,
      });
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });

      const result = await requireUserAuth(event);
      expect(result.user).toEqual({ id: 'no-profile-user' });
    });

    it('fails open: allows the request when the profile lookup throws', async () => {
      const event = createMockEvent();

      (getHeader as any).mockImplementation((_e: any, name: string) => {
        if (name === 'authorization') return 'Bearer good';
        return undefined;
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'throwing-user' } },
        error: null,
      });
      // A transient network failure surfaces as a thrown exception, not an
      // { error } result — it must still fail open, not 500.
      mockMaybeSingle.mockRejectedValue(new Error('ECONNRESET'));

      const result = await requireUserAuth(event);
      expect(result.user).toEqual({ id: 'throwing-user' });
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
