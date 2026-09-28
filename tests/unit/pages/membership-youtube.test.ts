// @vitest-environment happy-dom
/**
 * /membership/youtube (app/pages/membership/youtube.vue) — the YouTube member
 * bridge (classicminidiy-supabase docs/plans/2026-09-28-youtube-member-bridge.md).
 *
 * Covers:
 *  - signed out → sign-in card that returns here
 *  - no Discord identity → Link Discord calls linkIdentity('discord') with a
 *    redirect back to /membership/youtube?linked=1
 *  - Discord already linked → "Check my YouTube membership" instead
 *  - ?linked=1&code= → PKCE exchange, URL cleaned, sync runs at once
 *  - every sync status and error status renders its own outcome
 *  - linkIdentity errors: identity already linked elsewhere / linking disabled
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import YoutubePage from '~/app/pages/membership/youtube.vue';

const baseUser = { id: 'user-1', email: 'member@example.com', identities: [] as { provider: string }[] };

function makeAuthStub({ user = baseUser as typeof baseUser | null } = {}) {
  const userRef = ref(user);
  return {
    user: userRef,
    isAuthenticated: computed(() => !!userRef.value),
    waitForAuth: vi.fn().mockResolvedValue(true),
    fetchUserProfile: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSupabaseStub({
  providers = [] as string[],
  accessToken = 'tok-123' as string | null,
  linkError = null as null | { code?: string; message: string },
} = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: accessToken ? { access_token: accessToken } : null } }),
      getUserIdentities: vi
        .fn()
        .mockResolvedValue({ data: { identities: providers.map((provider) => ({ provider })) }, error: null }),
      linkIdentity: vi.fn().mockResolvedValue({ data: { url: null }, error: linkError }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

const mountStubs = {
  NuxtLink: { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] },
  ClientOnly: { name: 'ClientOnly', template: '<div><slot /></div>' },
};

let fetchMock: ReturnType<typeof vi.fn>;
let routerReplace: ReturnType<typeof vi.fn>;

function stubEnvironment({
  auth = makeAuthStub(),
  supabase = makeSupabaseStub(),
  query = {} as Record<string, string>,
  fetchImpl,
}: {
  auth?: ReturnType<typeof makeAuthStub>;
  supabase?: ReturnType<typeof makeSupabaseStub>;
  query?: Record<string, string>;
  fetchImpl?: (...args: unknown[]) => Promise<unknown>;
} = {}) {
  fetchMock = vi.fn(fetchImpl ?? (() => Promise.resolve({ status: 'no_level_role' })));
  routerReplace = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('useAuth', () => auth);
  vi.stubGlobal('useSupabase', () => supabase);
  vi.stubGlobal('useAnalytics', () => ({ track: vi.fn() }));
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRoute', () => ({ path: '/membership/youtube', query, params: {}, meta: {}, matched: [] }));
  vi.stubGlobal('useRouter', () => ({ replace: routerReplace, push: vi.fn() }));
  return { auth, supabase };
}

async function mountPage() {
  const wrapper = mount(YoutubePage, { global: { stubs: mountStubs } });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.location.hash = '';
});

describe('signed out', () => {
  it('shows a sign-in card that comes back to this page, and never syncs', async () => {
    stubEnvironment({ auth: makeAuthStub({ user: null }) });
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="yt-signin"]').exists()).toBe(true);
    expect(wrapper.find('a[href*="/login"]').attributes('href')).toBe(
      `/login?redirect=${encodeURIComponent('/membership/youtube')}`
    );
    expect(wrapper.find('[data-testid="yt-steps"]').exists()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('no Discord identity yet', () => {
  it('shows the three steps and a Link Discord button, not the check button', async () => {
    stubEnvironment();
    const wrapper = await mountPage();
    expect(wrapper.findAll('[data-testid="yt-steps"] li')).toHaveLength(3);
    expect(wrapper.text()).toContain('steps.youtube');
    expect(wrapper.text()).toContain('steps.server');
    expect(wrapper.text()).toContain('steps.link');
    expect(wrapper.find('[data-testid="yt-link-discord"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="yt-check"]').exists()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Link Discord calls linkIdentity for discord with a redirect back here', async () => {
    const { supabase } = stubEnvironment();
    const wrapper = await mountPage();
    await wrapper.find('[data-testid="yt-link-discord"]').trigger('click');
    await flushPromises();
    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/membership/youtube?linked=1` },
    });
  });

  it.each([
    ['identity_already_exists', 'Identity is already linked to another user', 'conflict'],
    ['manual_linking_disabled', 'Manual linking is disabled', 'unavailable'],
    ['validation_failed', 'Unsupported provider: provider is not enabled', 'unavailable'],
    ['unexpected_failure', 'boom', 'link_failed'],
  ])('a linkIdentity error %s renders the %s outcome', async (code, message, expected) => {
    stubEnvironment({ supabase: makeSupabaseStub({ linkError: { code, message } }) });
    const wrapper = await mountPage();
    await wrapper.find('[data-testid="yt-link-discord"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe(expected);
    expect(wrapper.text()).toContain(`result.${expected}.title`);
    // The button is back so the user can try again.
    expect(wrapper.find('[data-testid="yt-link-discord"]').exists()).toBe(true);
  });
});

describe('Discord already linked', () => {
  it('skips straight to "Check my YouTube membership" and does not sync until pressed', async () => {
    stubEnvironment({ supabase: makeSupabaseStub({ providers: ['google', 'discord'] }) });
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="yt-link-discord"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="yt-check"]').text()).toContain('cta.check');
    expect(wrapper.find('[data-testid="yt-discord-linked"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('steps.check');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pressing the check button POSTs the sync with the Bearer token', async () => {
    stubEnvironment({
      supabase: makeSupabaseStub({ providers: ['discord'] }),
      fetchImpl: () => Promise.resolve({ status: 'linked', plan: 'plus' }),
    });
    const wrapper = await mountPage();
    await wrapper.find('[data-testid="yt-check"]').trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith('/api/membership/youtube-sync', {
      method: 'POST',
      headers: { authorization: 'Bearer tok-123' },
    });
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('linked');
  });

  it('falls back to user.identities when getUserIdentities fails', async () => {
    const supabase = makeSupabaseStub();
    supabase.auth.getUserIdentities.mockResolvedValue({ data: null, error: { message: 'nope' } } as any);
    const auth = makeAuthStub({ user: { ...baseUser, identities: [{ provider: 'discord' }] } });
    stubEnvironment({ auth, supabase });
    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="yt-check"]').exists()).toBe(true);
  });
});

describe('return from Discord (?linked=1)', () => {
  it('exchanges the code, cleans the URL and syncs at once', async () => {
    const { supabase } = stubEnvironment({
      supabase: makeSupabaseStub({ providers: ['discord'] }),
      query: { linked: '1', code: 'abc' },
      fetchImpl: () => Promise.resolve({ status: 'linked', plan: 'pro' }),
    });
    const wrapper = await mountPage();
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(routerReplace).toHaveBeenCalledWith({ path: '/membership/youtube', query: {}, hash: '' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('linked');
  });

  it('still syncs when the code exchange fails: the link is made before the redirect', async () => {
    const supabase = makeSupabaseStub({ providers: ['discord'] });
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: 'x' } } as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubEnvironment({ supabase, query: { linked: '1', code: 'abc' } });
    await mountPage();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a GoTrue error redirect (identity already linked) shows the conflict outcome and does not sync', async () => {
    stubEnvironment({
      query: {
        linked: '1',
        error: 'server_error',
        error_code: 'identity_already_exists',
        error_description: 'Identity is already linked to another user',
      },
    });
    const wrapper = await mountPage();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('conflict');
    expect(routerReplace).toHaveBeenCalled();
  });

  it('reads the error from the URL hash too', async () => {
    window.location.hash = '#error=access_denied&error_description=The+resource+owner+denied+the+request';
    stubEnvironment({ query: { linked: '1' } });
    const wrapper = await mountPage();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('link_failed');
  });
});

describe('sync outcomes', () => {
  async function mountWithSync(fetchImpl: () => Promise<unknown>) {
    stubEnvironment({ supabase: makeSupabaseStub({ providers: ['discord'] }), query: { linked: '1' }, fetchImpl });
    return mountPage();
  }

  it('linked → success with the level name and a link to the benefits', async () => {
    const wrapper = await mountWithSync(() => Promise.resolve({ status: 'linked', plan: 'plus' }));
    const outcome = wrapper.find('[data-testid="yt-outcome"]');
    expect(outcome.classes()).toContain('alert-success');
    expect(outcome.text()).toContain('result.linked.title');
    expect(outcome.text()).toContain('result.linked.body');
    expect(wrapper.find('[data-testid="yt-benefits-link"]').attributes('href')).toBe('/membership');
  });

  it('linked with no plan → the success copy without a level', async () => {
    const wrapper = await mountWithSync(() => Promise.resolve({ status: 'linked', plan: null }));
    expect(wrapper.find('[data-testid="yt-outcome"]').text()).toContain('result.linked.body_no_level');
  });

  it('linked → refreshes the profile so the badge appears', async () => {
    const auth = makeAuthStub();
    stubEnvironment({
      auth,
      supabase: makeSupabaseStub({ providers: ['discord'] }),
      query: { linked: '1' },
      fetchImpl: () => Promise.resolve({ status: 'linked', plan: 'base' }),
    });
    await mountPage();
    expect(auth.fetchUserProfile).toHaveBeenCalledWith('user-1');
  });

  it('no_identity → says so and brings back the Link Discord button', async () => {
    const wrapper = await mountWithSync(() => Promise.resolve({ status: 'no_identity' }));
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('no_identity');
    expect(wrapper.text()).toContain('result.no_identity.body');
    expect(wrapper.find('[data-testid="yt-link-discord"]').exists()).toBe(true);
  });

  it('not_in_server → join the server, then check again', async () => {
    const wrapper = await mountWithSync(() => Promise.resolve({ status: 'not_in_server' }));
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('not_in_server');
    expect(wrapper.text()).toContain('result.not_in_server.body');
    expect(wrapper.find('[data-testid="yt-check"]').text()).toContain('cta.check_again');
  });

  it('no_level_role → connect YouTube in Discord, wait, then check again', async () => {
    const wrapper = await mountWithSync(() => Promise.resolve({ status: 'no_level_role' }));
    const outcome = wrapper.find('[data-testid="yt-outcome"]');
    expect(outcome.attributes('data-outcome')).toBe('no_level_role');
    expect(outcome.classes()).toContain('alert-warning');
    expect(outcome.text()).toContain('result.no_level_role.body');
  });

  it.each([
    [409, 'conflict'],
    [429, 'too_many_requests'],
    [503, 'unavailable'],
    [500, 'error'],
    [502, 'error'],
  ])('HTTP %i → the %s outcome', async (status, expected) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = await mountWithSync(() => Promise.reject(Object.assign(new Error('x'), { statusCode: status })));
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe(expected);
    expect(wrapper.text()).toContain(`result.${expected}.title`);
  });

  it('409 uses the same copy as a linkIdentity identity_already_exists', async () => {
    const wrapper = await mountWithSync(() => Promise.reject(Object.assign(new Error('x'), { statusCode: 409 })));
    expect(wrapper.text()).toContain('result.conflict.body');
    expect(wrapper.find('a[href="/contact"]').exists()).toBe(true);
  });

  it('429 → "you just checked", and the check button stays usable for a retry after the wait', async () => {
    let calls = 0;
    stubEnvironment({
      supabase: makeSupabaseStub({ providers: ['discord'] }),
      query: { linked: '1' },
      fetchImpl: () =>
        ++calls === 1
          ? Promise.reject(Object.assign(new Error('x'), { statusCode: 429, data: { error: 'too_many_requests' } }))
          : Promise.resolve({ status: 'linked', plan: 'pro' }),
    });
    const wrapper = await mountPage();
    const outcome = wrapper.find('[data-testid="yt-outcome"]');
    expect(outcome.attributes('data-outcome')).toBe('too_many_requests');
    expect(outcome.classes()).toContain('alert-info');
    expect(outcome.text()).toContain('result.too_many_requests.title');
    expect(outcome.text()).toContain('result.too_many_requests.body');

    const button = wrapper.find('[data-testid="yt-check"]');
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="yt-outcome"]').attributes('data-outcome')).toBe('linked');
  });

  it('401 → clears the stale session and shows the sign-in card', async () => {
    const supabase = makeSupabaseStub({ providers: ['discord'] });
    stubEnvironment({
      supabase,
      query: { linked: '1' },
      fetchImpl: () => Promise.reject(Object.assign(new Error('x'), { statusCode: 401 })),
    });
    const wrapper = await mountPage();
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="yt-signin"]').exists()).toBe(true);
  });
});
