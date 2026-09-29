// @vitest-environment happy-dom
/**
 * <AccountShell> (app/components/account/Shell.vue): the routed sidebar shared
 * by /dashboard and /settings.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AccountShell from '~/app/components/account/Shell.vue';

const groups = [
  {
    label: '3D models',
    entries: [
      { to: '/dashboard/models', label: 'Models', icon: 'fas fa-cube' },
      { to: '/dashboard/selling', label: 'Selling', icon: 'fas fa-store' },
    ],
  },
  {
    label: 'Contributions',
    entries: [{ to: '/dashboard/submissions', label: 'Submissions', icon: 'fas fa-file-lines' }],
  },
];

function mountAt(path: string) {
  vi.stubGlobal('useRoute', () => ({ path, fullPath: path, params: {}, query: {}, meta: {}, matched: [] }));
  return mount(AccountShell, {
    props: { groups, navLabel: 'Dashboard sections' },
    slots: { default: '<p data-testid="content">content</p>', 'nav-footer': '<a data-testid="footer">Settings</a>' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountShell', () => {
  it('renders every group title and entry in the sidebar', () => {
    const nav = mountAt('/dashboard/models').find('[data-testid="account-shell-nav"]');
    expect(nav.text()).toContain('3D models');
    expect(nav.text()).toContain('Contributions');
    expect(nav.findAll('a')).toHaveLength(3);
  });

  it('marks the entry for the current route, including a nested path', () => {
    const wrapper = mountAt('/dashboard/selling/payouts');
    const active = wrapper.find('[data-testid="account-shell-nav"] a[aria-current="page"]');
    expect(active.attributes('href')).toBe('/dashboard/selling');
  });

  it('labels the small-screen dropdown with the current section', () => {
    const button = mountAt('/dashboard/submissions').find('[data-testid="account-shell-menu-button"]');
    expect(button.text()).toContain('Submissions');
  });

  it('falls back to the nav label when no entry matches', () => {
    const button = mountAt('/dashboard').find('[data-testid="account-shell-menu-button"]');
    expect(button.text()).toContain('Dashboard sections');
  });

  it('renders the content slot and the nav-footer slot', () => {
    const wrapper = mountAt('/dashboard/models');
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="footer"]').exists()).toBe(true);
  });

  it('keeps the nav-footer slot outside the lg-only nav, so it shows on a phone', () => {
    const wrapper = mountAt('/dashboard/models');
    const nav = wrapper.find('[data-testid="account-shell-nav"]');
    expect(nav.find('[data-testid="footer"]').exists()).toBe(false);
  });
});
