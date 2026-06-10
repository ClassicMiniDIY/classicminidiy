// @vitest-environment happy-dom
/**
 * Membership page (app/pages/membership/index.vue) — pre-launch punch list D1.
 *
 * Covers:
 *  - post-checkout activation poll on ?subscribed=1 (webhook race window):
 *    "Activating…" instead of the subscribe CTA, member area once the gate
 *    flips, gentle timeout note after ~30s
 *  - platform-aware manage branches: ghost / patreon / unknown-null fallback
 *  - hero "$1.99/month" badge gated on resolved auth (no member flash)
 *  - logged-out subscribe intent carried via /login?redirect=…&auto-start
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed, nextTick } from 'vue';
import MembershipPage from '~/app/pages/membership/index.vue';

const baseUser = { id: 'user-1', email: 'member@example.com' };

interface AuthStubOptions {
  user?: typeof baseUser | null;
  member?: boolean;
  waitForAuth?: () => Promise<boolean>;
}

function makeAuthStub({ user = baseUser, member = false, waitForAuth }: AuthStubOptions = {}) {
  const userRef = ref<typeof baseUser | null>(user);
  const memberRef = ref(member);
  const fetchUserProfile = vi.fn().mockResolvedValue(undefined);
  const stub = {
    user: userRef,
    isAuthenticated: computed(() => !!userRef.value),
    isSustainingMember: computed(() => memberRef.value),
    waitForAuth: waitForAuth ? vi.fn(waitForAuth) : vi.fn().mockResolvedValue(true),
    fetchUserProfile,
  };
  return { stub, userRef, memberRef, fetchUserProfile };
}

function makeSupabaseStub({ platform = null as string | null } = {}) {
  const rpcSingle = vi.fn().mockResolvedValue({ data: { platform }, error: null });
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
    },
    rpc: vi.fn(() => ({ single: rpcSingle })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    _rpcSingle: rpcSingle,
  };
}

const mountStubs = {
  ProfileSustainingBadge: true,
  NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] },
  ClientOnly: { name: 'ClientOnly', template: '<div><slot /></div>' },
};

let routerReplace: ReturnType<typeof vi.fn>;
let toastAdd: ReturnType<typeof vi.fn>;
let navigateToMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function stubEnvironment({
  query = {} as Record<string, string>,
  auth,
  supabase,
}: {
  query?: Record<string, string>;
  auth: ReturnType<typeof makeAuthStub>;
  supabase?: ReturnType<typeof makeSupabaseStub>;
}) {
  routerReplace = vi.fn();
  toastAdd = vi.fn();
  navigateToMock = vi.fn();
  fetchMock = vi.fn().mockResolvedValue({});

  vi.stubGlobal('useAuth', () => auth.stub);
  vi.stubGlobal('useSupabase', () => supabase ?? makeSupabaseStub());
  vi.stubGlobal('useToast', () => ({ add: toastAdd }));
  vi.stubGlobal('navigateTo', navigateToMock);
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRoute', () => ({
    path: '/membership',
    fullPath: '/membership',
    name: 'membership',
    params: {},
    meta: {},
    matched: [],
    query,
  }));
  vi.stubGlobal('useRouter', () => ({
    push: vi.fn(),
    replace: routerReplace,
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
    currentRoute: { value: { path: '/membership', params: {}, query, name: 'membership' } },
  }));
}

function mountPage() {
  return mount(MembershipPage, { global: { stubs: mountStubs } });
}

/** Drain pending microtask chains without relying on real timers. */
async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
  await nextTick();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  (global as any).__resetNuxtState?.();
});

// ---------------------------------------------------------------------------
// Hero price badge gating (no "$1.99/month" flash for members)
// ---------------------------------------------------------------------------
describe('hero price badge gating', () => {
  it('hides the price badge until auth resolves, then shows it for non-members', async () => {
    let resolveAuth!: (v: boolean) => void;
    const auth = makeAuthStub({
      member: false,
      waitForAuth: () => new Promise<boolean>((resolve) => (resolveAuth = resolve)),
    });
    stubEnvironment({ auth });

    const wrapper = mountPage();
    await flushMicrotasks();

    // Auth unresolved: no badge yet (this is the window where members used to
    // see the price flash).
    expect(wrapper.html()).not.toContain('hero.price');

    resolveAuth(true);
    await flushPromises();
    await nextTick();

    expect(wrapper.html()).toContain('hero.price');
  });

  it('never shows the price badge to a resolved member', async () => {
    const auth = makeAuthStub({ member: true });
    stubEnvironment({ auth, supabase: makeSupabaseStub({ platform: 'stripe' }) });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(wrapper.html()).not.toContain('hero.price');
    expect(wrapper.html()).toContain('member.title');
  });
});

// ---------------------------------------------------------------------------
// Post-checkout activation poll (?subscribed=1)
// ---------------------------------------------------------------------------
describe('activation poll on ?subscribed=1', () => {
  it('shows "Activating…" instead of the subscribe CTA while polling', async () => {
    vi.useFakeTimers();
    const auth = makeAuthStub({ member: false });
    stubEnvironment({ query: { subscribed: '1' }, auth });

    const wrapper = mountPage();
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    // First gate re-pull happened immediately; polling state is live.
    expect(auth.fetchUserProfile).toHaveBeenCalledWith(baseUser.id);
    expect(wrapper.html()).toContain('cta.activating_title');
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
    // The non-member subscribe CTA and price badge are suppressed during the window.
    expect(wrapper.html()).not.toContain('cta.subscribe');
    expect(wrapper.html()).not.toContain('hero.price');
    // The ?subscribed param was stripped so refresh doesn't replay.
    expect(routerReplace).toHaveBeenCalledWith({ query: {} });
    expect(toastAdd).toHaveBeenCalledTimes(1);
  });

  it('flips to the member area once the membership gate goes true', async () => {
    vi.useFakeTimers();
    const auth = makeAuthStub({ member: false });
    // Webhook lands on the third poll.
    auth.fetchUserProfile.mockImplementation(async () => {
      if (auth.fetchUserProfile.mock.calls.length >= 3) auth.memberRef.value = true;
    });
    stubEnvironment({ query: { subscribed: '1' }, auth, supabase: makeSupabaseStub({ platform: 'stripe' }) });

    const wrapper = mountPage();
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(wrapper.html()).toContain('cta.activating_title');

    await vi.advanceTimersByTimeAsync(2000); // poll 2
    await vi.advanceTimersByTimeAsync(2000); // poll 3 — gate flips
    await flushMicrotasks();

    expect(auth.fetchUserProfile).toHaveBeenCalledTimes(3);
    expect(wrapper.html()).not.toContain('cta.activating_title');
    expect(wrapper.html()).toContain('member.title');
  });

  it('shows the gentle timeout note after ~30s without activation', async () => {
    vi.useFakeTimers();
    const auth = makeAuthStub({ member: false });
    stubEnvironment({ query: { subscribed: '1' }, auth });

    const wrapper = mountPage();
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(31000);
    await flushMicrotasks();

    // 15 attempts at ~2s spacing, then a soft landing — no subscribe CTA.
    expect(auth.fetchUserProfile).toHaveBeenCalledTimes(15);
    expect(wrapper.html()).toContain('cta.activation_timeout_title');
    expect(wrapper.html()).not.toContain('cta.activating_title');
    expect(wrapper.html()).not.toContain('cta.subscribe');
  });
});

// ---------------------------------------------------------------------------
// Platform-aware manage branches (get_my_membership().platform)
// ---------------------------------------------------------------------------
describe('manage area platform branches', () => {
  async function mountAsMemberWithPlatform(platform: string | null) {
    const auth = makeAuthStub({ member: true });
    stubEnvironment({ auth, supabase: makeSupabaseStub({ platform }) });
    const wrapper = mountPage();
    await flushPromises();
    await nextTick();
    return wrapper;
  }

  it('ghost members are pointed at their Ghost billing email', async () => {
    const wrapper = await mountAsMemberWithPlatform('ghost');
    expect(wrapper.html()).toContain('member.manage_note_ghost');
    expect(wrapper.html()).not.toContain('member.manage_note_stripe');
  });

  it('patreon members get a manage link to Patreon memberships settings', async () => {
    const wrapper = await mountAsMemberWithPlatform('patreon');
    expect(wrapper.html()).toContain('member.manage_note_patreon');
    const link = wrapper.find('a[href="https://www.patreon.com/settings/memberships"]');
    expect(link.exists()).toBe(true);
  });

  it('unknown/null platform on an active member renders the active fallback, not an empty area', async () => {
    const wrapper = await mountAsMemberWithPlatform(null);
    expect(wrapper.html()).toContain('member.active_fallback');
    expect(wrapper.html()).not.toContain('member.manage_note_stripe');
    expect(wrapper.html()).not.toContain('member.manage_note_store');
  });

  it('unrecognized future platform values also fall back to the active note', async () => {
    const wrapper = await mountAsMemberWithPlatform('somethingnew');
    expect(wrapper.html()).toContain('member.active_fallback');
  });
});

// ---------------------------------------------------------------------------
// Logged-out subscribe intent (?subscribe=1 round trip)
// ---------------------------------------------------------------------------
describe('subscribe intent preservation', () => {
  it('logged-out sign-in CTA carries the subscribe intent through /login?redirect=…', async () => {
    const auth = makeAuthStub({ user: null });
    stubEnvironment({ auth });

    const wrapper = mountPage();
    await flushPromises();
    await nextTick();

    const signin = wrapper.find(`a[href="/login?redirect=${encodeURIComponent('/membership?subscribe=1')}"]`);
    expect(signin.exists()).toBe(true);
  });

  it('auto-starts checkout when an authenticated non-member returns with ?subscribe=1', async () => {
    const auth = makeAuthStub({ member: false });
    stubEnvironment({ query: { subscribe: '1' }, auth });
    fetchMock.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });

    mountPage();
    await flushPromises();

    // Param stripped, checkout proxy hit, browser sent to Stripe.
    expect(routerReplace).toHaveBeenCalledWith({ query: {} });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/membership/checkout',
      expect.objectContaining({ method: 'POST', headers: { authorization: 'Bearer test-token' } })
    );
    expect(navigateToMock).toHaveBeenCalledWith('https://checkout.stripe.test/session', { external: true });
  });

  it('does not auto-start checkout for an already-active member with ?subscribe=1', async () => {
    const auth = makeAuthStub({ member: true });
    stubEnvironment({ query: { subscribe: '1' }, auth, supabase: makeSupabaseStub({ platform: 'stripe' }) });

    mountPage();
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerReplace).toHaveBeenCalledWith({ query: {} });
  });
});
