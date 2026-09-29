// @vitest-environment happy-dom
/**
 * <AccountSignInGate> (app/components/account/SignInGate.vue): spinner while the
 * session resolves, sign-in card without one, otherwise the slot.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import AccountSignInGate from '~/app/components/account/SignInGate.vue';

function mountGate({
  authReady,
  isSignedIn,
  required,
}: {
  authReady: boolean;
  isSignedIn: boolean;
  required?: boolean;
}) {
  vi.stubGlobal('useMountedAuth', () => ({ authReady: ref(authReady), isSignedIn: ref(isSignedIn) }));
  vi.stubGlobal('useRoute', () => ({
    path: '/settings/api-keys',
    fullPath: '/settings/api-keys?x=1',
    params: {},
    query: {},
    meta: {},
    matched: [],
  }));
  return mount(AccountSignInGate, {
    props: { title: 'Sign in', description: 'Needs an account', buttonLabel: 'Continue', required },
    slots: { default: '<p data-testid="content">content</p>' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountSignInGate', () => {
  it('shows only the spinner while auth resolves', () => {
    const wrapper = mountGate({ authReady: false, isSignedIn: false });
    expect(wrapper.find('.fa-spinner').exists()).toBe(true);
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="account-sign-in-gate"]').exists()).toBe(false);
  });

  it('shows the sign-in card with a redirect back to this page when signed out', () => {
    const wrapper = mountGate({ authReady: true, isSignedIn: false });
    const card = wrapper.find('[data-testid="account-sign-in-gate"]');
    expect(card.exists()).toBe(true);
    expect(card.find('a').attributes('href')).toBe(`/login?redirect=${encodeURIComponent('/settings/api-keys?x=1')}`);
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);
  });

  it('renders the slot when signed in', () => {
    const wrapper = mountGate({ authReady: true, isSignedIn: true });
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
  });

  it('renders the slot for everyone when not required', () => {
    const wrapper = mountGate({ authReady: false, isSignedIn: false, required: false });
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
    expect(wrapper.find('.fa-spinner').exists()).toBe(false);
  });
});
