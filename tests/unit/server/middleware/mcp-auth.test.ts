/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Nitro global stubs (must be hoisted before source import) ----
const { mockGetRequestURL, mockGetHeader, mockUseRuntimeConfig } = vi.hoisted(() => {
  const mockGetRequestURL = vi.fn();
  const mockGetHeader = vi.fn();
  const mockUseRuntimeConfig = vi.fn();

  (globalThis as any).defineEventHandler = (handler: Function) => handler;
  (globalThis as any).getRequestURL = mockGetRequestURL;
  (globalThis as any).getHeader = mockGetHeader;
  (globalThis as any).createError = (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
    const e = new Error(opts.message || opts.statusMessage) as Error & { statusCode: number };
    e.statusCode = opts.statusCode;
    return e;
  };
  (globalThis as any).useRuntimeConfig = mockUseRuntimeConfig;

  return { mockGetRequestURL, mockGetHeader, mockUseRuntimeConfig };
});

// Import the handler (defineEventHandler returns the raw function via stub)
import handler from '~/server/middleware/mcp-auth';

describe('server/middleware/mcp-auth', () => {
  const fakeEvent = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default runtime config: no keys configured, production mode
    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    // Ensure process.env.NODE_ENV is production by default
    process.env.NODE_ENV = 'production';
  });

  // ---------- 1. Pass through non-/mcp routes ----------
  it('passes through non-/mcp routes (no-op)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/api/listings'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
    // useRuntimeConfig should NOT be called for non-MCP routes
    expect(mockUseRuntimeConfig).not.toHaveBeenCalled();
  });

  it('passes through root path', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
  });

  // ---------- 2. Reject requests without Bearer token ----------
  it('rejects /mcp requests without Authorization header (401)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue(undefined);

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects /mcp requests with non-Bearer Authorization header (401)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Basic abc123');

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  // ---------- 3. Reject invalid Bearer tokens ----------
  it('rejects invalid Bearer tokens (403)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer wrong-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'correct-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // ---------- 4. Accept valid MCP_API_KEY ----------
  it('accepts a valid MCP_API_KEY', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer my-secret-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-secret-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    // Should not throw
    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  // ---------- 5. Accept comma-separated MCP_API_KEYS ----------
  it('accepts any key from comma-separated MCP_API_KEYS', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: 'key-alpha, key-beta, key-gamma',
      NODE_ENV: 'production',
    });

    // Try the second key (with whitespace trimming)
    mockGetHeader.mockReturnValue('Bearer key-beta');
    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('rejects a key not in MCP_API_KEYS', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: 'key-alpha, key-beta',
      NODE_ENV: 'production',
    });

    mockGetHeader.mockReturnValue('Bearer key-delta');
    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // ---------- 6. Accept dev key in development mode ----------
  it('accepts the dev key when NODE_ENV is development (via config)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'development',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('accepts the dev key when process.env.NODE_ENV is development', async () => {
    process.env.NODE_ENV = 'development';

    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'test', // config says test, but process.env says development
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('accepts the dev key when NODE_ENV is not set at all', async () => {
    const originalEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: undefined,
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();

    // Restore
    process.env.NODE_ENV = originalEnv;
  });

  it('rejects the dev key in production mode', async () => {
    process.env.NODE_ENV = 'production';

    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // ---------- 7. Case-insensitive bearer prefix ----------
  it('handles "bearer" prefix in lowercase', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('bearer my-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('handles "BEARER" prefix in uppercase', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('BEARER my-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('handles "Bearer" prefix with extra whitespace', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('  Bearer   my-key  ');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  // ---------- Edge cases ----------
  it('matches /mcp subpaths like /mcp/sse', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/sse'));
    mockGetHeader.mockReturnValue(undefined);

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('also matches paths like /mcp-other (startsWith behavior)', async () => {
    // The source checks startsWith('/mcp') which WOULD match '/mcp-other'
    // This test documents actual behavior
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp-other'));
    mockGetHeader.mockReturnValue(undefined);

    // Since '/mcp-other'.startsWith('/mcp') is true, auth IS enforced
    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('accepts key from MCP_API_KEY even when MCP_API_KEYS also has keys', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer single-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'single-key',
      MCP_API_KEYS: 'multi-key-1, multi-key-2',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('rejects empty Bearer token (401 because empty string is falsy)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp/tools'));
    mockGetHeader.mockReturnValue('Bearer ');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'real-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    // After substring(7).trim(), providedKey is "" which is falsy,
    // so it hits the "no valid Bearer token" (401) branch, not 403
    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
