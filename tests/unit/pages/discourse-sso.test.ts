// @vitest-environment happy-dom
/**
 * DiscourseConnect hand-off page (app/pages/discourse/sso.vue).
 * Design: docs/plans/2026-10-03-discourse-sso.md, tests 14-19c.
 *
 * The i18n mock returns translation keys verbatim, so assertions match keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';
import SsoPage from '~/app/pages/discourse/sso.vue';

const FORUM = 'https://community.example.com';
const SSO = 'bm9uY2U9YWJjJnJldHVybl9zc29fdXJs+/=';
const SIG = 'a'.repeat(64);
const FULL_PATH = `/discourse/sso?sso=${encodeURIComponent(SSO)}&sig=${SIG}`;
const LOGIN_HREF = `/login?redirect=${encodeURIComponent(FULL_PATH)}`;
const REDIRECT = `${FORUM}/session/sso_login?sso=b64&sig=${'b'.repeat(64)}`;

type Profile = { username: string | null; display_name: string | null };
const baseUser = { id: 'user-1', email: 'jane.driver@example.com' };

function makeAuthStub({ user = baseUser }: { user?: typeof baseUser | null } = {}) {
  const userRef = ref<typeof baseUser | null>(user);
  return {
    user: userRef,
    isAuthenticated: computed(() => !!userRef.value),
    waitForAuth: vi.fn().mockResolvedValue(true),
  };
}

function makeSupabaseStub({
  accessToken = 'access-token',
  profile = { username: 'mini-jane', display_name: 'Jane Driver' } as Profile | null,
  available = true,
  updateError = null as { code: string; message: string } | null,
} = {}) {
  const profileRead = vi.fn().mockResolvedValue({ data: profile, error: null });
  const updateResult = vi.fn(async () =>
    updateError ? { data: null, error: updateError } : { data: { ...lastUpdate }, error: null }
  );
  let lastUpdate: Record<string, unknown> = {};
  const update = vi.fn((values: Record<string, unknown>) => {
    lastUpdate = values;
    return { eq: () => ({ select: () => ({ maybeSingle: updateResult }) }) };
  });
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: accessToken ? { access_token: accessToken } : null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: profileRead }) }),
      update,
    })),
    rpc: vi.fn().mockResolvedValue({ data: available, error: null }),
    update,
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
  auth = makeAuthStub(),
  supabase = makeSupabaseStub(),
  fetchImpl,
  query = { sso: SSO, sig: SIG } as Record<string, string>,
}: {
  auth?: ReturnType<typeof makeAuthStub>;
  supabase?: ReturnType<typeof makeSupabaseStub>;
  fetchImpl?: (...args: unknown[]) => Promise<unknown>;
  query?: Record<string, string>;
} = {}) {
  navigateToMock = vi.fn();
  trackMock = vi.fn();
  fetchMock = vi.fn(fetchImpl ?? (() => Promise.resolve({ redirect: REDIRECT })));
  const search = new URLSearchParams(query).toString();
  const fullPath = Object.keys(query).length ? FULL_PATH : '/discourse/sso';

  vi.stubGlobal('useAuth', () => auth);
  vi.stubGlobal('useSupabase', () => supabase);
  vi.stubGlobal('useAnalytics', () => ({ track: trackMock }));
  vi.stubGlobal('navigateTo', navigateToMock);
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRoute', () => ({ path: '/discourse/sso', query, fullPath, search }));
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { discourseUrl: FORUM } }));
  return { auth, supabase };
}

function mountPage() {
  return mount(SsoPage, { global: { stubs: mountStubs } });
}

const apiError = (statusCode: number, error?: string) =>
  Object.assign(new Error(`HTTP ${statusCode}`), {
    statusCode,
    data: { statusCode, data: error ? { error } : undefined },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  (global as any).__resetNuxtState?.();
});

describe('signed out (14)', () => {
  it('navigates to /login with the full encoded path and query, and never POSTs', async () => {
    stubEnvironment({ auth: makeAuthStub({ user: null }) });
    const wrapper = mountPage();
    await flushPromises();

    expect(navigateToMock).toHaveBeenCalledWith(LOGIN_HREF);
    expect(wrapper.text()).toContain('signin.title');
    const loginLink = wrapper.find('a[href^="/login"]');
    expect(loginLink.attributes('href')).toBe(LOGIN_HREF);
    // The href carries the sso query: autocapture must skip it.
    expect(loginLink.classes()).toContain('ph-no-capture');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('signed in with a username (15)', () => {
  it('POSTs sso and sig with the bearer token, then navigates externally to the redirect', async () => {
    stubEnvironment({ supabase: makeSupabaseStub({ accessToken: 'tok-123' }) });
    mountPage();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/discourse/sso', {
      method: 'POST',
      headers: { authorization: 'Bearer tok-123' },
      body: { sso: SSO, sig: SIG },
    });
    expect(navigateToMock).toHaveBeenCalledWith(REDIRECT, { external: true });
    expect(trackMock).toHaveBeenCalledWith('forum_sso_started');
    expect(trackMock).toHaveBeenCalledWith('forum_sso_completed');
  });

  it('refuses a redirect to anywhere but the forum', async () => {
    stubEnvironment({ fetchImpl: () => Promise.resolve({ redirect: 'https://evil.example.net/x' }) });
    const wrapper = mountPage();
    await flushPromises();

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('error.title');
    expect(wrapper.find('[data-testid="forum-restart"]').attributes('href')).toBe(FORUM);
  });
});

describe('identity step', () => {
  it('no username → shows the identity step and does not POST (16)', async () => {
    stubEnvironment({ supabase: makeSupabaseStub({ profile: { username: null, display_name: 'Jane Driver' } }) });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('identity.title');
    expect(fetchMock).not.toHaveBeenCalled();
    // A real display name is a usable suggestion for both fields.
    expect((wrapper.find('[data-testid="forum-username"]').element as HTMLInputElement).value).toBe('jane-driver');
    expect((wrapper.find('[data-testid="forum-display-name"]').element as HTMLInputElement).value).toBe('Jane Driver');
  });

  it('a reserved username in the profile goes to the server; its 409 shows the identity step', async () => {
    stubEnvironment({
      supabase: makeSupabaseStub({ profile: { username: 'admin', display_name: 'Jane' } }),
      fetchImpl: () => Promise.reject(apiError(409, 'username_required')),
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('identity.title');
  });

  it('the owner of a reserved username signs straight in, with no identity step', async () => {
    stubEnvironment({ supabase: makeSupabaseStub({ profile: { username: 'classicminidiy', display_name: 'Cole' } }) });
    const wrapper = mountPage();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain('identity.title');
    expect(navigateToMock).toHaveBeenCalledWith(REDIRECT, { external: true });
  });

  it('a display name equal to the email local part is not prefilled in either field (19c)', async () => {
    stubEnvironment({ supabase: makeSupabaseStub({ profile: { username: null, display_name: 'Jane.Driver' } }) });
    const wrapper = mountPage();
    await flushPromises();

    expect((wrapper.find('[data-testid="forum-username"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.find('[data-testid="forum-display-name"]').element as HTMLInputElement).value).toBe('');
  });

  it('saves the checked name to the own profile, then POSTs once', async () => {
    const supabase = makeSupabaseStub({ profile: { username: null, display_name: null } });
    stubEnvironment({ supabase });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="forum-username"]').setValue('Cooper-S');
    await wrapper.find('[data-testid="forum-display-name"]').setValue(' Jane ');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(supabase.rpc).toHaveBeenCalledWith('is_username_available', { p_username: 'cooper-s' });
    expect(supabase.update).toHaveBeenCalledWith({ username: 'cooper-s', display_name: 'Jane' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(navigateToMock).toHaveBeenCalledWith(REDIRECT, { external: true });
  });

  it.each([
    ['an invalid name', 'ab', 'identity.errors.invalid'],
    ['a reserved name', 'classicminidiy', 'identity.errors.reserved'],
    ['two hyphens in a row', 'mini--jane', 'identity.errors.invalid'],
  ])('%s is refused before any call', async (_label, name, message) => {
    const supabase = makeSupabaseStub({ profile: { username: null, display_name: null } });
    stubEnvironment({ supabase });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="forum-username"]').setValue(name);
    await wrapper.find('[data-testid="forum-display-name"]').setValue('Jane');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain(message);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an unavailable name shows "taken" and saves nothing', async () => {
    const supabase = makeSupabaseStub({ profile: { username: null, display_name: null }, available: false });
    stubEnvironment({ supabase });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="forum-username"]').setValue('mini-jane');
    await wrapper.find('[data-testid="forum-display-name"]').setValue('Jane');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('identity.errors.taken');
    expect(supabase.update).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['23505', 'identity.errors.taken'],
    ['23514', 'identity.errors.reserved'],
  ])('a %s error on save shows %s', async (code, message) => {
    const supabase = makeSupabaseStub({
      profile: { username: null, display_name: null },
      updateError: { code, message: 'refused' },
    });
    stubEnvironment({ supabase });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="forum-username"]').setValue('mini-jane');
    await wrapper.find('[data-testid="forum-display-name"]').setValue('Jane');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('409 username_required from the server → the identity step (19b)', async () => {
    stubEnvironment({ fetchImpl: () => Promise.reject(apiError(409, 'username_required')) });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('identity.title');
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});

describe('server refusals', () => {
  it('401 → local sign-out, then the login redirect (17)', async () => {
    const supabase = makeSupabaseStub({ accessToken: 'stale-token' });
    stubEnvironment({ supabase, fetchImpl: () => Promise.reject(apiError(401)) });
    mountPage();
    await flushPromises();

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(navigateToMock).toHaveBeenCalledWith(LOGIN_HREF);
    const signOutOrder = supabase.auth.signOut.mock.invocationCallOrder[0]!;
    const navigateOrder = navigateToMock.mock.invocationCallOrder[0]!;
    expect(signOutOrder).toBeLessThan(navigateOrder);
  });

  it('403 reauth_required → local sign-out, then the login redirect', async () => {
    const supabase = makeSupabaseStub();
    stubEnvironment({ supabase, fetchImpl: () => Promise.reject(apiError(403, 'reauth_required')) });
    const wrapper = mountPage();
    await flushPromises();

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(navigateToMock).toHaveBeenCalledWith(LOGIN_HREF);
    expect(wrapper.text()).not.toContain('suspended.title');
    expect(trackMock).toHaveBeenCalledWith('forum_sso_failed', { reason: 'reauth_required' });
  });

  it('403 email_unverified → the unverified state with the forum link (18)', async () => {
    stubEnvironment({ fetchImpl: () => Promise.reject(apiError(403, 'email_unverified')) });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('unverified.title');
    expect(wrapper.find('[data-testid="forum-restart"]').attributes('href')).toBe(FORUM);
    expect(trackMock).toHaveBeenCalledWith('forum_sso_failed', { reason: 'email_unverified' });
  });

  it('403 without a code (suspended account) → the suspended state', async () => {
    stubEnvironment({ fetchImpl: () => Promise.reject(apiError(403)) });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('suspended.title');
    expect(trackMock).toHaveBeenCalledWith('forum_sso_failed', { reason: 'suspended' });
  });

  it('any other failure → "Start again from the forum", with no retry button', async () => {
    stubEnvironment({ fetchImpl: () => Promise.reject(apiError(400, 'bad_signature')) });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('error.body');
    expect(wrapper.find('[data-testid="forum-restart"]').attributes('href')).toBe(FORUM);
    expect(wrapper.find('button').exists()).toBe(false);
    expect(trackMock).toHaveBeenCalledWith('forum_sso_failed', { reason: 'bad_signature' });
  });
});

describe('missing parameters (19)', () => {
  it.each([
    ['no sso', { sig: SIG }],
    ['no sig', { sso: SSO }],
    ['neither', {}],
  ])('%s → the error state, no auth wait and no POST', async (_label, query) => {
    const { auth } = stubEnvironment({ query });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('error.missing');
    expect(wrapper.find('[data-testid="forum-restart"]').attributes('href')).toBe(FORUM);
    expect(auth.waitForAuth).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('forum_sso_failed', { reason: 'missing_params' });
  });
});

describe('one POST per nonce (19a)', () => {
  it('a re-mount after a sent POST does not POST again', async () => {
    stubEnvironment();
    mountPage().unmount();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = mountPage();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.text()).toContain('connecting.title');
  });

  it('a re-mount while the first POST is pending shows the start-again link when that POST fails', async () => {
    let rejectFirst: (err: unknown) => void = () => {};
    stubEnvironment({ fetchImpl: () => new Promise((_resolve, reject) => (rejectFirst = reject)) });
    const first = mountPage();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = mountPage();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.text()).toContain('connecting.title');

    rejectFirst(apiError(400, 'bad_signature'));
    await flushPromises();
    expect(first.text()).toContain('error.body');
    expect(second.text()).toContain('error.body');
    expect(second.find('[data-testid="forum-restart"]').attributes('href')).toBe(FORUM);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a re-mount while the first POST is pending stays on connecting when that POST succeeds', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    stubEnvironment({ fetchImpl: () => new Promise((resolve) => (resolveFirst = resolve)) });
    mountPage();
    await flushPromises();
    const second = mountPage();
    await flushPromises();

    resolveFirst({ redirect: REDIRECT });
    await flushPromises();
    expect(second.text()).toContain('connecting.title');
    expect(navigateToMock).toHaveBeenCalledTimes(1);
  });

  it('a double click on the identity step sends one save and one POST', async () => {
    let resolveUpdate: (v: unknown) => void = () => {};
    const supabase = makeSupabaseStub({ profile: { username: null, display_name: null } });
    supabase.update.mockImplementation(() => ({
      eq: () => ({
        select: () => ({
          maybeSingle: () => new Promise((resolve) => (resolveUpdate = resolve)),
        }),
      }),
    }));
    stubEnvironment({ supabase });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="forum-username"]').setValue('mini-jane');
    await wrapper.find('[data-testid="forum-display-name"]').setValue('Jane');
    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    resolveUpdate({ data: { username: 'mini-jane', display_name: 'Jane' }, error: null });
    await flushPromises();

    expect(supabase.update).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a failed POST does not block the next attempt after sign-in', async () => {
    let calls = 0;
    stubEnvironment({
      fetchImpl: () => (++calls === 1 ? Promise.reject(apiError(401)) : Promise.resolve({ redirect: REDIRECT })),
    });
    mountPage().unmount();
    await flushPromises();

    mountPage();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(navigateToMock).toHaveBeenCalledWith(REDIRECT, { external: true });
  });
});
