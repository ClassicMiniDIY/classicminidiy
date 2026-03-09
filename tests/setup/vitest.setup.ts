import { vi } from 'vitest';
import {
  ref,
  computed,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  nextTick,
  reactive,
  readonly,
} from 'vue';

const isBrowserEnv = typeof window !== 'undefined';

// ===== Nuxt auto-imports =====
(global as any).navigateTo = vi.fn();

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  go: vi.fn(),
  currentRoute: { value: { path: '/', params: {}, query: {}, name: 'index' } },
};
(global as any).useRouter = vi.fn(() => mockRouter);

(global as any).useRoute = vi.fn(() => ({
  path: '/',
  params: {},
  query: {},
  name: 'index',
  fullPath: '/',
  matched: [],
  meta: {},
}));

(global as any).useRuntimeConfig = vi.fn(() => ({
  public: {
    siteUrl: 'https://www.classicminidiy.com',
    posthogPublicKey: 'test-posthog-key',
    posthogHost: 'https://us.i.posthog.com',
    posthogUiHost: 'https://us.posthog.com',
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-anon-key',
  },
  SUPABASE_SERVICE_KEY: 'test-service-key',
  githubAPIKey: 'test-github-key',
  youtubeAPIKey: 'test-youtube-key',
  NUXT_LANGGRAPH_API_URL: 'https://test-langgraph.api',
  NUXT_LANGSMITH_API_KEY: 'test-langsmith-key',
  MCP_API_KEY: 'dev-mcp-key-classic-mini-diy',
  MCP_API_KEYS: '',
  NODE_ENV: 'test',
}));

// useState store
const __nuxtStateStore: Record<string, ReturnType<typeof ref>> = {};
(global as any).useState = vi.fn((key: string, init?: () => any) => {
  if (!__nuxtStateStore[key]) {
    __nuxtStateStore[key] = ref(init ? init() : null);
  }
  return __nuxtStateStore[key];
});
(global as any).__resetNuxtState = () => {
  Object.keys(__nuxtStateStore).forEach((key) => delete __nuxtStateStore[key]);
};

(global as any).useCookie = vi.fn((_key: string) => ref(null));
(global as any).$fetch = vi.fn().mockResolvedValue({});
(global as any).definePageMeta = vi.fn();
(global as any).useHead = vi.fn();
(global as any).useSeoMeta = vi.fn();
(global as any).useAsyncData = vi.fn(async (_key: string, handler: () => Promise<any>) => {
  try {
    const data = await handler();
    return { data: ref(data), pending: ref(false), error: ref(null), refresh: vi.fn() };
  } catch (error) {
    return { data: ref(null), pending: ref(false), error: ref(error), refresh: vi.fn() };
  }
});
(global as any).useFetch = vi.fn();
(global as any).useNuxtApp = vi.fn(() => ({
  $posthog: undefined,
}));

// i18n mock
(global as any).useI18n = vi.fn(() => ({
  t: vi.fn((key: string) => key),
  locale: ref('en'),
  locales: ref([
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
  ]),
  setLocale: vi.fn(),
}));

// PostHog mock
(global as any).usePostHog = vi.fn(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}));

// ===== Vue APIs as globals (Nuxt auto-imports) =====
(global as any).computed = computed;
(global as any).watch = watch;
(global as any).watchEffect = watchEffect;
(global as any).onMounted = onMounted;
(global as any).onUnmounted = onUnmounted;
(global as any).onBeforeUnmount = onBeforeUnmount;
(global as any).nextTick = nextTick;
(global as any).ref = ref;
(global as any).reactive = reactive;
(global as any).readonly = readonly;

// process.client for SSR detection
(global as any).process = {
  ...process,
  client: true,
  server: false,
};

// ===== Browser-specific mocks =====
if (isBrowserEnv) {
  import('@vue/test-utils').then(({ config }) => {
    config.global.mocks = {
      $route: { path: '/', params: {}, query: {}, name: 'index' },
      $router: mockRouter,
      $t: (key: string) => key,
    };
    config.global.stubs = {
      Icon: { name: 'Icon', template: '<span class="mock-icon" :data-name="name"><slot /></span>', props: ['name'] },
      UIcon: { name: 'UIcon', template: '<span class="mock-icon" :data-name="name"><slot /></span>', props: ['name'] },
      NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] },
      ClientOnly: { name: 'ClientOnly', template: '<slot />' },
    };
  });

  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;

  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, 'open', { writable: true, value: vi.fn() });
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn().mockResolvedValue('') },
  });
  Object.defineProperty(navigator, 'share', { writable: true, value: vi.fn().mockResolvedValue(undefined) });
  global.confirm = vi.fn(() => true);
  global.alert = vi.fn();

  const localStorageMock = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
} else {
  (global as any).localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
}
