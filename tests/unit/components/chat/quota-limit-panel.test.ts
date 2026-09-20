/**
 * QuotaLimitPanel across the five chat tiers. The global i18n stub returns
 * keys verbatim, so assertions read keys and the params handed to `t`, which
 * is exactly what a wall must get right: the tier ABOVE the one just hit, with
 * that tier's allowance, and no upsell at all for Pro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

const t = vi.fn((key: string) => key);
(global as any).useI18n = vi.fn(() => ({ t, locale: { value: 'en' } }));
(global as any).useRoute = vi.fn(() => ({ fullPath: '/chat' }));
const capture = vi.fn();
(global as any).usePostHog = vi.fn(() => ({ capture }));

const QuotaLimitPanel = (await import('~~/app/components/Chat/QuotaLimitPanel.vue')).default;

const stubs = { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } };

function mountFor(tier: string, used = 25, limit = 25) {
  return mount(QuotaLimitPanel, {
    props: { quota: { tier, used, limit, upgradeUrl: '/membership' } },
    global: { stubs },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuotaLimitPanel', () => {
  it('sells a base-plan member the Plus plan, with its allowance in the body', () => {
    const w = mountFor('member');
    expect(t).toHaveBeenCalledWith('member.body', { plan: 'plan.plus', limit: 65 });
    expect(t).toHaveBeenCalledWith('benefit.next_allowance', { plan: 'plan.plus', limit: 65 });
    expect(w.text()).toContain('upgrade.cta');
    expect(w.text()).not.toContain('free.cta');
  });

  it('sells a Plus member the Pro plan', () => {
    const w = mountFor('plus', 65, 65);
    expect(t).toHaveBeenCalledWith('plus.body', { plan: 'plan.pro', limit: 135 });
    expect(w.text()).toContain('upgrade.cta');
  });

  it('gives a Pro member the reset date and nothing to buy', () => {
    const w = mountFor('pro', 135, 135);
    expect(w.text()).toContain('pro.body');
    expect(w.text()).not.toContain('upgrade.cta');
    expect(w.text()).not.toContain('benefit.');
    expect(w.find('.fa-hourglass-half').exists()).toBe(true);
    // The way out survives for the tier with no CTA.
    expect(w.text()).toContain('try_again');
  });

  it('sends an anonymous visitor to sign in and a free account to membership', () => {
    const anon = mountFor('anonymous', 15, 15);
    expect(anon.text()).toContain('anonymous.cta');
    expect(anon.find('a[href^="/login"]').exists()).toBe(true);

    const free = mountFor('free', 20, 20);
    expect(free.text()).toContain('free.cta');
    expect(t).toHaveBeenCalledWith('benefit.member_allowance', expect.objectContaining({ member: 25 }));
  });

  it('records the impression against the tier', () => {
    mountFor('plus', 65, 65);
    expect(capture).toHaveBeenCalledWith('chat_limit_reached', {
      tier: 'plus',
      used: 65,
      limit: 65,
      restored: false,
    });
  });
});
