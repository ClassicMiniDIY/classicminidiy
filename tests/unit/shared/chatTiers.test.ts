import { describe, it, expect } from 'vitest';
import {
  CHAT_QUOTAS,
  CHAT_TIER_ORDER,
  chatTierForPlan,
  isPaidChatTier,
  MEMBERSHIP_PLANS,
  nextTier,
} from '~~/shared/utils/chatTiers';

// The chat tier contract behind the Member / Plus / Pro plans
// (classicminidiy-supabase docs/plans/2026-09-19-chat-tiers.md). Every wall on
// the web and in the apps quotes the tier ABOVE the one just hit, so the order
// and the mapping here are load-bearing for copy on three platforms.

describe('nextTier', () => {
  it('walks cheapest to dearest and stops at Pro', () => {
    expect(nextTier('anonymous')).toBe('free');
    expect(nextTier('free')).toBe('member');
    expect(nextTier('member')).toBe('plus');
    expect(nextTier('plus')).toBe('pro');
    expect(nextTier('pro')).toBeNull();
  });

  it('never quotes a smaller allowance than the tier just hit', () => {
    for (const tier of CHAT_TIER_ORDER) {
      const next = nextTier(tier);
      if (!next) continue;
      const here = CHAT_QUOTAS[tier].perMonth ?? CHAT_QUOTAS[tier].perDay ?? 0;
      expect(CHAT_QUOTAS[next].perMonth ?? 0).toBeGreaterThan(here);
    }
  });
});

describe('chatTierForPlan', () => {
  it('maps the three plans and NULL as get_membership_plan returns them', () => {
    expect(chatTierForPlan(null)).toBe('free');
    expect(chatTierForPlan(undefined)).toBe('free');
    expect(chatTierForPlan('base')).toBe('member');
    expect(chatTierForPlan('plus')).toBe('plus');
    expect(chatTierForPlan('pro')).toBe('pro');
  });

  it('treats an unknown plan as paid (member), never as free', () => {
    expect(chatTierForPlan('ultra')).toBe('member');
  });
});

describe('the plans', () => {
  it('quote the caps from the design: 25 / 65 / 135 at $1.99 / $4.99 / $9.99', () => {
    expect(MEMBERSHIP_PLANS.map((p) => [p.plan, p.usd, CHAT_QUOTAS[p.tier].perMonth])).toEqual([
      ['base', 1.99, 25],
      ['plus', 4.99, 65],
      ['pro', 9.99, 135],
    ]);
    expect(CHAT_QUOTAS.free.perMonth).toBe(20);
    expect(CHAT_QUOTAS.anonymous.perDay).toBe(15);
  });

  it('are the only paid tiers', () => {
    expect(CHAT_TIER_ORDER.filter(isPaidChatTier)).toEqual(['member', 'plus', 'pro']);
    expect(isPaidChatTier(undefined)).toBe(false);
  });
});
