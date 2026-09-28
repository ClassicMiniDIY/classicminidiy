// @vitest-environment happy-dom
/**
 * Support lookup on /admin/membership (membership clarity §8).
 *
 * The case this exists for: a member holds several subscriptions rows (say a
 * comp row on Pro and a Stripe row on Member). Every row must be shown with its
 * own platform, plan, status and expiry, never merged into one "Stripe · Pro".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import MemberLookup from '~/app/components/admin/MemberLookup.vue';
import type { MemberLookupResponse } from '~~/shared/utils/memberLookup';

const adminFetch = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  adminFetch.mockReset();
  vi.stubGlobal('$adminFetch', adminFetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const TWO_ROWS: MemberLookupResponse = {
  truncated: false,
  results: [
    {
      user_id: '11111111-1111-1111-1111-111111111111',
      email: 'teresa@example.com',
      display_name: 'Teresa',
      matched_on: ['account_email', 'ghost_email'],
      subscriptions: [
        {
          platform: 'comp',
          product_id: 'sustaining',
          status: 'active',
          plan: 'pro',
          expires_at: null,
          external_ref: null,
          updated_at: '2026-09-20T10:00:00Z',
        },
        {
          platform: 'stripe',
          product_id: 'sustaining',
          status: 'active',
          plan: 'base',
          expires_at: '2099-10-20T10:00:00Z',
          external_ref: 'sub_ClassicMiniRestorationProjectSaudiArabia1959CooperSMkITwinCarbHydrolastic',
          updated_at: '2026-09-21T10:00:00Z',
        },
      ],
      pending_claims: [
        {
          provider: 'patreon',
          external_ref: '98765',
          email: 'teresa.other@example.com',
          status: 'pending',
          plan: 'plus',
          claim_issued_at: '2026-09-22T10:00:00Z',
        },
      ],
      discord: { status: 'active', discord_username: 'teresa_mini', discord_user_id: '123456789012345678' },
    },
    {
      user_id: null,
      email: 'payer@example.com',
      display_name: null,
      matched_on: ['pending_email'],
      subscriptions: [],
      pending_claims: [
        {
          provider: 'patreon',
          external_ref: '555',
          email: 'payer@example.com',
          status: 'pending',
          plan: 'base',
          claim_issued_at: null,
        },
      ],
      discord: null,
    },
    {
      user_id: null,
      email: null,
      display_name: null,
      matched_on: ['external_ref'],
      subscriptions: [
        {
          platform: 'apple',
          product_id: 'sustaining',
          status: 'expired',
          plan: 'plus',
          expires_at: '2020-01-01T00:00:00Z',
          external_ref: '2000000123456789',
          updated_at: '2026-09-16T10:00:00Z',
        },
      ],
      pending_claims: [],
      discord: null,
    },
  ],
};

async function search(wrapper: ReturnType<typeof mount>, q: string) {
  await wrapper.find('input[type="search"]').setValue(q);
  await vi.advanceTimersByTimeAsync(400);
  await flushPromises();
}

describe('AdminMemberLookup', () => {
  it('does not call the route until the query has 3 characters', async () => {
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'te');
    expect(adminFetch).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="lookup-hint"]').exists()).toBe(true);
  });

  it('debounces typing into one request with the trimmed query', async () => {
    adminFetch.mockResolvedValue({ results: [], truncated: false });
    const wrapper = mount(MemberLookup);
    const input = wrapper.find('input[type="search"]');
    await input.setValue('ter');
    await vi.advanceTimersByTimeAsync(100);
    await input.setValue('tere');
    await vi.advanceTimersByTimeAsync(100);
    await input.setValue(' teresa ');
    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();
    expect(adminFetch).toHaveBeenCalledTimes(1);
    expect(adminFetch).toHaveBeenCalledWith('/api/admin/membership/find', { query: { q: 'teresa' } });
  });

  it('lists every subscription row with its own platform, plan, status and expiry', async () => {
    adminFetch.mockResolvedValue(TWO_ROWS);
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'teresa');

    const first = wrapper.findAll('[data-testid="lookup-result"]')[0]!;
    const subs = first.findAll('[data-testid="lookup-subscription"]');
    expect(subs).toHaveLength(2);
    const cells = (i: number) => subs[i]!.findAll('td').map((td) => td.text());
    expect(cells(0).slice(0, 4)).toEqual(['comp', 'Pro', 'active', 'No expiry']);
    expect(cells(1).slice(0, 3)).toEqual(['stripe', 'Member', 'active']);
    expect(cells(1)[3]).not.toBe('No expiry');
    // Never one merged "platform · plan" pair.
    expect(first.text()).not.toMatch(/stripe\s*·\s*Pro/i);
  });

  it('shows pending claims, Discord state and what matched', async () => {
    adminFetch.mockResolvedValue(TWO_ROWS);
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'teresa');

    const first = wrapper.findAll('[data-testid="lookup-result"]')[0]!;
    expect(first.find('[data-testid="lookup-claims"]').text()).toContain('teresa.other@example.com');
    expect(first.find('[data-testid="lookup-claims"]').text()).toContain('Plus');
    expect(first.find('[data-testid="lookup-discord"]').text()).toContain('@teresa_mini');
    expect(first.text()).toContain('Matched on: account email, Ghost email');
  });

  it('labels an unclaimed payer and a deleted account, keeping the RPC order', async () => {
    adminFetch.mockResolvedValue(TWO_ROWS);
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'teresa');

    const results = wrapper.findAll('[data-testid="lookup-result"]');
    expect(results).toHaveLength(3);
    expect(results[0]!.text()).toContain('Account');
    expect(results[1]!.text()).toContain('Unclaimed payer');
    expect(results[1]!.find('[data-testid="lookup-email"]').text()).toBe('payer@example.com');
    expect(results[1]!.find('[data-testid="lookup-discord"]').text()).toContain('Discord not linked');
    expect(results[2]!.find('[data-testid="lookup-email"]').text()).toBe('Deleted account');
    expect(results[2]!.findAll('[data-testid="lookup-subscription"]')).toHaveLength(1);
  });

  it('says when more members matched than are shown', async () => {
    adminFetch.mockResolvedValue({ ...TWO_ROWS, truncated: true });
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'example.com');
    expect(wrapper.find('[data-testid="lookup-truncated"]').text()).toContain('Refine your search');
  });

  it('shows the empty state', async () => {
    adminFetch.mockResolvedValue({ results: [], truncated: false });
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'nobody@example.com');
    expect(wrapper.find('[data-testid="lookup-empty"]').text()).toContain('nobody@example.com');
  });

  it('shows the error state', async () => {
    adminFetch.mockRejectedValue({ data: { statusMessage: 'function not found' } });
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'teresa');
    expect(wrapper.find('[data-testid="lookup-error"]').text()).toContain('function not found');
    expect(wrapper.findAll('[data-testid="lookup-result"]')).toHaveLength(0);
  });

  it('ignores a slow answer to an older query', async () => {
    let resolveOld!: (v: MemberLookupResponse) => void;
    adminFetch
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce({ results: [], truncated: false });
    const wrapper = mount(MemberLookup);
    await search(wrapper, 'tere');
    await search(wrapper, 'nobody@example.com');
    resolveOld(TWO_ROWS);
    await flushPromises();
    expect(wrapper.findAll('[data-testid="lookup-result"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="lookup-empty"]').exists()).toBe(true);
  });
});
