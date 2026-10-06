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
    'platform %s: no "tip jar", no "Ghost", no "Stripe", and no blog benefit',
    async (platform) => {
      const wrapper = await mountMember({ platform, plan: 'plus' });
      const text = wrapper.text();
      expect(text).not.toMatch(/tip jar/i);
      expect(text).not.toContain('Ghost');
      expect(text).not.toContain('Stripe');
      expect(text).not.toContain('Pro access to the blog');
      // The members-only blog benefit was retired 2026-10-06 with the Ghost blog.
      expect(text).not.toContain('Members-only blog posts');
      expect(text).not.toContain('Open the blog');
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

// ---------------------------------------------------------------------------
// Change level (Stripe members): change-membership-plan via the web proxy
// ---------------------------------------------------------------------------
describe('change level', () => {
  const STATUS = { plan: 'base', interval: 'month', monthlyCents: 199, onCurrentPrice: true, blocked: null };

  function stripeSupabase(plan: string | null = 'base') {
    const supabase: any = makeSupabaseStub({ platform: 'stripe', plan });
    supabase.auth = { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) };
    return supabase;
  }

  /** `status` answers the status call; `change` answers (or throws for) a level change. */
  async function mountStripe(opts: { plan?: string | null; status?: any; change?: (body: any) => unknown } = {}) {
    const supabase = stripeSupabase(opts.plan ?? 'base');
    stubEnvironment({ auth: makeAuthStub({ member: true }), supabase });
    vi.stubGlobal('useI18n', () => ({ t: realT, locale: ref('en') }));
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      if (init.body.action === 'status') {
        if (opts.status instanceof Error) throw opts.status;
        return opts.status ?? STATUS;
      }
      return opts.change ? opts.change(init.body) : { changed: true, plan: init.body.plan };
    });
    vi.stubGlobal('$fetch', fetchMock);
    const wrapper = mountCard();
    await flushPromises();
    await nextTick();
    return { wrapper, fetchMock, supabase };
  }

  async function choose(wrapper: any, plan: string) {
    await wrapper.find(`[data-testid="change-level-${plan}"]`).trigger('click');
    await wrapper.find('[data-testid="change-level-confirm-button"]').trigger('click');
    await flushPromises();
  }

  const apiError = (status: number, data: Record<string, unknown>) =>
    Object.assign(new Error(String(status)), { statusCode: status, data: { data } });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the three levels to a Stripe member, with the current one disabled', async () => {
    const { wrapper, fetchMock } = await mountStripe();
    expect(fetchMock).toHaveBeenCalledWith('/api/membership/change-plan', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: { action: 'status' },
    });
    expect(wrapper.find('[data-testid="change-level-base"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="change-level-plus"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="change-level-pro"]').text()).toContain('Pro · $9.99/month');
    expect(wrapper.text()).not.toContain('switch plans there');
  });

  it("marks the Stripe sub's own level, not the highest level across channels", async () => {
    // comp Pro + Stripe Member: get_my_membership says pro, the Stripe sub is base.
    const { wrapper } = await mountStripe({ plan: 'pro', status: STATUS });
    expect(wrapper.find('[data-testid="change-level-base"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="change-level-pro"]').attributes('disabled')).toBeUndefined();
    await wrapper.find('[data-testid="change-level-plus"]').trigger('click');
    expect(wrapper.find('[data-testid="change-level-confirm"]').text()).toContain('charged the difference');
  });

  it('hides the picker when the status call fails (function not deployed yet)', async () => {
    const { wrapper } = await mountStripe({ status: new Error('404') });
    expect(wrapper.find('[data-testid="change-level"]').exists()).toBe(false);
  });

  it('a blocked status explains why instead of showing the picker', async () => {
    const { wrapper } = await mountStripe({ status: { ...STATUS, blocked: 'CANCEL_SCHEDULED' } });
    expect(wrapper.find('[data-testid="change-level-blocked"]').text()).toContain(
      'Resume it on the billing page first'
    );
    expect(wrapper.find('[data-testid="change-level-plus"]').exists()).toBe(false);
  });

  it.each(['apple', 'google', 'patreon', 'youtube', 'comp', null])(
    'platform %s sees no level picker',
    async (platform) => {
      stubEnvironment({ auth: makeAuthStub({ member: true }), supabase: makeSupabaseStub({ platform, plan: 'base' }) });
      const fetchMock = vi.fn();
      vi.stubGlobal('$fetch', fetchMock);
      const wrapper = mountCard();
      await flushPromises();
      await nextTick();
      expect(wrapper.find('[data-testid="change-level"]').exists()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('the confirm rule follows the price: up, down, legacy same level, yearly', async () => {
    const up = await mountStripe({ status: { ...STATUS, plan: 'plus', monthlyCents: 499 } });
    await up.wrapper.find('[data-testid="change-level-pro"]').trigger('click');
    const confirmUp = up.wrapper.find('[data-testid="change-level-confirm"]').text();
    expect(confirmUp).toContain('Move to Pro ($9.99 a month, 135 DIY Mini Bot questions a month)?');
    expect(confirmUp).toContain('charged the difference');
    await up.wrapper.find('[data-testid="change-level-base"]').trigger('click');
    expect(up.wrapper.find('[data-testid="change-level-confirm"]').text()).toContain('becomes a credit');

    // A legacy $8/mo Plus member: Plus stays clickable and moving to $4.99 is a move down.
    const legacy = await mountStripe({ status: { ...STATUS, plan: 'plus', monthlyCents: 800, onCurrentPrice: false } });
    const plus = legacy.wrapper.find('[data-testid="change-level-plus"]');
    expect(plus.attributes('disabled')).toBeUndefined();
    expect(plus.text()).toContain('Older price');
    await plus.trigger('click');
    expect(legacy.wrapper.find('[data-testid="change-level-confirm"]').text()).toContain('becomes a credit');

    const yearly = await mountStripe({
      status: { ...STATUS, plan: 'plus', interval: 'year', monthlyCents: 667, onCurrentPrice: false },
    });
    await yearly.wrapper.find('[data-testid="change-level-pro"]').trigger('click');
    expect(yearly.wrapper.find('[data-testid="change-level-confirm"]').text()).toContain(
      'from yearly to monthly payments'
    );
  });

  it('confirm posts the plan with the access token, shows done, and refreshes the headline', async () => {
    vi.useFakeTimers();
    const { wrapper, fetchMock, supabase } = await mountStripe();
    supabase._rpcSingle.mockResolvedValue({ data: { platform: 'stripe', plan: 'plus' }, error: null });
    await choose(wrapper, 'plus');
    expect(fetchMock).toHaveBeenCalledWith('/api/membership/change-plan', {
      method: 'POST',
      headers: { authorization: 'Bearer tok' },
      body: { plan: 'plus' },
    });
    expect(wrapper.find('[data-testid="change-level-done"]').text()).toContain('Your level is now Plus.');
    // The status is read again after the change.
    expect(fetchMock.mock.calls.filter((c: any) => c[1].body.action === 'status').length).toBe(2);
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();
    expect(wrapper.find('[data-testid="member-title"]').text()).toBe("You're a Sustaining Member · Plus");
  });

  it('a failed status reload after a change keeps the done message', async () => {
    let statusCalls = 0;
    const supabase = stripeSupabase('base');
    stubEnvironment({ auth: makeAuthStub({ member: true }), supabase });
    vi.stubGlobal('useI18n', () => ({ t: realT, locale: ref('en') }));
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (_url: string, init: any) => {
        if (init.body.action === 'status') {
          statusCalls += 1;
          if (statusCalls > 1) throw new Error('blip');
          return STATUS;
        }
        return { changed: true, plan: 'plus' };
      })
    );
    const wrapper = mountCard();
    await flushPromises();
    await nextTick();
    await choose(wrapper, 'plus');
    expect(wrapper.find('[data-testid="change-level-done"]').exists()).toBe(true);
  });

  it('changed:false says the member is already on that level', async () => {
    const { wrapper } = await mountStripe({ change: () => ({ changed: false, plan: 'plus' }) });
    await choose(wrapper, 'plus');
    expect(wrapper.find('[data-testid="change-level-already"]').text()).toContain('You are already on Plus.');
  });

  it('PAYMENT_REQUIRED shows the invoice page link', async () => {
    const { wrapper } = await mountStripe({
      change: () => {
        throw apiError(402, { code: 'PAYMENT_REQUIRED', invoiceUrl: 'https://invoice.stripe.com/i/acct/x' });
      },
    });
    await choose(wrapper, 'pro');
    const box = wrapper.find('[data-testid="change-level-payment"]');
    expect(box.text()).toContain('expires within a day');
    expect(box.find('a').attributes('href')).toBe('https://invoice.stripe.com/i/acct/x');
    expect(box.find('a').attributes('rel')).toBe('noopener noreferrer');
  });

  it('PAYMENT_REQUIRED without an invoice link points at the billing page', async () => {
    const { wrapper } = await mountStripe({
      change: () => {
        throw apiError(402, { code: 'PAYMENT_REQUIRED', invoiceUrl: null });
      },
    });
    await choose(wrapper, 'pro');
    expect(wrapper.find('[data-testid="change-level-payment"]').text()).toContain('Update your payment method');
  });

  it.each([
    ['CANCEL_SCHEDULED', 'Resume it on the billing page first'],
    ['NOT_ACTIVE', 'problem with your payment'],
    ['PAYMENT_METHOD_UNSUPPORTED', 'needs a card'],
    ['PLAN_UNAVAILABLE', 'not available yet'],
    ['OWNER_MISMATCH', 'Contact us'],
    ['MULTIPLE_SUBSCRIPTIONS', 'Contact us'],
    ['SOMETHING_NEW', 'Try again'],
  ])('error %s shows the matching message', async (code, text) => {
    const { wrapper } = await mountStripe({
      change: () => {
        throw apiError(409, { code });
      },
    });
    await choose(wrapper, 'plus');
    expect(wrapper.find('[data-testid="change-level-error"]').text()).toContain(text);
  });

  it('every locale carries every change-level string', () => {
    const all = JSON.parse(
      readFileSync('app/components/membership/ManageCard.vue', 'utf8').match(
        /<i18n lang="json">\n([\s\S]*?)<\/i18n>/
      )![1]!
    );
    const keys = Object.keys(all.en.member.change).sort();
    for (const [locale, messages] of Object.entries<any>(all)) {
      expect(Object.keys(messages.member.change).sort(), locale).toEqual(keys);
      expect(messages.member.change_plan_stripe, locale).toBeUndefined();
    }
  });
});
