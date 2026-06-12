// @vitest-environment happy-dom
/**
 * Self-serve Discord connect page (app/pages/discord/connect.vue).
 *
 * The mobile apps' "Claim Discord Access" buttons open /discord/claim with no
 * token; the server proxy routes those bare hits here. The page mints a fresh
 * claim token via POST /api/discord/reissue and re-enters the tokened
 * /discord/claim → Discord OAuth chain. Covers:
 *  - logged out → sign-in card with /login?redirect=/discord/connect intent
 *  - signed in + pending → external navigation to the returned claim URL
 *  - signed in + already linked → "already connected" card with the guild link
 *  - 403 (no active membership) → membership upsell card
 *  - transient failure → error card with a retry that re-calls the proxy
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import ConnectPage from '~/app/pages/discord/connect.vue';

const baseUser = { id: 'user-1', email: 'member@example.com' };

function makeAuthStub({ user = baseUser }: { user?: typeof baseUser | null } = {}) {
  const userRef = ref<typeof baseUser | null>(user);
  return {
    user: userRef,
    isAuthenticated: computed(() => !!userRef.value),
    waitForAuth: vi.fn().mockResolvedValue(true),
  };
}

/** Stub supabase whose getSession resolves with the given access token (or none). */
function makeSupabaseStub(accessToken: string | null = 'access-token') {
  return {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: accessToken ? { access_token: accessToken } : null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

const mountStubs = {
  NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] },
  ClientOnly: { name: 'ClientOnly', template: '<div><slot /></div>' },
};

let navigateToMock: ReturnType<typeof vi.fn>;
let trackMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function stubEnvironment({
  auth,
  supabase,
  fetchImpl,
}: {
  auth: ReturnType<typeof makeAuthStub>;
  supabase?: ReturnType<typeof makeSupabaseStub>;
  fetchImpl?: (...args: unknown[]) => Promise<unknown>;
}) {
  navigateToMock = vi.fn();
  trackMock = vi.fn();
  fetchMock = vi.fn(fetchImpl ?? (() => Promise.resolve({})));

  vi.stubGlobal('useAuth', () => auth);
  vi.stubGlobal('useSupabase', () => supabase ?? makeSupabaseStub());
  vi.stubGlobal('useAnalytics', () => ({ track: trackMock }));
  vi.stubGlobal('navigateTo', navigateToMock);
  vi.stubGlobal('$fetch', fetchMock);
}

function mountPage() {
  return mount(ConnectPage, { global: { stubs: mountStubs } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  (global as any).__resetNuxtState?.();
});

describe('logged out', () => {
  it('shows the sign-in card with the connect intent and never calls the proxy', async () => {
    const auth = makeAuthStub({ user: null });
    stubEnvironment({ auth });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('signin.title');
    const link = wrapper.find('a[href*="/login"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe(`/login?redirect=${encodeURIComponent('/discord/connect')}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('signed in', () => {
  it('pending claim → sends the Bearer token and navigates externally to the claim URL', async () => {
    const auth = makeAuthStub();
    stubEnvironment({
      auth,
      supabase: makeSupabaseStub('tok-123'),
      fetchImpl: () =>
        Promise.resolve({ status: 'pending', claim_url: 'https://classicminidiy.com/discord/claim?token=abc' }),
    });
    mountPage();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/discord/reissue',
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer tok-123' },
      })
    );
    expect(navigateToMock).toHaveBeenCalledWith('https://classicminidiy.com/discord/claim?token=abc', {
      external: true,
    });
    expect(trackMock).toHaveBeenCalledWith('discord_claim_reissued', { source: 'web', result: 'pending' });
  });

  it('already linked → shows the connected card with the guild link', async () => {
    const auth = makeAuthStub();
    stubEnvironment({
      auth,
      fetchImpl: () => Promise.resolve({ status: 'active', discord_url: 'https://discord.com/channels/123' }),
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('active.title');
    const guildLink = wrapper.find('a[href="https://discord.com/channels/123"]');
    expect(guildLink.exists()).toBe(true);
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('discord_claim_reissued', { source: 'web', result: 'already_active' });
  });

  it('no web session despite auth state → routes through sign-in with intent', async () => {
    const auth = makeAuthStub();
    stubEnvironment({ auth, supabase: makeSupabaseStub(null) });
    mountPage();
    await flushPromises();

    expect(navigateToMock).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/discord/connect')}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('403 from the proxy → membership upsell card, no retry loop', async () => {
    const auth = makeAuthStub();
    stubEnvironment({
      auth,
      fetchImpl: () => Promise.reject(Object.assign(new Error('forbidden'), { statusCode: 403 })),
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('not_member.title');
    expect(wrapper.find('a[href="/membership"]').exists()).toBe(true);
    expect(trackMock).toHaveBeenCalledWith('discord_claim_reissue_failed', { source: 'web', reason: 'not_member' });
  });

  it('401 from the proxy → clears the stale session before the sign-in round trip (no loop)', async () => {
    const auth = makeAuthStub();
    const supabase = makeSupabaseStub('stale-token');
    stubEnvironment({
      auth,
      supabase,
      fetchImpl: () => Promise.reject(Object.assign(new Error('unauthorized'), { statusCode: 401 })),
    });
    mountPage();
    await flushPromises();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(navigateToMock).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/discord/connect')}`);
  });

  it('transient failure → error card whose retry re-calls the proxy', async () => {
    const auth = makeAuthStub();
    stubEnvironment({
      auth,
      fetchImpl: () => Promise.reject(Object.assign(new Error('boom'), { statusCode: 502 })),
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('error.title');
    expect(trackMock).toHaveBeenCalledWith('discord_claim_reissue_failed', { source: 'web', reason: 'exception' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('unexpected response shape → error card', async () => {
    const auth = makeAuthStub();
    stubEnvironment({ auth, fetchImpl: () => Promise.resolve({ status: 'pending' }) });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('error.title');
  });
});
