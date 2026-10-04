// @vitest-environment happy-dom
/**
 * Claimed transactions on /admin/membership (TXN_CLAIMED support cases).
 *
 * The case this exists for: a user verified a store purchase that belongs to
 * another account. Support must see both accounts, confirm a dialog that names
 * both, and the move must send the owner the admin saw, so a row that changed
 * hands since the list loaded is refused rather than moved again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ClaimedTransactions from '~/app/components/admin/ClaimedTransactions.vue';
import type { ClaimedTransactionRow, ClaimedTransactionsResponse } from '~~/shared/utils/claimedTransactions';

const adminFetch = vi.fn();
const toastAdd = vi.fn();

const LONG = 'ClassicMiniRestorationProjectSaudiArabia1959CooperSMkITwinCarbHydrolastic';

const CASE: ClaimedTransactionRow = {
  subscription_id: '00000000-0000-0000-0000-000000000001',
  platform: 'apple',
  caller_user_id: '11111111-1111-1111-1111-111111111111',
  caller_email: `caller.${LONG}@example.com`,
  owner_user_id: '22222222-2222-2222-2222-222222222222',
  owner_email: 'owner@example.com',
  status: 'active',
  expires_at: '2099-01-01T00:00:00Z',
  plan: 'plus',
  attempts: 4,
  first_attempt_at: '2026-10-01T10:00:00Z',
  last_attempt_at: '2026-10-02T10:00:00Z',
  caller_entitled_now: false,
};

const SECOND: ClaimedTransactionRow = {
  ...CASE,
  caller_user_id: '44444444-4444-4444-4444-444444444444',
  caller_email: null,
  caller_entitled_now: true,
  attempts: 1,
};

function listResponse(results: ClaimedTransactionRow[], truncated = false): ClaimedTransactionsResponse {
  return { results, truncated };
}

/** Route the two endpoints; `reassign` decides the POST outcome. */
function routes(
  list: ClaimedTransactionsResponse[],
  reassign: () => Promise<unknown> = async () => ({ success: true })
) {
  const queue = [...list];
  adminFetch.mockImplementation((url: string) => {
    if (url === '/api/admin/membership/claimed') return Promise.resolve(queue.shift() ?? listResponse([]));
    if (url === '/api/admin/membership/reassign') return reassign();
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

beforeEach(() => {
  adminFetch.mockReset();
  toastAdd.mockReset();
  vi.stubGlobal('$adminFetch', adminFetch);
  vi.stubGlobal('useToast', () => ({ add: toastAdd }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mounted() {
  const wrapper = mount(ClaimedTransactions);
  await flushPromises();
  return wrapper;
}

describe('AdminClaimedTransactions', () => {
  it('lists each case with both accounts, platform, plan, status and count', async () => {
    routes([listResponse([CASE, SECOND])]);
    const wrapper = await mounted();
    expect(adminFetch).toHaveBeenCalledWith('/api/admin/membership/claimed');
    const rows = wrapper.findAll('[data-testid="claimed-row"]');
    expect(rows).toHaveLength(2);
    const first = rows[0]!.text();
    expect(first).toContain(CASE.caller_email!);
    expect(first).toContain('owner@example.com');
    expect(first).toContain('apple');
    expect(first).toContain('Plus');
    expect(first).toContain('active');
    expect(first).toContain('4');
    // A caller with no email falls back to the user id, and the covered flag shows.
    expect(rows[1]!.text()).toContain(SECOND.caller_user_id);
    expect(rows[1]!.text()).toContain('Member through another channel');
    expect(wrapper.find('[data-testid="claimed-count"]').text()).toBe('2');
  });

  it('truncates a long unbroken email in its cell', async () => {
    routes([listResponse([CASE])]);
    const wrapper = await mounted();
    const cell = wrapper.find('[data-testid="claimed-row"] td div');
    expect(cell.classes()).toEqual(expect.arrayContaining(['truncate', 'max-w-[16rem]']));
    expect(cell.attributes('title')).toBe(CASE.caller_email);
  });

  it('shows the empty state when there are no cases', async () => {
    routes([listResponse([])]);
    const wrapper = await mounted();
    expect(wrapper.find('[data-testid="claimed-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="claimed-row"]').exists()).toBe(false);
  });

  it('shows the route error instead of an empty state', async () => {
    adminFetch.mockRejectedValue({ data: { statusMessage: 'function not found' } });
    const wrapper = await mounted();
    expect(wrapper.find('[data-testid="claimed-error"]').text()).toContain('function not found');
    expect(wrapper.find('[data-testid="claimed-empty"]').exists()).toBe(false);
  });

  it('says when more cases exist than are shown', async () => {
    routes([listResponse([CASE], true)]);
    const wrapper = await mounted();
    expect(wrapper.find('[data-testid="claimed-truncated"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="claimed-count"]').text()).toBe('1+');
  });

  it('opens a confirm dialog naming both emails, and moves nothing until confirmed', async () => {
    routes([listResponse([CASE])]);
    const wrapper = await mounted();
    await wrapper.find('[data-testid="claimed-move"]').trigger('click');
    expect(wrapper.find('[data-testid="claimed-modal-from"]').text()).toBe('owner@example.com');
    expect(wrapper.find('[data-testid="claimed-modal-to"]').text()).toBe(CASE.caller_email);
    expect(adminFetch).not.toHaveBeenCalledWith('/api/admin/membership/reassign', expect.anything());
  });

  it('cancel closes the dialog without a request', async () => {
    routes([listResponse([CASE])]);
    const wrapper = await mounted();
    await wrapper.find('[data-testid="claimed-move"]').trigger('click');
    await wrapper.findAll('.modal-action button')[0]!.trigger('click');
    expect(wrapper.find('[data-testid="claimed-modal"]').exists()).toBe(false);
    expect(adminFetch).toHaveBeenCalledTimes(1);
  });

  it('confirm posts the case with the owner the admin saw, toasts, and reloads the list', async () => {
    routes([listResponse([CASE]), listResponse([])]);
    const wrapper = await mounted();
    await wrapper.find('[data-testid="claimed-move"]').trigger('click');
    await wrapper.find('[data-testid="claimed-confirm"]').trigger('click');
    await flushPromises();

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/membership/reassign', {
      method: 'POST',
      body: {
        subscriptionId: CASE.subscription_id,
        toUserId: CASE.caller_user_id,
        expectedOwnerId: CASE.owner_user_id,
      },
    });
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'success', title: 'Subscription moved', icon: 'fas fa-check' })
    );
    expect(toastAdd.mock.calls[0]![0].description).toContain(CASE.caller_email);
    // List, move, list again.
    expect(adminFetch.mock.calls.map((c) => c[0])).toEqual([
      '/api/admin/membership/claimed',
      '/api/admin/membership/reassign',
      '/api/admin/membership/claimed',
    ]);
    expect(wrapper.find('[data-testid="claimed-modal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="claimed-empty"]').exists()).toBe(true);
  });

  it('keeps the dialog open with the reason when the move is refused', async () => {
    routes([listResponse([CASE])], () =>
      Promise.reject({ data: { statusMessage: 'This subscription changed owner since the list loaded.' } })
    );
    const wrapper = await mounted();
    await wrapper.find('[data-testid="claimed-move"]').trigger('click');
    await wrapper.find('[data-testid="claimed-confirm"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="claimed-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="claimed-move-error"]').text()).toContain('changed owner');
    expect(toastAdd).not.toHaveBeenCalled();
    // No reload after a refusal.
    expect(adminFetch.mock.calls.filter((c) => c[0] === '/api/admin/membership/claimed')).toHaveLength(1);
  });

  it('exposes load so the page Refresh button can reload it', async () => {
    routes([listResponse([]), listResponse([CASE])]);
    const wrapper = await mounted();
    await (wrapper.vm as unknown as { load: () => Promise<void> }).load();
    await flushPromises();
    expect(wrapper.findAll('[data-testid="claimed-row"]')).toHaveLength(1);
  });
});
