const THEME_STORAGE_KEY = 'cmdiy-theme';
const LIGHT_THEME = 'cmdiy';
const DARK_THEME = 'cmdiy-dark';

type ColorModeValue = 'light' | 'dark' | 'system';

const preference = ref<ColorModeValue>('system');
const resolved = ref<'light' | 'dark'>('light');
let initialized = false;

function applyTheme(mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode === 'dark' ? DARK_THEME : LIGHT_THEME);
  resolved.value = mode;
}

function systemPrefersDark() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveMode(pref: ColorModeValue): 'light' | 'dark' {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return systemPrefersDark() ? 'dark' : 'light';
}

function initClient() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === DARK_THEME) preference.value = 'dark';
  else if (stored === LIGHT_THEME) preference.value = 'light';
  else preference.value = 'system';

  applyTheme(resolveMode(preference.value));

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (preference.value === 'system') {
      applyTheme(resolveMode('system'));
    }
  });
}

export function useColorMode() {
  if (import.meta.client) initClient();

  const value = computed<ColorModeValue>({
    get: () => preference.value,
    set: (next) => {
      preference.value = next;
      if (import.meta.client) {
        if (next === 'system') {
          localStorage.removeItem(THEME_STORAGE_KEY);
        } else {
          localStorage.setItem(THEME_STORAGE_KEY, next === 'dark' ? DARK_THEME : LIGHT_THEME);
        }
        applyTheme(resolveMode(next));
      }
    },
  });

  const preferred = computed(() => (systemPrefersDark() ? 'dark' : 'light'));

  return {
    preference: value,
    value,
    preferred,
    resolved: computed(() => resolved.value),
    isDark: computed(() => resolved.value === 'dark'),
    toggle: () => {
      const current = resolved.value;
      value.value = current === 'dark' ? 'light' : 'dark';
    },
  };
}
