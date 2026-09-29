// @vitest-environment happy-dom
/**
 * <SettingsCurrencySelect> (app/components/settings/CurrencySelect.vue): the
 * display-currency preference on /settings/preferences.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import CurrencySelect from '~/app/components/settings/CurrencySelect.vue';

function mountSelect(userId: string | null) {
  const setUserCurrency = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('useCurrency', () => ({
    SUPPORTED_CURRENCIES: [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
    ],
    userCurrency: ref('USD'),
    setUserCurrency,
  }));
  vi.stubGlobal('useAuth', () => ({ user: ref(userId ? { id: userId } : null) }));
  return { wrapper: mount(CurrencySelect), setUserCurrency };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsCurrencySelect', () => {
  it('saves to the signed-in user profile', async () => {
    const { wrapper, setUserCurrency } = mountSelect('user-1');
    await wrapper.find('select').setValue('EUR');
    await flushPromises();
    expect(setUserCurrency).toHaveBeenCalledWith('EUR', 'user-1');
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
  });

  it('saves to this browser only when signed out', async () => {
    const { wrapper, setUserCurrency } = mountSelect(null);
    await wrapper.find('select').setValue('EUR');
    await flushPromises();
    expect(setUserCurrency).toHaveBeenCalledWith('EUR', undefined);
  });
});
