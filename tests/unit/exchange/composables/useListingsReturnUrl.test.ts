import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pure sessionStorage-backed composable — no Supabase/auth dependencies.
// Re-imported per test after vi.resetModules() to mirror the canonical CMDIY
// dynamic-import pattern (useProfile/useCurrency). Both STORAGE_KEY and
// DEFAULT_URL are module-private, so we assert through the public API and the
// real happy-dom sessionStorage (the setup file mocks localStorage, NOT
// sessionStorage, so window.sessionStorage is a working in-memory store here).
const loadComposable = async () => {
  const mod = await import('~/app/composables/useListingsReturnUrl');
  return mod.useListingsReturnUrl();
};

const STORAGE_KEY = 'tme:listings-return-url';
const DEFAULT_URL = '/listings';

beforeEach(() => {
  vi.resetModules();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('useListingsReturnUrl', () => {
  it('exposes the three documented methods', async () => {
    const api = await loadComposable();
    expect(typeof api.rememberListingsReturnUrl).toBe('function');
    expect(typeof api.getListingsReturnUrl).toBe('function');
    expect(typeof api.clearListingsReturnUrl).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // getListingsReturnUrl()
  // ---------------------------------------------------------------------------
  describe('getListingsReturnUrl()', () => {
    it('returns the default /listings when nothing is saved', async () => {
      const { getListingsReturnUrl } = await loadComposable();
      expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
    });

    it('returns a previously saved URL', async () => {
      const { rememberListingsReturnUrl, getListingsReturnUrl } = await loadComposable();
      rememberListingsReturnUrl('/listings?page=4&manufacturer=rover');
      expect(getListingsReturnUrl()).toBe('/listings?page=4&manufacturer=rover');
    });

    it('reads the value directly from sessionStorage under the namespaced key', async () => {
      window.sessionStorage.setItem(STORAGE_KEY, '/listings?page=9');
      const { getListingsReturnUrl } = await loadComposable();
      expect(getListingsReturnUrl()).toBe('/listings?page=9');
    });

    it('falls back to /listings when the stored value is an empty string', async () => {
      // Exercises the `|| DEFAULT_URL` branch: a stored empty string is falsy.
      window.sessionStorage.setItem(STORAGE_KEY, '');
      const { getListingsReturnUrl } = await loadComposable();
      expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
    });

    it('falls back to /listings when sessionStorage.getItem throws', async () => {
      const { getListingsReturnUrl } = await loadComposable();
      const spy = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // rememberListingsReturnUrl()
  // ---------------------------------------------------------------------------
  describe('rememberListingsReturnUrl()', () => {
    it('persists and round-trips a URL with query params', async () => {
      const { rememberListingsReturnUrl, getListingsReturnUrl } = await loadComposable();
      rememberListingsReturnUrl('/listings?page=2&category=engine');
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('/listings?page=2&category=engine');
      expect(getListingsReturnUrl()).toBe('/listings?page=2&category=engine');
    });

    it('replaces the previous value on subsequent saves', async () => {
      const { rememberListingsReturnUrl, getListingsReturnUrl } = await loadComposable();
      rememberListingsReturnUrl('/listings?page=2');
      rememberListingsReturnUrl('/listings?page=5&category=engine');
      expect(getListingsReturnUrl()).toBe('/listings?page=5&category=engine');
    });

    it('persists an empty string verbatim (no validation), which reads back as the default', async () => {
      const { rememberListingsReturnUrl, getListingsReturnUrl } = await loadComposable();
      rememberListingsReturnUrl('');
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('');
      // getter coalesces the falsy empty string to the default.
      expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
    });

    it('swallows errors when sessionStorage.setItem throws (private mode / quota)', async () => {
      const { rememberListingsReturnUrl } = await loadComposable();
      const spy = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => rememberListingsReturnUrl('/listings?page=3')).not.toThrow();
      spy.mockRestore();
    });

    it('does not write to localStorage (session-scoped, not persistent)', async () => {
      const { rememberListingsReturnUrl } = await loadComposable();
      rememberListingsReturnUrl('/listings?page=7');
      // localStorage is the vi.fn mock from the setup file; it must stay untouched.
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // clearListingsReturnUrl()
  // ---------------------------------------------------------------------------
  describe('clearListingsReturnUrl()', () => {
    it('removes the saved URL so the getter returns the default again', async () => {
      const { rememberListingsReturnUrl, getListingsReturnUrl, clearListingsReturnUrl } = await loadComposable();
      rememberListingsReturnUrl('/listings?page=3');
      clearListingsReturnUrl();
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
    });

    it('is a safe no-op when nothing is saved', async () => {
      const { clearListingsReturnUrl, getListingsReturnUrl } = await loadComposable();
      expect(() => clearListingsReturnUrl()).not.toThrow();
      expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
    });

    it('swallows errors when sessionStorage.removeItem throws', async () => {
      const { clearListingsReturnUrl } = await loadComposable();
      const spy = vi.spyOn(window.sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('denied');
      });
      expect(() => clearListingsReturnUrl()).not.toThrow();
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Full remember -> get -> clear lifecycle
  // ---------------------------------------------------------------------------
  it('supports the full remember/get/clear lifecycle', async () => {
    const { rememberListingsReturnUrl, getListingsReturnUrl, clearListingsReturnUrl } = await loadComposable();
    expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
    rememberListingsReturnUrl('/listings?page=12&sort=newest');
    expect(getListingsReturnUrl()).toBe('/listings?page=12&sort=newest');
    clearListingsReturnUrl();
    expect(getListingsReturnUrl()).toBe(DEFAULT_URL);
  });
});
