import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed, type Ref } from 'vue';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// ---------------------------------------------------------------------------
// useAnnouncementStyles is a PURE style-mapping composable. It takes a
// Ref<string>/ComputedRef<string> "type" (info | success | warning | error)
// and derives two computeds:
//   - bannerStyle: { backgroundColor, borderBottom, color }
//   - iconStyle:   { color }
// The values are theme-aware: it reads useColorMode().resolved and treats
// 'dark' as dark mode (everything else => light). Unknown / null / empty
// types fall back to the `info` palette for the active theme.
//
// The only collaborator is useColorMode(), which we stub per-test with a
// controllable `resolved` ref so we can flip light <-> dark without touching
// matchMedia/localStorage.
// ---------------------------------------------------------------------------

// Canonical expected palettes copied verbatim from the composable. If the
// source colors change, these assertions are the single point of truth and
// should change with them.
const EXPECTED = {
  light: {
    banner: {
      info: {
        backgroundColor: 'oklch(95% 0.05 254)',
        borderBottom: '2px solid oklch(80% 0.165 254.624)',
        color: 'oklch(21% 0.006 285.885)',
      },
      success: {
        backgroundColor: 'oklch(95% 0.05 140)',
        borderBottom: '2px solid #4a7023',
        color: 'oklch(21% 0.006 285.885)',
      },
      warning: {
        backgroundColor: 'oklch(97% 0.08 95)',
        borderBottom: '2px solid #f9e784',
        color: '#2f2f2f',
      },
      error: {
        backgroundColor: 'oklch(95% 0.05 25)',
        borderBottom: '2px solid #b22222',
        color: 'oklch(21% 0.006 285.885)',
      },
    },
    icon: {
      info: { color: 'oklch(60% 0.2 254)' },
      success: { color: '#4a7023' },
      warning: { color: '#8b7500' },
      error: { color: '#b22222' },
    },
  },
  dark: {
    banner: {
      info: {
        backgroundColor: 'oklch(25% 0.08 254)',
        borderBottom: '2px solid oklch(70% 0.165 254.624)',
        color: 'oklch(92% 0.004 286.32)',
      },
      success: {
        backgroundColor: 'oklch(25% 0.06 140)',
        borderBottom: '2px solid #6a9f33',
        color: 'oklch(92% 0.004 286.32)',
      },
      warning: {
        backgroundColor: 'oklch(88% 0.12 90)',
        borderBottom: '2px solid oklch(70% 0.14 85)',
        color: '#2f2f2f',
      },
      error: {
        backgroundColor: 'oklch(25% 0.06 25)',
        borderBottom: '2px solid #d63333',
        color: 'oklch(92% 0.004 286.32)',
      },
    },
    icon: {
      info: { color: 'oklch(70% 0.165 254.624)' },
      success: { color: '#6a9f33' },
      warning: { color: '#8b7500' },
      error: { color: '#d63333' },
    },
  },
} as const;

const KNOWN_TYPES = ['info', 'success', 'warning', 'error'] as const;
type KnownType = (typeof KNOWN_TYPES)[number];
type ThemeName = 'light' | 'dark';

// Holds the live `resolved` ref shared with the stubbed useColorMode().
let resolvedRef: Ref<string>;

/** Point useColorMode() at a controllable `resolved` ref for this test. */
function stubColorMode(initial: 'light' | 'dark' | string = 'light') {
  resolvedRef = ref(initial);
  const isDark = computed(() => resolvedRef.value === 'dark');
  vi.stubGlobal('useColorMode', () => ({ resolved: resolvedRef, isDark }));
  return resolvedRef;
}

/** Import the composable the same way useProfile.test.ts imports its target. */
async function loadComposable() {
  const mod = await import('~/app/composables/useAnnouncementStyles');
  return mod.useAnnouncementStyles;
}

beforeEach(() => {
  // The composable doesn't touch Supabase/auth, but match the canonical
  // harness setup so global stubs (useRuntimeConfig, etc.) are present and a
  // user is available if anything downstream reads it.
  setupGlobalMocks({ user: createMockUser() });
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useAnnouncementStyles', () => {
  // -------------------------------------------------------------------------
  // Shape / contract
  // -------------------------------------------------------------------------
  describe('return shape', () => {
    it('returns exactly bannerStyle and iconStyle as computed refs', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const result = useAnnouncementStyles(ref('info'));

      expect(Object.keys(result).sort()).toEqual(['bannerStyle', 'iconStyle']);
      // ComputedRef exposes a `.value` getter.
      expect(result.bannerStyle).toHaveProperty('value');
      expect(result.iconStyle).toHaveProperty('value');
      expect(typeof result.bannerStyle.value).toBe('object');
      expect(typeof result.iconStyle.value).toBe('object');
    });

    it('bannerStyle exposes exactly backgroundColor, borderBottom, color', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle } = useAnnouncementStyles(ref('info'));

      expect(Object.keys(bannerStyle.value).sort()).toEqual(['backgroundColor', 'borderBottom', 'color']);
    });

    it('iconStyle exposes exactly color', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const { iconStyle } = useAnnouncementStyles(ref('info'));

      expect(Object.keys(iconStyle.value)).toEqual(['color']);
    });
  });

  // -------------------------------------------------------------------------
  // Table-driven: every known type x theme -> exact banner + icon palette
  // -------------------------------------------------------------------------
  describe('known type -> palette mapping', () => {
    const themes: { name: ThemeName; resolved: string }[] = [
      { name: 'light', resolved: 'light' },
      { name: 'dark', resolved: 'dark' },
    ];

    for (const theme of themes) {
      for (const type of KNOWN_TYPES) {
        it(`[${theme.name}] type="${type}" -> expected banner style`, async () => {
          stubColorMode(theme.resolved);
          const useAnnouncementStyles = await loadComposable();
          const { bannerStyle } = useAnnouncementStyles(ref(type));

          expect(bannerStyle.value).toEqual(EXPECTED[theme.name].banner[type as KnownType]);
        });

        it(`[${theme.name}] type="${type}" -> expected icon color`, async () => {
          stubColorMode(theme.resolved);
          const useAnnouncementStyles = await loadComposable();
          const { iconStyle } = useAnnouncementStyles(ref(type));

          expect(iconStyle.value).toEqual(EXPECTED[theme.name].icon[type as KnownType]);
        });
      }
    }
  });

  // -------------------------------------------------------------------------
  // Documented invariant: warning text color is theme-independent (#2f2f2f),
  // because the warning background stays light in both themes.
  // -------------------------------------------------------------------------
  describe('warning palette invariants', () => {
    it('keeps dark warning text (#2f2f2f) in both light and dark mode', async () => {
      stubColorMode('light');
      let useAnnouncementStyles = await loadComposable();
      const light = useAnnouncementStyles(ref('warning')).bannerStyle.value;
      expect(light.color).toBe('#2f2f2f');

      cleanupGlobalMocks();
      setupGlobalMocks({ user: createMockUser() });
      stubColorMode('dark');
      useAnnouncementStyles = await loadComposable();
      const dark = useAnnouncementStyles(ref('warning')).bannerStyle.value;
      expect(dark.color).toBe('#2f2f2f');
    });

    it('uses the same warning icon color (#8b7500) in both themes', async () => {
      stubColorMode('light');
      let useAnnouncementStyles = await loadComposable();
      expect(useAnnouncementStyles(ref('warning')).iconStyle.value.color).toBe('#8b7500');

      cleanupGlobalMocks();
      setupGlobalMocks({ user: createMockUser() });
      stubColorMode('dark');
      useAnnouncementStyles = await loadComposable();
      expect(useAnnouncementStyles(ref('warning')).iconStyle.value.color).toBe('#8b7500');
    });
  });

  // -------------------------------------------------------------------------
  // Unknown / fallback handling -> always the `info` palette for the theme
  // -------------------------------------------------------------------------
  describe('unknown / fallback type', () => {
    const unknownTypes = ['danger', 'notice', 'INFO', 'Info', 'Success', 'critical', 'alert', 'fatal', 'foo'];

    for (const bad of unknownTypes) {
      it(`[light] unknown type "${bad}" falls back to info banner palette`, async () => {
        stubColorMode('light');
        const useAnnouncementStyles = await loadComposable();
        const { bannerStyle } = useAnnouncementStyles(ref(bad));

        expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);
      });

      it(`[dark] unknown type "${bad}" falls back to info icon palette`, async () => {
        stubColorMode('dark');
        const useAnnouncementStyles = await loadComposable();
        const { iconStyle } = useAnnouncementStyles(ref(bad));

        expect(iconStyle.value).toEqual(EXPECTED.dark.icon.info);
      });
    }

    it('empty string falls back to info (light banner + light icon)', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle, iconStyle } = useAnnouncementStyles(ref(''));

      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);
      expect(iconStyle.value).toEqual(EXPECTED.light.icon.info);
    });

    it('empty string falls back to info (dark banner + dark icon)', async () => {
      stubColorMode('dark');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle, iconStyle } = useAnnouncementStyles(ref(''));

      expect(bannerStyle.value).toEqual(EXPECTED.dark.banner.info);
      expect(iconStyle.value).toEqual(EXPECTED.dark.icon.info);
    });

    it('case sensitivity: "Info" (capitalized) is treated as unknown -> info fallback (not a literal "Info" key)', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      // It happens to equal info because the fallback IS info, but assert it is
      // the fallback path by also checking a non-info-shaped distinction: the
      // fallback must equal info exactly, never warning/success/error.
      const { bannerStyle } = useAnnouncementStyles(ref('Info'));
      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);
      expect(bannerStyle.value).not.toEqual(EXPECTED.light.banner.warning);
    });
  });

  // -------------------------------------------------------------------------
  // null / undefined type values (Ref<string> contract, but be defensive)
  // -------------------------------------------------------------------------
  describe('null / undefined type values', () => {
    it('null type value falls back to info palette', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle, iconStyle } = useAnnouncementStyles(ref(null as unknown as string));

      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);
      expect(iconStyle.value).toEqual(EXPECTED.light.icon.info);
    });

    it('undefined type value falls back to info palette', async () => {
      stubColorMode('dark');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle, iconStyle } = useAnnouncementStyles(ref(undefined as unknown as string));

      expect(bannerStyle.value).toEqual(EXPECTED.dark.banner.info);
      expect(iconStyle.value).toEqual(EXPECTED.dark.icon.info);
    });
  });

  // -------------------------------------------------------------------------
  // Theme resolution: only 'dark' is dark; anything else is light.
  // -------------------------------------------------------------------------
  describe('theme resolution (isDark = resolved === "dark")', () => {
    it('resolved="light" yields the light palette', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      expect(useAnnouncementStyles(ref('info')).bannerStyle.value).toEqual(EXPECTED.light.banner.info);
    });

    it('resolved="dark" yields the dark palette', async () => {
      stubColorMode('dark');
      const useAnnouncementStyles = await loadComposable();
      expect(useAnnouncementStyles(ref('info')).bannerStyle.value).toEqual(EXPECTED.dark.banner.info);
    });

    it('resolved="" (unresolved) is treated as light, not dark', async () => {
      stubColorMode('');
      const useAnnouncementStyles = await loadComposable();
      expect(useAnnouncementStyles(ref('success')).bannerStyle.value).toEqual(EXPECTED.light.banner.success);
    });

    it('resolved="cmdiy" (CMDIY light token) is treated as light', async () => {
      stubColorMode('cmdiy');
      const useAnnouncementStyles = await loadComposable();
      expect(useAnnouncementStyles(ref('error')).iconStyle.value).toEqual(EXPECTED.light.icon.error);
    });

    it('resolved="DARK" (wrong case) is treated as light, since match is case-sensitive', async () => {
      stubColorMode('DARK');
      const useAnnouncementStyles = await loadComposable();
      // Only the exact lowercase string 'dark' selects dark mode.
      expect(useAnnouncementStyles(ref('info')).bannerStyle.value).toEqual(EXPECTED.light.banner.info);
    });
  });

  // -------------------------------------------------------------------------
  // Reactivity: bannerStyle/iconStyle recompute when the input type ref or
  // the color mode changes.
  // -------------------------------------------------------------------------
  describe('reactivity', () => {
    it('recomputes when the type ref changes', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const type = ref('info');
      const { bannerStyle, iconStyle } = useAnnouncementStyles(type);

      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);
      expect(iconStyle.value).toEqual(EXPECTED.light.icon.info);

      type.value = 'error';
      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.error);
      expect(iconStyle.value).toEqual(EXPECTED.light.icon.error);

      type.value = 'warning';
      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.warning);
      expect(iconStyle.value).toEqual(EXPECTED.light.icon.warning);
    });

    it('recomputes when color mode flips light -> dark', async () => {
      const resolved = stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle, iconStyle } = useAnnouncementStyles(ref('success'));

      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.success);
      expect(iconStyle.value).toEqual(EXPECTED.light.icon.success);

      resolved.value = 'dark';
      expect(bannerStyle.value).toEqual(EXPECTED.dark.banner.success);
      expect(iconStyle.value).toEqual(EXPECTED.dark.icon.success);
    });

    it('recomputes when color mode flips dark -> light', async () => {
      const resolved = stubColorMode('dark');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle } = useAnnouncementStyles(ref('error'));

      expect(bannerStyle.value).toEqual(EXPECTED.dark.banner.error);

      resolved.value = 'light';
      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.error);
    });

    it('accepts a ComputedRef input (derived type) and tracks it', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const base = ref('inf');
      const derived = computed(() => `${base.value}o`); // 'info'
      const { bannerStyle } = useAnnouncementStyles(derived);

      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);

      base.value = 'err'; // derived -> 'erro' (unknown) -> info fallback
      expect(bannerStyle.value).toEqual(EXPECTED.light.banner.info);
    });
  });

  // -------------------------------------------------------------------------
  // Independence: separate invocations don't share/leak mapping state, and
  // banner vs icon are derived independently for the same type.
  // -------------------------------------------------------------------------
  describe('independence between invocations', () => {
    it('two instances with different types produce different styles simultaneously', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const a = useAnnouncementStyles(ref('success'));
      const b = useAnnouncementStyles(ref('error'));

      expect(a.bannerStyle.value).toEqual(EXPECTED.light.banner.success);
      expect(b.bannerStyle.value).toEqual(EXPECTED.light.banner.error);
      expect(a.bannerStyle.value).not.toEqual(b.bannerStyle.value);
    });

    it('banner and icon palettes can differ for the same type (info: distinct blues)', async () => {
      stubColorMode('light');
      const useAnnouncementStyles = await loadComposable();
      const { bannerStyle, iconStyle } = useAnnouncementStyles(ref('info'));

      // banner border vs icon color are intentionally different oklch blues.
      expect(bannerStyle.value.borderBottom).toBe('2px solid oklch(80% 0.165 254.624)');
      expect(iconStyle.value.color).toBe('oklch(60% 0.2 254)');
    });
  });
});
