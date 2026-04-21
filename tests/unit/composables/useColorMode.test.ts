import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useColorMode } from '~/app/composables/useColorMode';

type MediaQueryChangeHandler = (e: Partial<MediaQueryListEvent>) => void;

function stubMatchMedia(initialMatches: boolean) {
  const listeners: MediaQueryChangeHandler[] = [];
  const mqList = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_event: string, cb: MediaQueryChangeHandler) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  const impl = vi.fn().mockReturnValue(mqList);
  vi.stubGlobal('matchMedia', impl);

  return {
    impl,
    mqList,
    trigger(next: boolean) {
      mqList.matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
}

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  const mock = {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key];
    }),
    length: 0,
    key: vi.fn(),
  };
  vi.stubGlobal('localStorage', mock);
  return { mock, store };
}

describe('useColorMode', () => {
  beforeEach(() => {
    (global as any).__resetNuxtState();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('defaults preference to "system" when no value is stored', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const { preference } = useColorMode();
      expect(preference.value).toBe('system');
    });

    it('reads "dark" preference from localStorage and applies the dark theme', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy-dark' });
      stubMatchMedia(false);

      const { preference, isDark, resolved } = useColorMode();

      expect(preference.value).toBe('dark');
      expect(isDark.value).toBe(true);
      expect(resolved.value).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy-dark');
    });

    it('reads "light" preference from localStorage and applies the light theme', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy' });
      stubMatchMedia(true);

      const { preference, isDark, resolved } = useColorMode();

      expect(preference.value).toBe('light');
      expect(isDark.value).toBe(false);
      expect(resolved.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy');
    });

    it('falls back to system preference (light) when nothing is stored', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const { preference, resolved } = useColorMode();

      expect(preference.value).toBe('system');
      expect(resolved.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy');
    });

    it('falls back to system preference (dark) when nothing is stored', () => {
      stubLocalStorage();
      stubMatchMedia(true);

      const { preference, resolved, isDark } = useColorMode();

      expect(preference.value).toBe('system');
      expect(resolved.value).toBe('dark');
      expect(isDark.value).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy-dark');
    });

    it('treats unrecognized stored values as "system"', () => {
      stubLocalStorage({ 'cmdiy-theme': 'garbage-value' });
      stubMatchMedia(false);

      const { preference } = useColorMode();
      expect(preference.value).toBe('system');
    });
  });

  describe('setting preference', () => {
    it('persists and applies "dark" when set', () => {
      const { mock: localStorageMock } = stubLocalStorage();
      stubMatchMedia(false);

      const { preference, resolved } = useColorMode();
      preference.value = 'dark';

      expect(localStorageMock.setItem).toHaveBeenCalledWith('cmdiy-theme', 'cmdiy-dark');
      expect(resolved.value).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy-dark');
    });

    it('persists and applies "light" when set', () => {
      const { mock: localStorageMock } = stubLocalStorage({ 'cmdiy-theme': 'cmdiy-dark' });
      stubMatchMedia(true);

      const { preference, resolved } = useColorMode();
      preference.value = 'light';

      expect(localStorageMock.setItem).toHaveBeenCalledWith('cmdiy-theme', 'cmdiy');
      expect(resolved.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy');
    });

    it('removes the stored key and falls back to system preference when set to "system"', () => {
      const { mock: localStorageMock } = stubLocalStorage({ 'cmdiy-theme': 'cmdiy-dark' });
      stubMatchMedia(true);

      const { preference, resolved } = useColorMode();
      preference.value = 'system';

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cmdiy-theme');
      expect(resolved.value).toBe('dark');
    });

    it('applies "cmdiy" when system preference is light after switching to "system"', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy-dark' });
      stubMatchMedia(false);

      const { preference, resolved } = useColorMode();
      preference.value = 'system';

      expect(resolved.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy');
    });

    it('keeps value and preference in sync', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const { preference, value } = useColorMode();
      value.value = 'dark';

      expect(preference.value).toBe('dark');
      expect(value.value).toBe('dark');
    });
  });

  describe('toggle', () => {
    it('switches from dark to light', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy-dark' });
      stubMatchMedia(false);

      const { toggle, preference, resolved } = useColorMode();
      toggle();

      expect(preference.value).toBe('light');
      expect(resolved.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy');
    });

    it('switches from light to dark', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy' });
      stubMatchMedia(false);

      const { toggle, preference, resolved } = useColorMode();
      toggle();

      expect(preference.value).toBe('dark');
      expect(resolved.value).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy-dark');
    });

    it('flips from system-resolved-light into an explicit "dark" preference', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const { toggle, preference, resolved } = useColorMode();
      expect(resolved.value).toBe('light');

      toggle();
      expect(preference.value).toBe('dark');
      expect(resolved.value).toBe('dark');
    });

    it('flips from system-resolved-dark into an explicit "light" preference', () => {
      stubLocalStorage();
      stubMatchMedia(true);

      const { toggle, preference, resolved } = useColorMode();
      expect(resolved.value).toBe('dark');

      toggle();
      expect(preference.value).toBe('light');
      expect(resolved.value).toBe('light');
    });

    it('double-toggle returns to the original resolved mode', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const { toggle, resolved } = useColorMode();
      const initial = resolved.value;
      toggle();
      toggle();

      expect(resolved.value).toBe(initial);
    });
  });

  describe('system preference changes', () => {
    it('updates resolved theme when system changes and preference is "system"', () => {
      stubLocalStorage();
      const media = stubMatchMedia(false);

      const { resolved } = useColorMode();
      expect(resolved.value).toBe('light');

      media.trigger(true);

      expect(resolved.value).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy-dark');
    });

    it('ignores system changes when preference is an explicit "light"', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy' });
      const media = stubMatchMedia(false);

      const { resolved } = useColorMode();
      media.trigger(true);

      expect(resolved.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy');
    });

    it('ignores system changes when preference is an explicit "dark"', () => {
      stubLocalStorage({ 'cmdiy-theme': 'cmdiy-dark' });
      const media = stubMatchMedia(true);

      const { resolved } = useColorMode();
      media.trigger(false);

      expect(resolved.value).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('cmdiy-dark');
    });
  });

  describe('preferred computed', () => {
    it('reports "light" when the system prefers light', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const { preferred } = useColorMode();
      expect(preferred.value).toBe('light');
    });

    it('reports "dark" when the system prefers dark', () => {
      stubLocalStorage();
      stubMatchMedia(true);

      const { preferred } = useColorMode();
      expect(preferred.value).toBe('dark');
    });
  });

  describe('shared state', () => {
    it('two useColorMode() callers share preference state', () => {
      stubLocalStorage();
      stubMatchMedia(false);

      const first = useColorMode();
      const second = useColorMode();

      first.preference.value = 'dark';

      expect(second.preference.value).toBe('dark');
      expect(second.resolved.value).toBe('dark');
    });
  });
});
