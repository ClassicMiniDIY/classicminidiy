// @vitest-environment happy-dom
/**
 * Member-management card (app/components/membership/ManageCard.vue), rendered
 * by /settings/membership for an active member. Moved out of
 * app/pages/membership/index.vue with its tests:
 *  - platform-aware manage branches: ghost / patreon / youtube / unknown-null fallback
 *  - the level and plan line wait for get_my_membership()
 *  - customer-facing copy in real English
 *
 * The i18n mock returns translation keys verbatim, so most assertions match keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed, nextTick } from 'vue';
import { readFileSync } from 'node:fs';
import ManageCard from '~/app/components/membership/ManageCard.vue';

/** The card's real English messages, read from its `<i18n>` block. */
const EN_MESSAGES = JSON.parse(
  readFileSync('app/components/membership/ManageCard.vue', 'utf8').match(/<i18n lang="json">\n([\s\S]*?)<\/i18n>/)![1]!
).en;
function realT(key: string, params: Record<string, unknown> = {}): string {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], EN_MESSAGES);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

const baseUser = { id: 'user-1', email: 'member@example.com' };

function makeAuthStub({ member = true }: { member?: boolean } = {}) {
  const userRef = ref<typeof baseUser | null>(baseUser);
  return {
    stub: {
      user: userRef,
      isAuthenticated: computed(() => !!userRef.value),
      isSustainingMember: computed(() => member),
    },
  };
}

function makeSupabaseStub({ platform = null as string | null, plan = null as string | null } = {}) {
  const rpcSingle = vi.fn().mockResolvedValue({ data: { platform, plan }, error: null });
  return {
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
};

function stubEnvironment({
  auth,
  supabase,
}: {
  auth: ReturnType<typeof makeAuthStub>;
  supabase?: ReturnType<typeof makeSupabaseStub>;
}) {
  vi.stubGlobal('useAuth', () => auth.stub);
  vi.stubGlobal('useSupabase', () => supabase ?? makeSupabaseStub());
}

function mountCard() {
  return mount(ManageCard, { global: { stubs: mountStubs } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  (global as any).__resetNuxtState?.();
});

// ---------------------------------------------------------------------------
// Platform-aware manage branches (get_my_membership().platform)
// ---------------------------------------------------------------------------
describe('manage area platform branches', () => {
  async function mountAsMemberWithPlatform(platform: string | null) {
    const auth = makeAuthStub({ member: true });
    stubEnvironment({ auth, supabase: makeSupabaseStub({ platform }) });
    const wrapper = mountCard();
    await flushPromises();
    await nextTick();
    return wrapper;
  }

  it('ghost members are pointed at their blog account', async () => {
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

  it('youtube members get a manage link to YouTube paid memberships', async () => {
    const wrapper = await mountAsMemberWithPlatform('youtube');
    expect(wrapper.html()).toContain('member.manage_note_youtube');
    const link = wrapper.find('a[href="https://www.youtube.com/paid_memberships"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    expect(wrapper.html()).not.toContain('member.active_fallback');
    expect(wrapper.html()).not.toContain('member.manage_note_stripe');
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
// Customer-facing copy (membership clarity §4.2 / §12), in real English
// ---------------------------------------------------------------------------
describe('member view copy', () => {
  async function mountMember({ platform, plan }: { platform: string | null; plan: string | null }) {
    const auth = makeAuthStub({ member: true });
    stubEnvironment({ auth, supabase: makeSupabaseStub({ platform, plan }) });
    vi.stubGlobal('useI18n', () => ({ t: realT, locale: ref('en') }));
    const wrapper = mountCard();
    await flushPromises();
    await nextTick();
    return wrapper;
  }

  it.each([
    ['base', 'Member'],
    ['plus', 'Plus'],
    ['pro', 'Pro'],
    [null, 'Member'],
  ])('plan %s shows the level "%s" beside Sustaining Member', async (plan, level) => {
    const wrapper = await mountMember({ platform: 'stripe', plan });
    expect(wrapper.find('[data-testid="member-title"]').text()).toBe(`You're a Sustaining Member · ${level}`);
  });

  it('shows no level until get_my_membership() answers', async () => {
    const auth = makeAuthStub({ member: true });
    const supabase = makeSupabaseStub({ platform: 'stripe', plan: 'pro' });
    supabase._rpcSingle.mockReturnValue(new Promise(() => {}));
    stubEnvironment({ auth, supabase });
    vi.stubGlobal('useI18n', () => ({ t: realT, locale: ref('en') }));
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.find('[data-testid="member-title"]').text()).toBe("You're a Sustaining Member");
  });

  it.each(['stripe', 'apple', 'google', 'ghost', 'patreon', 'youtube', 'comp', null])(
    'platform %s: no "tip jar", no "Ghost", no "Stripe", and the new blog wording',
    async (platform) => {
      const wrapper = await mountMember({ platform, plan: 'plus' });
      const text = wrapper.text();
      expect(text).not.toMatch(/tip jar/i);
      expect(text).not.toContain('Ghost');
      expect(text).not.toContain('Stripe');
      expect(text).not.toContain('Pro access to the blog');
      expect(text).toContain('Members-only blog posts');
    }
  );

  it('ghost members are told to use their blog account', async () => {
    const wrapper = await mountMember({ platform: 'ghost', plan: null });
    expect(wrapper.text()).toContain('Manage billing and cancellation from your Classic Mini DIY blog account.');
  });
});

// ---------------------------------------------------------------------------
// The plan line waits for get_my_membership()
// ---------------------------------------------------------------------------
describe('member plan line', () => {
  function mountWithRealCopy(supabase: ReturnType<typeof makeSupabaseStub>) {
    stubEnvironment({ auth: makeAuthStub({ member: true }), supabase });
    vi.stubGlobal('useI18n', () => ({ t: realT, locale: ref('en') }));
    return mountCard();
  }

  it('is hidden until get_my_membership() answers', async () => {
    const supabase = makeSupabaseStub({ platform: 'stripe', plan: 'pro' });
    supabase._rpcSingle.mockReturnValue(new Promise(() => {}));
    const wrapper = mountWithRealCopy(supabase);
    await flushPromises();
    expect(wrapper.find('[data-testid="member-plan-line"]').exists()).toBe(false);
  });

  it('shows the real plan once loaded', async () => {
    const wrapper = mountWithRealCopy(makeSupabaseStub({ platform: 'stripe', plan: 'pro' }));
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-testid="member-plan-line"]').text()).toContain('Your plan: Pro');
  });

  it('on an RPC error shows neither the level nor the plan line', async () => {
    const supabase = makeSupabaseStub({ platform: 'stripe', plan: 'pro' });
    supabase._rpcSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const wrapper = mountWithRealCopy(supabase);
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-testid="member-plan-line"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="member-title"]').text()).toBe("You're a Sustaining Member");
  });
});
