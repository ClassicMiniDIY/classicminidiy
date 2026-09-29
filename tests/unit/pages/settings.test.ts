// @vitest-environment happy-dom
/**
 * /settings (app/pages/settings.vue and its children): open to everyone, with
 * Preferences public and every other section behind the sign-in gate.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import SettingsPage from '~/app/pages/settings.vue';
import MembershipSection from '~/app/pages/settings/membership.vue';
import AccountShell from '~/app/components/account/Shell.vue';
import AccountSignInGate from '~/app/components/account/SignInGate.vue';

interface Env {
  signedIn: boolean;
  path?: string;
  settingsAuth?: boolean;
  exchangeEnabled?: boolean;
}

function stubEnv({ signedIn, path = '/settings/preferences', settingsAuth = false, exchangeEnabled = true }: Env) {
  vi.stubGlobal('useMountedAuth', () => ({
    authReady: ref(true),
    isSignedIn: ref(signedIn),
    isSustainingMemberUser: ref(false),
    mountedProfile: ref(null),
  }));
  vi.stubGlobal('useRoute', () => ({
    path,
    fullPath: path,
    params: {},
    query: {},
    meta: settingsAuth ? { settingsAuth: true } : {},
    matched: [],
  }));
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { exchangeEnabled } }));
}

function mountSettings(env: Env) {
  stubEnv(env);
  return mount(SettingsPage, {
    global: {
      components: { AccountShell, AccountSignInGate },
      stubs: {
        hero: true,
        breadcrumb: true,
        PageIntro: true,
        NuxtPage: { template: '<div data-testid="child-page" />' },
      },
    },
  });
}

const sidebarLinks = (wrapper: ReturnType<typeof mountSettings>) =>
  wrapper.findAll('[data-testid="account-shell-nav"] a').map((a) => a.attributes('href'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/settings sidebar', () => {
  it('signed out: only Preferences, plus the sign-in hint', () => {
    const wrapper = mountSettings({ signedIn: false });
    expect(sidebarLinks(wrapper)).toEqual(['/settings/preferences']);
    expect(wrapper.find('[data-testid="settings-signed-out-hint"]').exists()).toBe(true);
  });

  it('signed in: every account section, no sign-in hint', () => {
    const wrapper = mountSettings({ signedIn: true });
    expect(sidebarLinks(wrapper)).toEqual([
      '/settings/preferences',
      '/settings/membership',
      '/settings/notifications',
      '/settings/api-keys',
      '/settings/security',
    ]);
    expect(wrapper.find('[data-testid="settings-signed-out-hint"]').exists()).toBe(false);
  });

  it('hides Notifications while the marketplace flag is off', () => {
    const wrapper = mountSettings({ signedIn: true, exchangeEnabled: false });
    expect(sidebarLinks(wrapper)).not.toContain('/settings/notifications');
  });
});

describe('/settings content gate', () => {
  it('renders a public section signed out', () => {
    const wrapper = mountSettings({ signedIn: false });
    expect(wrapper.find('[data-testid="child-page"]').exists()).toBe(true);
  });

  it('replaces a settingsAuth section with the sign-in card when signed out', () => {
    const wrapper = mountSettings({ signedIn: false, path: '/settings/api-keys', settingsAuth: true });
    expect(wrapper.find('[data-testid="child-page"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="account-sign-in-gate"]').exists()).toBe(true);
  });

  it('renders a settingsAuth section when signed in', () => {
    const wrapper = mountSettings({ signedIn: true, path: '/settings/api-keys', settingsAuth: true });
    expect(wrapper.find('[data-testid="child-page"]').exists()).toBe(true);
  });
});

describe('/settings/membership', () => {
  function mountMembership({ member, profileLoaded }: { member: boolean; profileLoaded: boolean }) {
    vi.stubGlobal('useMountedAuth', () => ({
      isSustainingMemberUser: ref(member),
      mountedProfile: ref(profileLoaded ? { id: 'user-1' } : null),
    }));
    return mount(MembershipSection, {
      global: { stubs: { MembershipManageCard: { template: '<div data-testid="manage-card" />' } } },
    });
  }

  it('waits for the profile before choosing, so a member never sees the join card', async () => {
    const wrapper = mountMembership({ member: false, profileLoaded: false });
    await flushPromises();
    expect(wrapper.find('[data-testid="settings-membership-join"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="manage-card"]').exists()).toBe(false);
    expect(wrapper.find('.fa-spinner').exists()).toBe(true);
  });

  it('falls back to the join card when the profile never arrives', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountMembership({ member: false, profileLoaded: false });
      await vi.advanceTimersByTimeAsync(8000);
      expect(wrapper.find('.fa-spinner').exists()).toBe(false);
      expect(wrapper.find('[data-testid="settings-membership-join"]').exists()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the manage card to a member', () => {
    const wrapper = mountMembership({ member: true, profileLoaded: true });
    expect(wrapper.find('[data-testid="manage-card"]').exists()).toBe(true);
  });

  it('shows a non-member the join card linking to the public ways-to-join section', () => {
    const wrapper = mountMembership({ member: false, profileLoaded: true });
    const join = wrapper.find('[data-testid="settings-membership-join"]');
    expect(join.find('a').attributes('href')).toBe('/membership#ways-to-join');
  });
});
