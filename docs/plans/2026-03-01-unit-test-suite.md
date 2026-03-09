# Classic Mini DIY — Comprehensive Unit Test Suite

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a complete Vitest unit test suite targeting 95%+ code coverage across composables, server utilities, data model utilities, middleware, MCP tools, and server API routes.

**Architecture:** Greenfield test infrastructure modeled on TheMiniExchange patterns. Vitest with happy-dom for browser tests, node environment for server tests. Global setup mocks all Nuxt auto-imports. Per-test mocking via `vi.stubGlobal` for composable dependencies. Supabase queries mocked with chainable builder pattern.

**Tech Stack:** Vitest 4.x, @vue/test-utils 2.x, happy-dom, @vitest/coverage-v8

---

## Task 1: Install Test Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install devDependencies**

Run:

```bash
cd /Users/colegentry/Development/classicminidiy && bun add -d vitest @vue/test-utils happy-dom @vitest/coverage-v8 @vitejs/plugin-vue
```

**Step 2: Add test scripts to package.json**

Add these scripts to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest run --coverage"
```

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add vitest test infrastructure dependencies"
```

---

## Task 2: Create Vitest Configuration

**Files:**

- Create: `vitest.config.ts`

**Step 1: Create vitest config**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue(),
    // Replicate Nuxt's import.meta.client / import.meta.server compile-time flags
    {
      name: 'vitest:import-meta-client',
      transform(code, id) {
        if (id.includes('node_modules')) return;
        if (!code.includes('import.meta.client') && !code.includes('import.meta.server')) return;
        return {
          code: code.replace(/\bimport\.meta\.client\b/g, '(true)').replace(/\bimport\.meta\.server\b/g, '(false)'),
          map: null,
        };
      },
    },
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: { shuffle: false },
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '@@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
```

**Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest configuration"
```

---

## Task 3: Create Global Test Setup

**Files:**

- Create: `tests/setup/vitest.setup.ts`

**Step 1: Create the global setup file**

This file mocks all Nuxt auto-imports, Vue APIs, browser globals, and common composable dependencies. It runs before every test file.

```ts
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
```

**Step 2: Commit**

```bash
mkdir -p tests/setup && git add tests/setup/vitest.setup.ts
git commit -m "chore: add global vitest setup with Nuxt auto-import mocks"
```

---

## Task 4: Create Mock Supabase Client & Test Helpers

**Files:**

- Create: `tests/setup/mockSupabase.ts`
- Create: `tests/setup/testHelpers.ts`
- Create: `tests/setup/globals.d.ts`

**Step 1: Create mockSupabase.ts**

```ts
import { vi } from 'vitest';

export const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Classic Mini enthusiast',
  is_admin: false,
  trust_level: 'contributor',
  total_submissions: 5,
  approved_submissions: 3,
  rejected_submissions: 1,
  created_at: new Date().toISOString(),
};

export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
};

export const createMockSupabaseClient = () => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockNeq = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();
  const mockIs = vi.fn().mockReturnThis();
  const mockNot = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockRange = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  const queryBuilder: any = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    neq: mockNeq,
    in: mockIn,
    is: mockIs,
    not: mockNot,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    // Make thenable for direct await
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  };

  const mockFrom = vi.fn(() => queryBuilder);

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com' }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: mockSession.user }, error: null }),
    },
    from: mockFrom,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/mock-url' } }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
    _queryBuilder: queryBuilder,
    _mockSelect: mockSelect,
    _mockInsert: mockInsert,
    _mockUpdate: mockUpdate,
    _mockDelete: mockDelete,
    _mockSingle: mockSingle,
    _mockMaybeSingle: mockMaybeSingle,
  };
};

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>;
```

**Step 2: Create testHelpers.ts**

```ts
import { vi } from 'vitest';
import { ref, computed } from 'vue';
import { createMockSupabaseClient, mockProfile } from './mockSupabase';

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockAuth = (userValue: any = null) => {
  const user = ref(userValue);
  const userProfileRef = ref(userValue ? mockProfile : null);
  const loading = ref(false);
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => userProfileRef.value?.is_admin ?? false);

  return {
    user,
    userProfile: userProfileRef,
    loading,
    isAuthenticated,
    isAdmin,
    initAuth: vi.fn().mockResolvedValue(undefined),
    waitForAuth: vi.fn().mockResolvedValue(true),
    fetchUserProfile: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue({ success: true }),
    signInWithOAuth: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithApple: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
  };
};

export const setupGlobalMocks = (options: { user?: any; supabase?: any } = {}) => {
  const mockUser = options.user !== undefined ? options.user : null;
  const mockAuth = createMockAuth(mockUser);
  const mockSupabase = options.supabase || createMockSupabaseClient();

  vi.stubGlobal('useAuth', () => mockAuth);
  vi.stubGlobal('useSupabase', () => mockSupabase);

  return { mockAuth, mockSupabase };
};

export const cleanupGlobalMocks = () => {
  vi.unstubAllGlobals();
  vi.resetModules();
  if ((global as any).__resetNuxtState) {
    (global as any).__resetNuxtState();
  }
};
```

**Step 3: Create globals.d.ts**

```ts
import type { Ref } from 'vue';

declare global {
  function useState<T>(key: string, init?: () => T): Ref<T>;
  function useRouter(): any;
  function useRoute(): any;
  function useRuntimeConfig(): any;
  function useCookie(key: string): any;
  function useNuxtApp(): any;
  function useI18n(): any;
  function navigateTo(to: string, options?: any): any;
  function computed<T>(getter: () => T): any;
  function watch(...args: any[]): any;
  function watchEffect(effect: () => void): any;
  function onMounted(hook: () => void): void;
  function onUnmounted(hook: () => void): void;
  function onBeforeUnmount(hook: () => void): void;
  function nextTick(): Promise<void>;
  function ref<T>(value: T): Ref<T>;
  function reactive<T>(target: T): T;
  function readonly<T>(target: T): T;
  function definePageMeta(meta: any): void;
  function useHead(head: any): void;
  function useSeoMeta(meta: any): void;
  function __resetNuxtState(): void;
}

export {};
```

**Step 4: Commit**

```bash
git add tests/setup/mockSupabase.ts tests/setup/testHelpers.ts tests/setup/globals.d.ts
git commit -m "chore: add Supabase mock client and test helper utilities"
```

---

## Task 5: Sanity Test — Verify Infrastructure Works

**Files:**

- Create: `tests/sanity.test.ts`

**Step 1: Write a trivial sanity test**

```ts
import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('global mocks are available', () => {
    expect(typeof useRouter).toBe('function');
    expect(typeof useRoute).toBe('function');
    expect(typeof useRuntimeConfig).toBe('function');
    expect(typeof useState).toBe('function');
    expect(typeof navigateTo).toBe('function');
    expect(typeof ref).toBe('function');
    expect(typeof computed).toBe('function');
  });

  it('useState works with state store', () => {
    const count = useState('test-count', () => 0);
    expect(count.value).toBe(0);
    count.value = 5;
    expect(count.value).toBe(5);
  });
});
```

**Step 2: Run tests to verify**

Run: `cd /Users/colegentry/Development/classicminidiy && bun run test`
Expected: 3 tests pass

**Step 3: Commit**

```bash
git add tests/sanity.test.ts
git commit -m "test: add sanity test to verify vitest infrastructure"
```

---

## Task 6: Test `data/models/helper-utils.ts` — Pure Utility Functions

**Files:**

- Create: `tests/unit/data/helper-utils.test.ts`
- Test: `data/models/helper-utils.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  humanFileSize,
  generateArchiveSubmissionMailto,
  determineArchiveType,
  ARCHIVE_TYPES,
} from '~/data/models/helper-utils';

describe('humanFileSize', () => {
  it('formats bytes in binary (default)', () => {
    expect(humanFileSize(0)).toBe('0 B');
    expect(humanFileSize(1024)).toBe('1.0 KiB');
    expect(humanFileSize(1048576)).toBe('1.0 MiB');
    expect(humanFileSize(1073741824)).toBe('1.0 GiB');
  });

  it('formats bytes in SI units', () => {
    expect(humanFileSize(1000, true)).toBe('1.0 kB');
    expect(humanFileSize(1000000, true)).toBe('1.0 MB');
  });

  it('respects decimal places', () => {
    expect(humanFileSize(1536, false, 2)).toBe('1.50 KiB');
    expect(humanFileSize(1536, false, 0)).toBe('2 KiB');
  });

  it('handles negative values', () => {
    expect(humanFileSize(-1024)).toBe('-1.0 KiB');
  });
});

describe('generateArchiveSubmissionMailto', () => {
  it('generates mailto for specific archive type', () => {
    const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.MANUAL, {
      title: 'Workshop Manual',
      url: 'https://example.com',
      body: 'Test body',
      code: 'WM-001',
    });
    expect(result).toContain('mailto:classicminidiy@gmail.com');
    expect(result).toContain('Workshop%20Manual');
  });

  it('generates simple mailto for GENERIC type', () => {
    const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.GENERIC, {
      title: 'Generic Item',
      url: '',
      body: '',
      code: '',
    });
    expect(result).toContain('mailto:classicminidiy@gmail.com');
  });
});

describe('determineArchiveType', () => {
  it('determines type from URL path', () => {
    expect(determineArchiveType('/archive/manuals/some-manual')).toBe(ARCHIVE_TYPES.MANUAL);
    expect(determineArchiveType('/archive/adverts/some-advert')).toBe(ARCHIVE_TYPES.ADVERT);
    expect(determineArchiveType('/archive/catalogues/some-cat')).toBe(ARCHIVE_TYPES.CATALOGUE);
    expect(determineArchiveType('/archive/tuning/some-guide')).toBe(ARCHIVE_TYPES.TUNING);
    expect(determineArchiveType('/archive/electrical/diagrams')).toBe(ARCHIVE_TYPES.ELECTRICAL);
  });

  it('falls back to GENERIC for unknown paths', () => {
    expect(determineArchiveType('/some/other/path')).toBe(ARCHIVE_TYPES.GENERIC);
    expect(determineArchiveType('')).toBe(ARCHIVE_TYPES.GENERIC);
  });
});
```

**Step 2: Run tests**

Run: `bun run test tests/unit/data/helper-utils.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add tests/unit/data/helper-utils.test.ts
git commit -m "test: add unit tests for helper-utils (humanFileSize, determineArchiveType, mailto)"
```

---

## Task 7: Test `server/utils/cache.ts` — In-Memory TTL Cache

**Files:**

- Create: `tests/unit/server/utils/cache.test.ts`
- Test: `server/utils/cache.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('server/utils/cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for missing keys', async () => {
    const { getCached } = await import('~/server/utils/cache');
    const result = await getCached('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves values', async () => {
    const { getCached, setCache } = await import('~/server/utils/cache');
    await setCache('test-key', { foo: 'bar' }, 60);
    const result = await getCached<{ foo: string }>('test-key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('expires entries after TTL', async () => {
    const { getCached, setCache } = await import('~/server/utils/cache');
    await setCache('expiring', 'value', 10); // 10 seconds
    vi.advanceTimersByTime(11000); // 11 seconds
    const result = await getCached('expiring');
    expect(result).toBeNull();
  });

  it('does not expire entries before TTL', async () => {
    const { getCached, setCache } = await import('~/server/utils/cache');
    await setCache('still-valid', 'value', 60);
    vi.advanceTimersByTime(30000); // 30 seconds
    const result = await getCached('still-valid');
    expect(result).toBe('value');
  });

  it('uses default TTL of 3600 seconds', async () => {
    const { getCached, setCache } = await import('~/server/utils/cache');
    await setCache('default-ttl', 'value');
    vi.advanceTimersByTime(3500 * 1000); // 3500 seconds
    expect(await getCached('default-ttl')).toBe('value');
    vi.advanceTimersByTime(200 * 1000); // 3700 seconds total
    expect(await getCached('default-ttl')).toBeNull();
  });

  it('overwrites existing keys', async () => {
    const { getCached, setCache } = await import('~/server/utils/cache');
    await setCache('key', 'first');
    await setCache('key', 'second');
    expect(await getCached('key')).toBe('second');
  });
});
```

**Step 2: Run tests**

Run: `bun run test tests/unit/server/utils/cache.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add tests/unit/server/utils/cache.test.ts
git commit -m "test: add unit tests for server TTL cache utility"
```

---

## Task 8: Test `app/composables/useDebounce.ts` — Pure Reactive Utilities

**Files:**

- Create: `tests/unit/composables/useDebounce.test.ts`
- Test: `app/composables/useDebounce.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces a reactive ref value', async () => {
    const { useDebounce } = await import('~/app/composables/useDebounce');
    const source = ref('initial');
    const debounced = useDebounce(source, 300);

    expect(debounced.value).toBe('initial');

    source.value = 'updated';
    await nextTick();
    // Should not have updated yet
    expect(debounced.value).toBe('initial');

    vi.advanceTimersByTime(300);
    await nextTick();
    expect(debounced.value).toBe('updated');
  });

  it('resets timer on rapid changes', async () => {
    const { useDebounce } = await import('~/app/composables/useDebounce');
    const source = ref('a');
    const debounced = useDebounce(source, 300);

    source.value = 'b';
    await nextTick();
    vi.advanceTimersByTime(200);

    source.value = 'c';
    await nextTick();
    vi.advanceTimersByTime(200);

    // Still shouldn't have updated (timer reset)
    expect(debounced.value).toBe('a');

    vi.advanceTimersByTime(100);
    await nextTick();
    expect(debounced.value).toBe('c');
  });

  it('uses default delay of 300ms', async () => {
    const { useDebounce } = await import('~/app/composables/useDebounce');
    const source = ref(0);
    const debounced = useDebounce(source);

    source.value = 1;
    await nextTick();
    vi.advanceTimersByTime(299);
    await nextTick();
    expect(debounced.value).toBe(0);

    vi.advanceTimersByTime(1);
    await nextTick();
    expect(debounced.value).toBe(1);
  });
});

describe('useDebouncedFunction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces function calls', async () => {
    const { useDebouncedFunction } = await import('~/app/composables/useDebounce');
    const fn = vi.fn();
    const debounced = useDebouncedFunction(fn, 200);

    debounced('a');
    debounced('b');
    debounced('c');

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});

describe('useThrottledFunction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throttles function calls', async () => {
    const { useThrottledFunction } = await import('~/app/composables/useDebounce');
    const fn = vi.fn();
    const throttled = useThrottledFunction(fn, 100);

    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1); // Still 1, throttled

    vi.advanceTimersByTime(100);
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith('c');
  });
});
```

**Step 2: Run tests**

Run: `bun run test tests/unit/composables/useDebounce.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add tests/unit/composables/useDebounce.test.ts
git commit -m "test: add unit tests for useDebounce composable"
```

---

## Task 9: Test `app/composables/usePersistentThread.ts` — localStorage Thread Persistence

**Files:**

- Create: `tests/unit/composables/usePersistentThread.test.ts`
- Test: `app/composables/usePersistentThread.ts`

**Step 1: Write tests**

Test localStorage persistence, expiry, auto-cleanup, and SSR guards. Mock `localStorage` and use `vi.useFakeTimers()` for expiry tests.

Key test cases:

- `persistThread` writes to localStorage with correct keys
- `getThreadData` reads and parses stored data
- `clearPersistedThread` removes keys and nulls ref
- `isThreadExpired` computed returns true after 24h
- `updateThreadUsage` extends expiry
- `initializeThread` loads existing thread from localStorage
- SSR guard: no localStorage access when `process.client` is false

**Step 2: Run tests**

Run: `bun run test tests/unit/composables/usePersistentThread.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add tests/unit/composables/usePersistentThread.test.ts
git commit -m "test: add unit tests for usePersistentThread composable"
```

---

## Task 10: Test `app/composables/useColors.ts` — Supabase CRUD Composable

**Files:**

- Create: `tests/unit/composables/useColors.test.ts`
- Test: `app/composables/useColors.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { createMockSupabaseClient, mockProfile } from '../../setup/mockSupabase';
import { createMockAuth, cleanupGlobalMocks } from '../../setup/testHelpers';

describe('useColors', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.resetModules();
    mockSupabase = createMockSupabaseClient();
    vi.stubGlobal('useSupabase', () => mockSupabase);
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
    }));
  });

  afterEach(() => {
    cleanupGlobalMocks();
  });

  describe('listColors', () => {
    it('queries approved colors ordered by name', async () => {
      const mockColors = [
        { id: '1', name: 'Almond Green', code: 'AG', status: 'approved' },
        { id: '2', name: 'British Racing Green', code: 'BRG', status: 'approved' },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve) => resolve({ data: mockColors, error: null }));

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(mockSupabase.from).toHaveBeenCalledWith('colors');
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(result).toHaveLength(2);
    });

    it('throws on Supabase error', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: { message: 'DB error' } }));

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      await expect(listColors()).rejects.toThrow();
    });
  });

  describe('getColor', () => {
    it('fetches a single color by id', async () => {
      const mockColor = { id: '1', name: 'Tartan Red', code: 'TR' };
      mockSupabase._queryBuilder.single.mockResolvedValue({ data: mockColor, error: null });

      const { useColors } = await import('~/app/composables/useColors');
      const { getColor } = useColors();
      const result = await getColor('1');

      expect(mockSupabase.from).toHaveBeenCalledWith('colors');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', '1');
      expect(result).toBeTruthy();
    });
  });

  describe('checkDuplicate', () => {
    it('returns true when color code exists', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) => resolve({ data: [{ id: '1' }], error: null }));

      const { useColors } = await import('~/app/composables/useColors');
      const { checkDuplicate } = useColors();
      const result = await checkDuplicate('BRG');

      expect(result).toBe(true);
    });

    it('returns false when color code does not exist', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) => resolve({ data: [], error: null }));

      const { useColors } = await import('~/app/composables/useColors');
      const { checkDuplicate } = useColors();
      const result = await checkDuplicate('UNKNOWN');

      expect(result).toBe(false);
    });
  });

  describe('submitColor', () => {
    it('requires authentication', async () => {
      const mockAuth = createMockAuth(null); // not authenticated
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useColors } = await import('~/app/composables/useColors');
      const { submitColor } = useColors();
      await expect(submitColor({ name: 'Test' })).rejects.toThrow();
    });

    it('inserts into submission_queue when authenticated', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.single.mockResolvedValue({ data: { id: 'sub-1' }, error: null });

      const { useColors } = await import('~/app/composables/useColors');
      const { submitColor } = useColors();
      await submitColor({ name: 'New Color', code: 'NC' });

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._queryBuilder.insert).toHaveBeenCalled();
    });
  });

  describe('getSwatchUrl', () => {
    it('builds correct storage URL', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();
      const url = getSwatchUrl('colors/swatch.png');

      expect(url).toContain('test.supabase.co');
      expect(url).toContain('archive-colors');
      expect(url).toContain('colors/swatch.png');
    });

    it('handles null path', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();
      const url = getSwatchUrl(null);
      expect(typeof url).toBe('string');
    });
  });
});
```

**Step 2: Run tests**

Run: `bun run test tests/unit/composables/useColors.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add tests/unit/composables/useColors.test.ts
git commit -m "test: add unit tests for useColors composable"
```

---

## Task 11: Test `app/composables/useWheels.ts`

**Files:**

- Create: `tests/unit/composables/useWheels.test.ts`
- Test: `app/composables/useWheels.ts`

Key test cases:

- `listAll` queries approved wheels ordered by name
- `listBySize` filters by numeric size
- `listBySizeName` maps string names to numbers ('ten'→10, 'twelve'→12, 'thirteen'→13, 'list'→all)
- `getWheel` fetches single wheel by id (no status filter)
- `submitWheel` requires auth and inserts into submission_queue
- `getPhotoUrl` builds correct storage URL
- Error handling on Supabase failures

Follow same pattern as Task 10 (useColors).

**Step 2: Run, Step 3: Commit** (same pattern)

---

## Task 12: Test `app/composables/useRegistry.ts`

**Files:**

- Create: `tests/unit/composables/useRegistry.test.ts`
- Test: `app/composables/useRegistry.ts`

Key test cases:

- `listApproved` queries approved registry entries ordered by year desc
- `submitRegistryEntry` requires auth, inserts into submission_queue
- `mapToRegistry` internal helper correctly maps status string to enum code ('P'|'A'|'R')
- Error handling

Follow same pattern as Task 10.

---

## Task 13: Test `app/composables/useContributions.ts`

**Files:**

- Create: `tests/unit/composables/useContributions.test.ts`
- Test: `app/composables/useContributions.ts`

Key test cases:

- `getContributorProfile` returns mapped profile or null
- `listContributions` returns items ordered by created_at desc, respects targetType/limit filters
- `getContributionStats` returns counts grouped by target_type
- Error handling

---

## Task 14: Test `app/composables/useSubmissions.ts`

**Files:**

- Create: `tests/unit/composables/useSubmissions.test.ts`
- Test: `app/composables/useSubmissions.ts`

Key test cases:

- `listMySubmissions` filters by current user ID, supports status/targetType filters
- `submitNewItem` inserts with correct target_type
- `submitEditSuggestion` inserts with type='edit_suggestion' and changes payload
- `getSubmission` fetches by ID with maybeSingle
- Requires auth at composable init time (unlike other composables)

---

## Task 15: Test `app/composables/useArchiveDocuments.ts`

**Files:**

- Create: `tests/unit/composables/useArchiveDocuments.test.ts`
- Test: `app/composables/useArchiveDocuments.ts`

Key test cases:

- `listByType` queries by type, sorts downloads-first
- `listAll` supports type/search/sort options
- `listCollections` returns collections with item counts
- `getByPath` two-pass lookup: tries legacy_slug first, then slug
- `getDocumentBySlug` fetches by slug
- `getCollectionBySlug` fetches collection + its documents
- `submitDocument` requires auth
- `getStorageUrl` / `getThumbnailUrl` builds correct URLs

---

## Task 16: Test `app/composables/useAuth.ts`

**Files:**

- Create: `tests/unit/composables/useAuth.test.ts`
- Test: `app/composables/useAuth.ts`

This is the most complex composable. Use `vi.resetModules()` + dynamic imports since it reads state at module load time.

Key test cases:

- `initAuth` calls `getSession` and sets up `onAuthStateChange`
- `initAuth` is singleton (calling twice doesn't duplicate subscriptions)
- `waitForAuth` resolves when auth loads, rejects on timeout
- `signInWithEmail` sends OTP via Supabase
- `signInWithOAuth` redirects for Google/Apple
- `signOut` clears user and profile state
- `isAuthenticated` computed is reactive
- `isAdmin` computed reads from userProfile
- `fetchUserProfile` queries profiles table and updates state
- `cleanup` unsubscribes auth listener
- Error handling on all auth operations

---

## Task 17: Test `app/composables/usePostHog.ts`

**Files:**

- Create: `tests/unit/composables/usePostHog.test.ts`
- Test: `app/composables/usePostHog.ts`

Key test cases:

- `capture` no-ops when PostHog not initialized
- `capture` forwards to PostHog when available
- `identify` no-ops when not initialized, forwards when available
- `reset` no-ops when not initialized, forwards when available

---

## Task 18: Test `app/middleware/oldRouteRedirect.global.ts`

**Files:**

- Create: `tests/unit/middleware/oldRouteRedirect.test.ts`
- Test: `app/middleware/oldRouteRedirect.global.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);

describe('oldRouteRedirect middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    vi.stubGlobal('navigateTo', vi.fn());
  });

  const redirectCases = [
    { path: '/technical/colors', expected: '/archive/colors' },
    { path: '/technical/manuals', expected: '/archive/documents?type=manual' },
    { path: '/technical/wheels', expected: '/archive/wheels' },
    { path: '/technical/electrical', expected: '/archive/electrical' },
    { path: '/technical/engines', expected: '/archive/engines' },
    { path: '/technical/chassisDecoder', expected: '/technical/chassis-decoder' },
    { path: '/technical/chasisDecoder', expected: '/technical/chassis-decoder' },
    { path: '/technical/engineDecoder', expected: '/technical/engine-decoder' },
    { path: '/registry', expected: '/archive/registry' },
    { path: '/archive/carbs', expected: '/archive/documents?type=tuning' },
  ];

  for (const { path, expected } of redirectCases) {
    it(`redirects ${path} to ${expected}`, async () => {
      const mod = await import('~/app/middleware/oldRouteRedirect.global');
      mod.default({ path, fullPath: path } as any, {} as any);
      expect((global as any).navigateTo).toHaveBeenCalledWith(expected, expect.objectContaining({ redirectCode: 301 }));
    });
  }

  it('does not redirect non-legacy paths', async () => {
    const mod = await import('~/app/middleware/oldRouteRedirect.global');
    mod.default({ path: '/archive/documents', fullPath: '/archive/documents' } as any, {} as any);
    expect((global as any).navigateTo).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run, Step 3: Commit**

---

## Task 19: Test `app/middleware/admin.global.ts`

**Files:**

- Create: `tests/unit/middleware/admin.test.ts`
- Test: `app/middleware/admin.global.ts`

Key test cases:

- No-op for non-admin routes
- No-op during SSR (`import.meta.server`)
- Redirects to `/login` when not authenticated
- Redirects to `/login` when authenticated but not admin
- Allows access when authenticated and admin
- Calls `waitForAuth()` before checking auth state

---

## Task 20: Test `server/middleware/mcp-auth.ts`

**Files:**

- Create: `tests/unit/server/middleware/mcp-auth.test.ts`
- Test: `server/middleware/mcp-auth.ts`

Requires mocking Nitro globals (`defineEventHandler`, `getRequestURL`, `getHeader`, `createError`, `useRuntimeConfig`).

Key test cases:

- Passes through non-`/mcp` routes
- Rejects requests without Bearer token (401)
- Rejects invalid Bearer tokens (403)
- Accepts valid MCP_API_KEY
- Accepts comma-separated MCP_API_KEYS
- Accepts dev key in development mode
- Case-insensitive `bearer` prefix handling

---

## Task 21: Test `server/middleware/legacy-archive-redirect.ts`

**Files:**

- Create: `tests/unit/server/middleware/legacy-archive-redirect.test.ts`
- Test: `server/middleware/legacy-archive-redirect.ts`

Key test cases:

- Passes through non-legacy paths
- Redirects `/archive/manuals/:slug` when found by `legacy_slug`
- Falls back to `slug` lookup when `legacy_slug` fails
- No redirect when slug not found in database
- Handles Supabase errors gracefully (continues without redirect)

---

## Task 22: Test Static Data API Endpoints

**Files:**

- Create: `tests/unit/server/api/static-data.test.ts`
- Test: `server/api/clearance.ts`, `engines.ts`, `torque.ts`, `weights.ts`, `parts.ts`, `gearing.ts`

All share the same pattern: import data, set cache headers, return spread data.

```ts
/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Nitro globals
vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('setResponseHeaders', vi.fn());
vi.stubGlobal('createError', (opts: any) => new Error(opts.message || opts.statusMessage));

describe('Static Data Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clearance endpoint returns data', async () => {
    const handler = (await import('~/server/api/clearance')).default;
    const result = await handler({} as any);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('object');
  });

  it('engines endpoint returns data', async () => {
    const handler = (await import('~/server/api/engines')).default;
    const result = await handler({} as any);
    expect(result).toBeTruthy();
  });

  it('torque endpoint returns data', async () => {
    const handler = (await import('~/server/api/torque')).default;
    const result = await handler({} as any);
    expect(result).toBeTruthy();
  });

  it('weights endpoint returns data', async () => {
    const handler = (await import('~/server/api/weights')).default;
    const result = await handler({} as any);
    expect(result).toBeTruthy();
  });

  it('parts endpoint returns data', async () => {
    const handler = (await import('~/server/api/parts')).default;
    const result = await handler({} as any);
    expect(result).toBeTruthy();
  });

  it('gearing endpoint returns data', async () => {
    const handler = (await import('~/server/api/gearing')).default;
    const result = await handler({} as any);
    expect(result).toBeTruthy();
    expect(result).toHaveProperty('tires');
    expect(result).toHaveProperty('diffs');
  });
});
```

---

## Task 23: Test `server/api/decoders/engine.ts`

**Files:**

- Create: `tests/unit/server/api/decoders/engine.test.ts`
- Test: `server/api/decoders/engine.ts`

Key test cases:

- Returns engine code data
- Sets 1-year cache headers
- Data has expected structure

---

## Task 24: Test `server/api/decoders/chassis.ts` — Complex Decoder Logic

**Files:**

- Create: `tests/unit/server/api/decoders/chassis.test.ts`
- Test: `server/api/decoders/chassis.ts`

This is the highest-value test target — 567 lines of position-by-position parsing logic.

Key test cases:

- Rejects non-PUT methods
- Validates required fields (yearRange, chassisNumber)
- Validates input length limits (50 chars chassis, 20 chars yearRange)
- Validates charset (only alphanumeric, hyphens, spaces, slashes)
- Rejects unknown yearRange values
- **For each year range, test at least one valid chassis number:**
  - `1959-1969`: e.g., `A-A2S7-123456-A`
  - `1969-1974`: e.g., `X-A-D2S-1-123456-A`
  - `1974-1980`: e.g., test appropriate format
  - `1980`: e.g., test appropriate format
  - `1980-1985`: e.g., test appropriate format
  - `1985-1990`: e.g., test appropriate format
  - `1990-on`: e.g., `SAXXNNAYNBD123456`
- Tests for optional/missing positions (assembly plant, trim level)
- Tests for separator handling (`-`, `/`, space)
- Tests for production sequence number extraction

NOTE: Read the actual `chassisRanges` data from `data/models/decoders.ts` to construct valid test inputs. Use the `PrimaryExample` field from each range as the valid chassis number to decode.

---

## Task 25: Test `server/api/needles/list.ts` and `suggested.ts`

**Files:**

- Create: `tests/unit/server/api/needles.test.ts`
- Test: `server/api/needles/list.ts`, `server/api/needles/suggested.ts`

Key test cases:

- `list` returns `{ all, initial }` shape
- `suggested` returns data
- Both set 1-day cache headers

---

## Task 26: Test `server/utils/adminAuth.ts`

**Files:**

- Create: `tests/unit/server/utils/adminAuth.test.ts`
- Test: `server/utils/adminAuth.ts`

Mock `@supabase/supabase-js` createClient and Nitro globals.

Key test cases for `requireAdminAuth`:

- Extracts Bearer token from Authorization header
- Extracts token from Supabase auth cookie (JSON string format)
- Extracts token from Supabase auth cookie (JSON array format)
- Throws 401 when no token found
- Throws 401 when token is invalid (getUser fails)
- Throws 403 when user is not admin
- Returns user and profile on success

Key test cases for `isAdminAuthenticated`:

- Returns true on valid admin auth
- Returns false on any error

---

## Task 27: Test `server/api/admin/queue/*.ts` — Admin Queue Endpoints

**Files:**

- Create: `tests/unit/server/api/admin/queue.test.ts`
- Test: `server/api/admin/queue/list.ts`, `count.ts`, `approve.post.ts`, `reject.post.ts`

Mock `requireAdminAuth`, `getServiceClient`, and Nitro globals.

Key test cases:

- All endpoints require admin auth (call `requireAdminAuth`)
- `list`: respects `targetType` and `status` query params, returns mapped submissions
- `count`: returns `{ count }` for pending items, respects `targetType` filter
- `approve.post`: validates required `id`, fetches submission, dispatches to correct handler by type
- `approve.post`: handles `new_item` type with each target_type (color, wheel, registry, document)
- `approve.post`: handles `edit_suggestion` type
- `reject.post`: validates required `id`, updates status to 'rejected'

---

## Task 28: Test MCP Tools — Compression Calculator

**Files:**

- Create: `tests/unit/server/mcp/compression-calculator.test.ts`
- Test: `server/mcp/tools/compression-calculator.ts`

Mock `defineMcpTool` to extract the handler function, then test the pure math.

Key test cases:

- Stock 1275cc: bore=7.06, stroke=8.128 → known compression ratio (~8.3-9.5:1 depending on volumes)
- Stock 998cc: verify capacity calculation
- Custom gasket volume (when gasket=0, use customGasket)
- Zero decomp plate
- Non-zero decomp plate reduces ratio
- All input fields passed through to results
- Context labels match formOptions lookups

---

## Task 29: Test MCP Tools — Gearbox Calculator

**Files:**

- Create: `tests/unit/server/mcp/gearbox-calculator.test.ts`
- Test: `server/mcp/tools/gearbox-calculator.ts`

Key test cases:

- Default inputs produce sensible top speed (50-120 mph range)
- Metric mode multiplies by kphFactor (1.60934)
- Each gear has lower max speed than the next (1st < 2nd < 3rd < 4th)
- Tire diameter calculation: `width * (profile/100) * 2 + size * 25.4`
- Speedometer compatibility: perfect match when turns match
- Context labels match options lookups

---

## Task 30: Test `data/models/gearing.ts` — Exported Constants

**Files:**

- Create: `tests/unit/data/gearing.test.ts`
- Test: `data/models/gearing.ts`

Key test cases:

- `kphFactor` equals 1.60934
- `options.tires` has 17 entries, each with width/profile/size
- `options.diffs` has 20 entries, each with numeric value
- `options.gearRatios` has 18 entries, each with exactly 4-element ratio array
- `options.speedos` has both `metric` and `imperial` arrays
- All entries have `label` strings

---

## Task 31: Test `data/models/compression.ts` — Form Options Data

**Files:**

- Create: `tests/unit/data/compression.test.ts`
- Test: `data/models/compression.ts`

Key test cases:

- `formOptions.pistonOptions` has 17 entries with numeric values
- `formOptions.crankshaftOptions` has 10 entries
- `formOptions.headGasketOptions` has 7 entries, includes value=0 sentinel
- `formOptions.decompPlateOptions` has 7 entries, first has value=0 (none)

---

## Task 32: Test `server/api/youtube/stats.ts` and `videos.ts`

**Files:**

- Create: `tests/unit/server/api/youtube.test.ts`
- Test: `server/api/youtube/stats.ts`, `server/api/youtube/videos.ts`

Mock `axios` to avoid real HTTP calls.

Key test cases:

- `stats`: returns formatted view/subscriber/video counts
- `stats`: handles YouTube API errors
- `stats`: retries on failure (up to 3 times)
- `videos`: returns array of ≤3 video objects with title, thumbnails, publishedOn, videoUrl
- `videos`: handles YouTube API errors

---

## Task 33: Test `server/api/github/commits.ts` and `releases.ts`

**Files:**

- Create: `tests/unit/server/api/github.test.ts`
- Test: `server/api/github/commits.ts`, `server/api/github/releases.ts`

Mock `@octokit/core` to avoid real HTTP calls.

Key test cases:

- `commits`: returns commits with formatted date fields
- `commits`: handles timeout (504)
- `commits`: handles GitHub API errors
- `releases`: returns `{ latestRelease, releases }` shape
- `releases`: returns 'No releases' when empty

---

## Task 34: Test `app/composables/useSupabase.ts`

**Files:**

- Create: `tests/unit/composables/useSupabase.test.ts`
- Test: `app/composables/useSupabase.ts`

Key test cases:

- Client-side: returns singleton (same instance on multiple calls)
- Client-side: configures `persistSession: true`, `autoRefreshToken: true`
- Server-side: creates fresh instance per call
- Server-side: configures `persistSession: false`
- Reads supabaseUrl and supabaseKey from runtime config

This requires `vi.mock('@supabase/supabase-js')` to mock the `createClient` function.

---

## Task 35: Test `app/composables/useStreamProvider.ts`

**Files:**

- Create: `tests/unit/composables/useStreamProvider.test.ts`
- Test: `app/composables/useStreamProvider.ts`

Key test cases for `useStreamProvider`:

- Returns correct shape (assistantId, threadId, isConfigured, etc.)
- `setThreadId` updates threadId ref
- `createNewThread` clears thread data
- Delegates to usePersistentThread for storage

Key test cases for `createStreamSession`:

- `submit` sends POST to correct langgraph endpoint
- Handles SSE stream events (messages/partial, messages/complete, updates, values)
- `stop` aborts the stream
- Error state set on failed fetch

Mock `fetch` globally for HTTP call tests.

---

## Task 36: Run Full Test Suite and Generate Coverage Report

**Step 1: Run all tests**

Run: `cd /Users/colegentry/Development/classicminidiy && bun run test`
Expected: All tests pass

**Step 2: Generate coverage report**

Run: `bun run test:coverage`
Expected: Coverage report generated, targeting ≥95% for tested files

**Step 3: Review coverage gaps and create follow-up tasks if needed**

---

## Task 37: Final Commit — All Tests

```bash
git add tests/ vitest.config.ts package.json bun.lock
git commit -m "test: comprehensive unit test suite targeting 95% coverage

Adds Vitest infrastructure and 30+ test files covering:
- All 12 composables (auth, colors, wheels, registry, etc.)
- Server utilities (cache, adminAuth, supabase)
- Server middleware (MCP auth, legacy redirects)
- App middleware (admin guard, legacy route redirects)
- All static data API endpoints
- Chassis decoder (complex parsing logic)
- MCP calculator tools (compression, gearbox)
- YouTube/GitHub API endpoints
- Data model utilities and constants"
```

---

## Summary

| Category          | Files  | Test Files | Key Patterns                                                                     |
| ----------------- | ------ | ---------- | -------------------------------------------------------------------------------- |
| Composables       | 12     | 12         | `vi.stubGlobal('useSupabase')`, mock query chains, `vi.resetModules()` for state |
| Server Utils      | 3      | 3          | `vi.useFakeTimers()` for cache, mock `createClient` for Supabase                 |
| Server Middleware | 2      | 2          | Mock Nitro globals, `defineEventHandler` identity stub                           |
| App Middleware    | 2      | 2          | `defineNuxtRouteMiddleware` identity stub, mock `navigateTo`                     |
| Server API Routes | 18     | 7          | `defineEventHandler` identity, mock external APIs                                |
| MCP Tools         | 2      | 2          | `defineMcpTool` extraction, pure math assertions                                 |
| Data Models       | 3      | 3          | Pure data validation, no mocking needed                                          |
| **Total**         | **42** | **31**     |                                                                                  |
