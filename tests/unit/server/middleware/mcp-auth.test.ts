/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Nitro global stubs (must be hoisted before source import) ----
const { mockGetRequestURL, mockGetHeader, mockUseRuntimeConfig, mockStorage, storageBacking } = vi.hoisted(() => {
  const mockGetRequestURL = vi.fn();
  const mockGetHeader = vi.fn();
  const mockUseRuntimeConfig = vi.fn();

  // In-memory stand-in for useStorage('cache') (KV in production).
  const storageBacking = new Map<string, unknown>();
  const mockStorage = {
    getItem: vi.fn(async (key: string) => storageBacking.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      storageBacking.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageBacking.delete(key);
    }),
  };

  (globalThis as any).defineEventHandler = (handler: Function) => handler;
  (globalThis as any).getRequestURL = mockGetRequestURL;
  (globalThis as any).getHeader = mockGetHeader;
  (globalThis as any).createError = (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
    const e = new Error(opts.message || opts.statusMessage) as Error & { statusCode: number };
    e.statusCode = opts.statusCode;
    return e;
  };
  (globalThis as any).useRuntimeConfig = mockUseRuntimeConfig;
  (globalThis as any).useStorage = () => mockStorage;
  (globalThis as any).setHeader = vi.fn();
  (globalThis as any).getRequestIP = () => undefined;

  return { mockGetRequestURL, mockGetHeader, mockUseRuntimeConfig, mockStorage, storageBacking };
});

// Service-client fake: each test configures the api_keys row / RPC answer.
const { mockMaybeSingle, mockRpc, mockUpdateEq } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockRpc: vi.fn(),
  mockUpdateEq: vi.fn(async () => ({ error: null })),
}));

vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: mockMaybeSingle }),
        }),
      }),
      update: () => ({ eq: mockUpdateEq }),
    }),
    rpc: mockRpc,
  }),
}));

// Import the handler (defineEventHandler returns the raw function via stub)
import handler from '~/server/middleware/mcp-auth';
import { _resetRateLimitStore } from '~/server/utils/rateLimit';
import { getMcpAuth, sha256Hex, keyCacheId, MCP_KEY_PREFIX } from '~/server/utils/mcpTiers';

/** A plausible self-serve key (prefix + 40 base62 chars). */
const CMDIY_KEY = `${MCP_KEY_PREFIX}${'a1B2c3D4e5'.repeat(4)}`;

/** getHeader stub covering both the auth header and clientIp's lookups. */
function setHeaders(authorization: string | undefined, ip = '203.0.113.7') {
  mockGetHeader.mockImplementation((_event: unknown, name: string) => {
    if (name === 'authorization') return authorization;
    if (name === 'cf-connecting-ip') return ip;
    return undefined;
  });
}

describe('server/middleware/mcp-auth', () => {
  const fakeEvent = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    storageBacking.clear();
    _resetRateLimitStore();
    fakeEvent.context = {};
    delete fakeEvent.waitUntil;

    // Default runtime config: no keys configured, production mode
    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    // Default DB shape: no api_keys row, no subscription.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: false, error: null });

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
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(undefined);

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects /mcp requests with non-Bearer Authorization header (401)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Basic abc123');

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  // ---------- 3. Reject invalid Bearer tokens ----------
  it('rejects invalid Bearer tokens (403)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer wrong-key');

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
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer my-secret-key');

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
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: 'key-alpha, key-beta, key-gamma',
      NODE_ENV: 'production',
    });

    // Try the second key (with whitespace trimming)
    setHeaders('Bearer key-beta');
    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('rejects a key not in MCP_API_KEYS', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: 'key-alpha, key-beta',
      NODE_ENV: 'production',
    });

    setHeaders('Bearer key-delta');
    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // ---------- 6. Fail closed: no hardcoded/burned key is ever accepted ----------
  // 'dev-mcp-key-classic-mini-diy' is published in this repo's git history. The
  // middleware must reject it in EVERY environment, and with no keys configured
  // every request is rejected (no fail-open when NODE_ENV is unset).
  it('rejects the burned dev key in development when no key is configured (403)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'development',
    });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rejects the burned dev key when NODE_ENV is unset — no fail-open (403)', async () => {
    const originalEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: undefined,
    });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    // Restore
    process.env.NODE_ENV = originalEnv;
  });

  it('rejects the burned dev key in production (403)', async () => {
    process.env.NODE_ENV = 'production';

    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer dev-mcp-key-classic-mini-diy');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rejects ALL requests when no API keys are configured — fail closed (403)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer any-key-at-all');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: '',
      MCP_API_KEYS: '',
      NODE_ENV: 'development',
    });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('still accepts a real configured key in development (dev works via env key)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer my-local-dev-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-local-dev-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'development',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  // ---------- 7. Case-insensitive bearer prefix ----------
  it('handles "bearer" prefix in lowercase', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('bearer my-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('handles "BEARER" prefix in uppercase', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('BEARER my-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('handles "Bearer" prefix with extra whitespace', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('  Bearer   my-key  ');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'my-key',
      MCP_API_KEYS: '',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  // ---------- Edge cases ----------
  // The gate is an exact match on /mcp, the JSON-RPC endpoint. It used to be
  // startsWith('/mcp'), which 401'd the two routes @nuxtjs/mcp-toolkit registers
  // to be PUBLICLY linkable — the IDE install deeplink and the README badge —
  // and also swept up unrelated paths sharing the prefix.
  it.each(['/mcp/deeplink', '/mcp/badge.svg'])('leaves the public %s route unauthenticated', async (path) => {
    mockGetRequestURL.mockReturnValue(new URL(`https://example.com${path}`));
    setHeaders(undefined);

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
    expect(mockUseRuntimeConfig).not.toHaveBeenCalled();
  });

  // Nitro folds '/mcp/' onto the '/mcp' handler, so a gate that missed the
  // trailing slash let an unauthenticated caller reach the JSON-RPC endpoint.
  it.each(['/mcp/', '/mcp//', '/mcp/sse'])('still gates %s', async (path) => {
    mockGetRequestURL.mockReturnValue(new URL(`https://example.com${path}`));
    setHeaders(undefined);

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('does not gate an unrelated path that merely shares the /mcp prefix', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp-other'));
    setHeaders(undefined);

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
    expect(mockUseRuntimeConfig).not.toHaveBeenCalled();
  });

  it('accepts key from MCP_API_KEY even when MCP_API_KEYS also has keys', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer single-key');

    mockUseRuntimeConfig.mockReturnValue({
      MCP_API_KEY: 'single-key',
      MCP_API_KEYS: 'multi-key-1, multi-key-2',
      NODE_ENV: 'production',
    });

    await expect((handler as Function)(fakeEvent)).resolves.toBeUndefined();
  });

  it('rejects empty Bearer token (401 because empty string is falsy)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer ');

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

  // ---------- Self-serve keys (Developer API, 2026-08-28) ----------

  it('env keys resolve to the internal tier with no storage or DB involved', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer my-secret-key');
    mockUseRuntimeConfig.mockReturnValue({ MCP_API_KEY: 'my-secret-key', MCP_API_KEYS: '', NODE_ENV: 'production' });

    await (handler as Function)(fakeEvent);
    expect(getMcpAuth(fakeEvent)).toEqual({ tier: 'internal' });
    expect(mockStorage.getItem).not.toHaveBeenCalled();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('a non-cmdiy invalid key never touches the cache or the database', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders('Bearer totally-made-up');
    mockUseRuntimeConfig.mockReturnValue({ MCP_API_KEY: 'real-key', MCP_API_KEYS: '', NODE_ENV: 'production' });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 403 });
    expect(mockStorage.getItem).not.toHaveBeenCalled();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('cache miss + api_keys row + active subscription resolves the developer tier and caches it', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'key-1', user_id: 'user-1', key_prefix: CMDIY_KEY.slice(0, 12) },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: true, error: null });

    await (handler as Function)(fakeEvent);
    expect(getMcpAuth(fakeEvent)).toMatchObject({ tier: 'developer', keyId: 'key-1', userId: 'user-1' });
    expect(mockRpc).toHaveBeenCalledWith('user_has_subscription', {
      p_user_id: 'user-1',
      p_product_id: 'developer',
    });
    const hash = await sha256Hex(CMDIY_KEY);
    expect(storageBacking.get(keyCacheId(hash))).toMatchObject({ ok: true, tier: 'developer' });
  });

  it('cache miss + api_keys row without a subscription resolves the free tier', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'key-1', user_id: 'user-1', key_prefix: CMDIY_KEY.slice(0, 12) },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    await (handler as Function)(fakeEvent);
    expect(getMcpAuth(fakeEvent)).toMatchObject({ tier: 'free' });
  });

  it('a subscription-RPC failure degrades to free for THIS request and caches nothing', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'key-1', user_id: 'user-1', key_prefix: CMDIY_KEY.slice(0, 12) },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await (handler as Function)(fakeEvent);
    expect(getMcpAuth(fakeEvent)).toMatchObject({ tier: 'free' });
    // Caching the degraded tier would lock a PAID key out of its tools for the
    // full positive TTL over a transient RPC hiccup — the next request must
    // retry the RPC instead.
    expect(storageBacking.size).toBe(0);
  });

  it('an unknown cmdiy key 403s and caches the negative', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 403 });
    const hash = await sha256Hex(CMDIY_KEY);
    expect(storageBacking.get(keyCacheId(hash))).toEqual({ ok: false });
  });

  it('a cached positive entry authenticates without any DB call', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    const hash = await sha256Hex(CMDIY_KEY);
    storageBacking.set(keyCacheId(hash), {
      ok: true,
      keyId: 'key-9',
      userId: 'user-9',
      tier: 'developer',
      keyPrefix: CMDIY_KEY.slice(0, 12),
    });

    await (handler as Function)(fakeEvent);
    expect(getMcpAuth(fakeEvent)).toMatchObject({ tier: 'developer', keyId: 'key-9' });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('a cached negative entry 403s without any DB call', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    const hash = await sha256Hex(CMDIY_KEY);
    storageBacking.set(keyCacheId(hash), { ok: false });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 403 });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('an api_keys lookup failure answers 503 and caches nothing', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    setHeaders(`Bearer ${CMDIY_KEY}`);
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });

    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 503 });
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('throttles cache-miss lookups per IP (429 after the window fills)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    mockUseRuntimeConfig.mockReturnValue({ MCP_API_KEY: '', MCP_API_KEYS: '', NODE_ENV: 'production' });

    // 60 distinct unknown keys from one address consume the lookup budget...
    for (let i = 0; i < 60; i++) {
      setHeaders(`Bearer ${MCP_KEY_PREFIX}scan${String(i).padStart(36, '0')}`, '198.51.100.9');
      await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 403 });
    }
    // ...and the 61st is refused before any DB work.
    mockMaybeSingle.mockClear();
    setHeaders(`Bearer ${MCP_KEY_PREFIX}scan${'x'.repeat(36)}`, '198.51.100.9');
    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 429 });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('cached-negative replays consume the same budget instead of bypassing every limiter', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/mcp'));
    mockUseRuntimeConfig.mockReturnValue({ MCP_API_KEY: '', MCP_API_KEYS: '', NODE_ENV: 'production' });
    setHeaders(`Bearer ${CMDIY_KEY}`, '198.51.100.10');
    const hash = await sha256Hex(CMDIY_KEY);
    storageBacking.set(keyCacheId(hash), { ok: false });

    // Replaying one known-bad key costs a KV read each time — it must settle
    // at the throttle, not run unmetered because the 403 short-circuits
    // rate-limit.ts.
    for (let i = 0; i < 60; i++) {
      await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 403 });
    }
    await expect((handler as Function)(fakeEvent)).rejects.toMatchObject({ statusCode: 429 });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
