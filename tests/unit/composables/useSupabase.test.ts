import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────
// Mock @supabase/supabase-js
// ─────────────────────────────────────────
const mockClient = {
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
};

const mockCreateClient = vi.fn().mockReturnValue(mockClient);

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('useSupabase', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
    mockCreateClient.mockReturnValue(mockClient);
    // Reset the useState store so each test gets a fresh singleton
    (global as any).__resetNuxtState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Helper to dynamically import a fresh composable instance.
   * vi.resetModules() ensures module-level state is not shared between tests.
   */
  async function freshComposable() {
    const mod = await import('~/app/composables/useSupabase');
    return mod.useSupabase;
  }

  // ─────────────────────────────────────────
  // Basic return value
  // ─────────────────────────────────────────
  describe('return value', () => {
    it('returns a Supabase client object', async () => {
      const useSupabase = await freshComposable();
      const client = useSupabase();

      expect(client).toBeDefined();
      expect(client).toStrictEqual(mockClient);
    });

    it('returns object with expected Supabase client interface (auth, from)', async () => {
      const useSupabase = await freshComposable();
      const client = useSupabase();

      expect(client).toHaveProperty('auth');
      expect(client).toHaveProperty('from');
      expect(client.auth).toHaveProperty('getSession');
    });
  });

  // ─────────────────────────────────────────
  // createClient arguments
  // ─────────────────────────────────────────
  describe('createClient arguments', () => {
    it('calls createClient with correct URL and key from runtime config', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.any(Object),
      );
    });
  });

  // ─────────────────────────────────────────
  // Client-side auth configuration
  // (import.meta.client is transformed to (true) by vitest plugin)
  // ─────────────────────────────────────────
  describe('client-side auth configuration', () => {
    it('sets persistSession to true', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const options = mockCreateClient.mock.calls[0][2];
      expect(options.auth.persistSession).toBe(true);
    });

    it('sets autoRefreshToken to true', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const options = mockCreateClient.mock.calls[0][2];
      expect(options.auth.autoRefreshToken).toBe(true);
    });

    it('sets detectSessionInUrl to true', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const options = mockCreateClient.mock.calls[0][2];
      expect(options.auth.detectSessionInUrl).toBe(true);
    });

    it('sets flowType to pkce', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const options = mockCreateClient.mock.calls[0][2];
      expect(options.auth.flowType).toBe('pkce');
    });

    it('sets storage to window.localStorage', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const options = mockCreateClient.mock.calls[0][2];
      expect(options.auth.storage).toBe(window.localStorage);
    });

    it('includes a custom lock function', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const options = mockCreateClient.mock.calls[0][2];
      expect(options.auth.lock).toBeDefined();
      expect(typeof options.auth.lock).toBe('function');
    });
  });

  // ─────────────────────────────────────────
  // Custom lock function behavior
  // ─────────────────────────────────────────
  describe('custom lock function', () => {
    it('executes the provided callback and returns its result', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const lock = mockCreateClient.mock.calls[0][2].auth.lock;
      const result = await lock('test-lock', 5000, async () => 'done');
      expect(result).toBe('done');
    });

    it('queues concurrent operations (does not drop them)', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const lock = mockCreateClient.mock.calls[0][2].auth.lock;
      const executionOrder: number[] = [];

      // Launch two concurrent operations on the same lock name
      const p1 = lock('shared-lock', 5000, async () => {
        executionOrder.push(1);
        return 'first';
      });
      const p2 = lock('shared-lock', 5000, async () => {
        executionOrder.push(2);
        return 'second';
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      // Both should complete (neither is dropped)
      expect(r1).toBe('first');
      expect(r2).toBe('second');
      expect(executionOrder).toEqual([1, 2]);
    });

    it('cleans up lock entry after completion', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const lock = mockCreateClient.mock.calls[0][2].auth.lock;

      // Run a lock operation and let it complete
      await lock('cleanup-lock', 5000, async () => 'result');

      // Run another operation on the same lock name to verify it works
      // (if cleanup failed, the Map would still hold a reference)
      const result = await lock('cleanup-lock', 5000, async () => 'second-result');
      expect(result).toBe('second-result');
    });

    it('runs callbacks for different lock names independently', async () => {
      const useSupabase = await freshComposable();
      useSupabase();

      const lock = mockCreateClient.mock.calls[0][2].auth.lock;
      const executionOrder: string[] = [];

      const p1 = lock('lock-a', 5000, async () => {
        executionOrder.push('a');
        return 'result-a';
      });
      const p2 = lock('lock-b', 5000, async () => {
        executionOrder.push('b');
        return 'result-b';
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe('result-a');
      expect(r2).toBe('result-b');
      expect(executionOrder).toContain('a');
      expect(executionOrder).toContain('b');
    });
  });

  // ─────────────────────────────────────────
  // Singleton behavior via useState
  // ─────────────────────────────────────────
  describe('singleton behavior', () => {
    it('multiple calls return the same client (singleton via useState)', async () => {
      const useSupabase = await freshComposable();

      const client1 = useSupabase();
      const client2 = useSupabase();

      expect(client1).toBe(client2);
      // createClient should only be called once because useState caches the value
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });
  });
});
