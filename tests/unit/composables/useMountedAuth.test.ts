/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';

// Real refs, not plain objects — a computed over a non-reactive source never
// re-evaluates, which would make the reactivity assertions below vacuous.
const authState = {
  user: ref<any>(null),
  userProfile: ref<any>(null),
  isAuthenticated: ref(false),
  isAdmin: ref(false),
  isSustainingMember: ref(false),
  loading: ref(true),
};
vi.stubGlobal('useAuth', () => authState);

import { useMountedAuth } from '~/composables/useMountedAuth';

const harness = () =>
  defineComponent({
    setup() {
      const a = useMountedAuth();
      return () => h('div', JSON.stringify({ signedIn: a.isSignedIn.value, ready: a.authReady.value }));
    },
  });

beforeEach(() => {
  authState.user.value = null;
  authState.userProfile.value = null;
  authState.isAuthenticated.value = false;
  authState.isAdmin.value = false;
  authState.isSustainingMember.value = false;
  authState.loading.value = true;
});

describe('useMountedAuth', () => {
  // The whole point: during SSR and the client's FIRST render these must be
  // false even when the session says otherwise, so both sides agree and
  // hydration has nothing to repair.
  it('reports signed out before mount even when authenticated', () => {
    authState.isAuthenticated.value = true;
    const wrapper = mount(harness());
    // Value captured during the initial render, before onMounted flushed.
    expect(wrapper.text()).toContain('"signedIn":false');
  });

  it('flips to signed in after mount', async () => {
    authState.isAuthenticated.value = true;
    const wrapper = mount(harness());
    await nextTick();
    expect(wrapper.text()).toContain('"signedIn":true');
  });

  it('stays signed out after mount when there is no session', async () => {
    const wrapper = mount(harness());
    await nextTick();
    expect(wrapper.text()).toContain('"signedIn":false');
  });

  it('authReady also waits for loading to settle', async () => {
    authState.isAuthenticated.value = true;
    const wrapper = mount(harness());
    await nextTick();
    expect(wrapper.text()).toContain('"ready":false');
    authState.loading.value = false;
    await nextTick();
    expect(wrapper.text()).toContain('"ready":true');
  });
});
