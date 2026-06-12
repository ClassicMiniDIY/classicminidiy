// @vitest-environment happy-dom
/**
 * Membership claim page (app/pages/membership/claim.vue) — inbound channels.
 *
 * The Ghost-direct / Patreon reconciliation emails link unmatched payers to
 * /membership/claim?code=<claim_jti>. Covers:
 *  - missing/blank ?code= → friendly error card, RPC never called
 *  - logged out → /login?redirect=… intent that survives the encode/decode
 *    round trip through sanitizeRedirectPath (the same validator /login and
 *    /auth/callback use)
 *  - signed in → claim_external_membership(p_code) → success card + toast +
 *    navigate to /membership
 *  - distinct error states: already-claimed (other account), invalid code,
 *    expired link, transient RPC failure with a retry affordance
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed, nextTick, reactive } from 'vue';
import ClaimPage from '~/app/pages/membership/claim.vue';
import { sanitizeRedirectPath } from '~/app/utils/redirect';

const baseUser = { id: 'user-1', email: 'patron@example.com' };
const CODE = '4f9d2c6a-1b3e-4a5d-9c7f-8e6b5a4d3c2b';

interface AuthStubOptions {
  user?: typeof baseUser | null;
}

function makeAuthStub({ user = baseUser }: AuthStubOptions = {}) {
  const userRef = ref<typeof baseUser | null>(user);
  const fetchUserProfile = vi.fn().mockResolvedValue(undefined);
  const stub = {
    user: userRef,
    isAuthenticated: computed(() => !!userRef.value),
    waitForAuth: vi.fn().mockResolvedValue(true),
    fetchUserProfile,
  };
  return { stub, userRef, fetchUserProfile };
}

/** Stub supabase whose rpc() resolves with the given { data, error } shapes in order. */
function makeSupabaseStub(results: Array<{ data?: unknown; error?: { code?: string; message?: string } | null }>) {
  const rpc = vi.fn();
  for (const result of results) {
    rpc.mockResolvedValueOnce({ data: result.data ?? null, error: result.error ?? null });
  }
  return { rpc };
}

const mountStubs = {
  NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] },
  ClientOnly: { name: 'ClientOnly', template: '<div><slot /></div>' },
};

let toastAdd: ReturnType<typeof vi.fn>;
let navigateToMock: ReturnType<typeof vi.fn>;
let trackMock: ReturnType<typeof vi.fn>;
let routerReplaceMock: ReturnType<typeof vi.fn>;

function stubEnvironment({
  query = {} as Record<string, string>,
  auth,
  supabase,
}: {
  query?: Record<string, string>;
  auth: ReturnType<typeof makeAuthStub>;
  supabase?: ReturnType<typeof makeSupabaseStub>;
}) {
  toastAdd = vi.fn();
  navigateToMock = vi.fn();
  trackMock = vi.fn();

  vi.stubGlobal('useAuth', () => auth.stub);
  vi.stubGlobal('useSupabase', () => supabase ?? makeSupabaseStub([]));
  vi.stubGlobal('useToast', () => ({ add: toastAdd }));
  vi.stubGlobal('useAnalytics', () => ({ track: trackMock }));
  vi.stubGlobal('navigateTo', navigateToMock);
  const routeObj = reactive({
    path: '/membership/claim',
    fullPath: '/membership/claim',
    name: 'membership-claim',
    params: {},
    meta: {},
    matched: [],
    query: { ...query } as Record<string, string>,
  });
  vi.stubGlobal('useRoute', () => routeObj);
  // The page re-syncs a router-lost code via router.replace; mimic the real
  // router by applying the new query to the (reactive) route.
  routerReplaceMock = vi.fn((to: { query?: Record<string, string> }) => {
    if (to?.query) routeObj.query = { ...to.query };
    return Promise.resolve();
  });
  vi.stubGlobal('useRouter', () => ({ replace: routerReplaceMock }));
  return { route: routeObj };
}

function mountPage() {
  return mount(ClaimPage, { global: { stubs: mountStubs } });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
  (global as any).__resetNuxtState?.();
});

// ---------------------------------------------------------------------------
// Missing / blank ?code=
// ---------------------------------------------------------------------------
describe('missing claim code', () => {
  it('shows the friendly missing-code card and never calls the RPC', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([]);
    stubEnvironment({ auth, supabase });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(wrapper.html()).toContain('missing_code.title');
    expect(supabase.rpc).not.toHaveBeenCalled();
    // Link back to the membership page, not a dead end.
    expect(wrapper.find('a[href="/membership"]').exists()).toBe(true);
    expect(trackMock).toHaveBeenCalledWith('membership_claim_failed', expect.objectContaining({ reason: 'missing_code' }));
  });

  it('treats a whitespace-only code as missing', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([]);
    stubEnvironment({ query: { code: '   ' }, auth, supabase });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(wrapper.html()).toContain('missing_code.title');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Logged out → /login?redirect= round trip
// ---------------------------------------------------------------------------
describe('logged-out claim intent', () => {
  it('routes through /login?redirect= preserving the encoded code end-to-end', async () => {
    const auth = makeAuthStub({ user: null });
    stubEnvironment({ query: { code: CODE }, auth });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(wrapper.html()).toContain('signin.cta');
    const expectedPath = `/membership/claim?code=${encodeURIComponent(CODE)}`;
    const link = wrapper.find(`a[href="/login?redirect=${encodeURIComponent(expectedPath)}"]`);
    expect(link.exists()).toBe(true);

    // Simulate the full round trip: the router decodes ?redirect= once for
    // /login (route.query.redirect), which re-validates it with the shared
    // sanitizer before stashing; /auth/callback then navigateTo()s the path
    // and the router decodes ?code= once more on arrival.
    const href = link.attributes('href')!;
    const redirectParam = new URL(href, 'https://classicminidiy.com').searchParams.get('redirect');
    const sanitized = sanitizeRedirectPath(redirectParam);
    expect(sanitized).toBe(expectedPath);
    const restoredCode = new URL(sanitized!, 'https://classicminidiy.com').searchParams.get('code');
    expect(restoredCode).toBe(CODE);
  });

  it('survives the round trip for codes containing reserved URL characters', async () => {
    const trickyCode = 'Ab3/+=&?';
    const auth = makeAuthStub({ user: null });
    stubEnvironment({ query: { code: trickyCode }, auth });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    const link = wrapper.find('a[href^="/login?redirect="]');
    expect(link.exists()).toBe(true);
    const href = link.attributes('href')!;
    const redirectParam = new URL(href, 'https://classicminidiy.com').searchParams.get('redirect');
    const sanitized = sanitizeRedirectPath(redirectParam);
    expect(sanitized).not.toBeNull();
    const restoredCode = new URL(sanitized!, 'https://classicminidiy.com').searchParams.get('code');
    expect(restoredCode).toBe(trickyCode);
  });
});

// ---------------------------------------------------------------------------
// Signed in → success path
// ---------------------------------------------------------------------------
describe('successful claim', () => {
  it('calls the RPC with p_code, shows success, toasts, and navigates to /membership', async () => {
    vi.useFakeTimers();
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([
      { data: [{ platform: 'patreon', status: 'active', expires_at: '2026-07-01T00:00:00Z' }], error: null },
    ]);
    stubEnvironment({ query: { code: CODE }, auth, supabase });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(supabase.rpc).toHaveBeenCalledWith('claim_external_membership', { p_code: CODE });
    expect(wrapper.html()).toContain('success.title');
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }));
    expect(trackMock).toHaveBeenCalledWith(
      'membership_claim_redeemed',
      expect.objectContaining({ source: 'web', platform: 'patreon' })
    );
    // Membership gate refreshed so /membership shows the member area on arrival.
    expect(auth.fetchUserProfile).toHaveBeenCalledWith(baseUser.id);
    // Redirect fires after the short success-card beat.
    expect(navigateToMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(navigateToMock).toHaveBeenCalledWith('/membership');
  });
});

// ---------------------------------------------------------------------------
// Distinct error states
// ---------------------------------------------------------------------------
describe('claim error states', () => {
  async function mountWithRpcError(error: { code?: string; message?: string }) {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([{ data: null, error }]);
    stubEnvironment({ query: { code: CODE }, auth, supabase });
    const wrapper = mountPage();
    await flushPromises();
    await nextTick();
    return { wrapper, supabase };
  }

  it('already-claimed (by another account) gets its own state with a contact fallback', async () => {
    const { wrapper } = await mountWithRpcError({
      code: 'P0002',
      message: 'This membership has already been claimed',
    });

    expect(wrapper.html()).toContain('already_claimed.title');
    expect(wrapper.html()).not.toContain('invalid.title');
    expect(wrapper.find('a[href="/contact"]').exists()).toBe(true);
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(toastAdd).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith(
      'membership_claim_failed',
      expect.objectContaining({ reason: 'already_claimed' })
    );
  });

  it('invalid/unknown code gets the invalid state with a contact fallback', async () => {
    const { wrapper } = await mountWithRpcError({ code: 'P0002', message: 'Invalid or expired claim code' });

    expect(wrapper.html()).toContain('invalid.title');
    expect(wrapper.find('a[href="/contact"]').exists()).toBe(true);
    expect(trackMock).toHaveBeenCalledWith('membership_claim_failed', expect.objectContaining({ reason: 'invalid' }));
  });

  it('a stale 30-day link gets the expired state (a fresh link is re-emailed)', async () => {
    const { wrapper } = await mountWithRpcError({
      code: 'P0002',
      message: 'This claim link has expired; a new one will be emailed shortly',
    });

    expect(wrapper.html()).toContain('expired.title');
    expect(wrapper.html()).not.toContain('invalid.title');
    expect(trackMock).toHaveBeenCalledWith('membership_claim_failed', expect.objectContaining({ reason: 'expired' }));
  });

  it('a transient RPC failure offers a retry that can then succeed', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([
      { data: null, error: { message: 'TypeError: Failed to fetch' } },
      { data: [{ platform: 'ghost', status: 'active', expires_at: null }], error: null },
    ]);
    stubEnvironment({ query: { code: CODE }, auth, supabase });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(wrapper.html()).toContain('error.retry');
    expect(trackMock).toHaveBeenCalledWith('membership_claim_failed', expect.objectContaining({ reason: 'rpc_error' }));

    await wrapper.find('button').trigger('click');
    await flushPromises();
    await nextTick();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(wrapper.html()).toContain('success.title');
    expect(trackMock).toHaveBeenCalledWith(
      'membership_claim_redeemed',
      expect.objectContaining({ source: 'web', platform: 'ghost' })
    );
  });
});


// ---------------------------------------------------------------------------
// Query-loss resilience — the PWA '/' shell / statically-served copy can boot
// the app with the router briefly missing the ?code= even though the address
// bar has it (the /auth/callback failure mode; 2026-06-12 incident: every
// claim email recipient saw "missing its claim code").
// ---------------------------------------------------------------------------
describe('query-loss resilience (PWA shell / static serve)', () => {
  it('falls back to window.location.search when the router lost the code, re-syncs, and redeems', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([{ data: [{ platform: 'patreon' }] }]);
    window.history.replaceState({}, '', `/membership/claim?code=${CODE}`);
    stubEnvironment({ query: {}, auth, supabase });

    const wrapper = mountPage();
    await flushPromises();

    expect(routerReplaceMock).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ code: CODE }) }));
    expect(supabase.rpc).toHaveBeenCalledWith('claim_external_membership', { p_code: CODE });
    expect(wrapper.html()).not.toContain('missing_code.title');
  });

  it('recovers from missing_code when the router syncs the code in late', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([{ data: [{ platform: 'ghost' }] }]);
    const { route } = stubEnvironment({ query: {}, auth, supabase });

    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.html()).toContain('missing_code.title');
    expect(supabase.rpc).not.toHaveBeenCalled();

    route.query = { code: CODE };
    await nextTick();
    await flushPromises();

    expect(supabase.rpc).toHaveBeenCalledWith('claim_external_membership', { p_code: CODE });
    expect(wrapper.html()).not.toContain('missing_code.title');
  });

  it('begins exactly once even if the code arrives via both location fallback and a late router sync', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub([{ data: [{ platform: 'patreon' }] }]);
    window.history.replaceState({}, '', `/membership/claim?code=${CODE}`);
    const { route } = stubEnvironment({ query: {}, auth, supabase });

    mountPage();
    await flushPromises();
    route.query = { code: CODE };
    await nextTick();
    await flushPromises();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
