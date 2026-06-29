import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// Re-imported per test after vi.resetModules() so the module-level rate cache
// (cachedRates / ratesFetchPromise) starts clean each time. Mirrors the
// useProfile dynamic-import pattern.
const loadUseCurrency = async () => {
  const mod = await import('~/app/composables/useCurrency');
  return mod;
};

const DEFAULT_RATES = { USD: 1, EUR: 0.85, GBP: 0.73, JPY: 150, AUD: 1.53, CAD: 1.36 };

let mockSupabase: ReturnType<typeof setupGlobalMocks>['mockSupabase'];

beforeEach(() => {
  // setupGlobalMocks stubs useAuth + useSupabase; default to anon (no user).
  const mocks = setupGlobalMocks();
  mockSupabase = mocks.mockSupabase;
  // Fresh $fetch per test; default resolves to a rates payload.
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rates: { ...DEFAULT_RATES } }));
  // Reset the global useState store so userCurrency etc. start at defaults.
  if ((global as any).__resetNuxtState) (global as any).__resetNuxtState();
  // localStorage is a shared vi.fn mock from the setup file — clear call history
  // and reset getItem to undefined so it doesn't leak across tests.
  (localStorage.getItem as any).mockReset?.();
  (localStorage.setItem as any).mockReset?.();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanupGlobalMocks();
});

describe('useCurrency', () => {
  // ===========================================================================
  // SUPPORTED_CURRENCIES export
  // ===========================================================================
  describe('SUPPORTED_CURRENCIES', () => {
    it('exports an array of 15 currencies', async () => {
      const { SUPPORTED_CURRENCIES } = await loadUseCurrency();
      expect(SUPPORTED_CURRENCIES).toHaveLength(15);
    });

    it('includes all 15 expected currency codes', async () => {
      const { SUPPORTED_CURRENCIES } = await loadUseCurrency();
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
      const expected = [
        'USD',
        'EUR',
        'GBP',
        'JPY',
        'AUD',
        'CAD',
        'CHF',
        'CNY',
        'HKD',
        'NZD',
        'SEK',
        'KRW',
        'SGD',
        'NOK',
        'MXN',
      ];
      for (const code of expected) {
        expect(codes).toContain(code);
      }
    });

    it('has code, name, symbol, and locale (all strings) for each currency', async () => {
      const { SUPPORTED_CURRENCIES } = await loadUseCurrency();
      for (const currency of SUPPORTED_CURRENCIES) {
        expect(typeof currency.code).toBe('string');
        expect(typeof currency.name).toBe('string');
        expect(typeof currency.symbol).toBe('string');
        expect(typeof currency.locale).toBe('string');
      }
    });

    it('has correct metadata for USD', async () => {
      const { SUPPORTED_CURRENCIES } = await loadUseCurrency();
      const usd = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD');
      expect(usd).toEqual({ code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' });
    });

    it('has correct metadata for GBP', async () => {
      const { SUPPORTED_CURRENCIES } = await loadUseCurrency();
      const gbp = SUPPORTED_CURRENCIES.find((c) => c.code === 'GBP');
      expect(gbp).toEqual({ code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' });
    });

    it('has correct metadata for EUR', async () => {
      const { SUPPORTED_CURRENCIES } = await loadUseCurrency();
      const eur = SUPPORTED_CURRENCIES.find((c) => c.code === 'EUR');
      expect(eur).toEqual({ code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' });
    });

    it('is re-exported from the composable return value (same reference)', async () => {
      const { useCurrency, SUPPORTED_CURRENCIES } = await loadUseCurrency();
      expect(useCurrency().SUPPORTED_CURRENCIES).toBe(SUPPORTED_CURRENCIES);
    });
  });

  // ===========================================================================
  // formatCurrency
  // ===========================================================================
  describe('formatCurrency', () => {
    it('formats USD with comma separators', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(1000, 'USD')).toContain('1,000');
    });

    it('formats large USD amounts', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(1250000, 'USD')).toContain('1,250,000');
    });

    it('formats GBP with the pound symbol', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      const result = formatCurrency(500, 'GBP');
      expect(result).toContain('500');
      expect(result).toContain('£');
    });

    it('formats EUR amounts', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(999, 'EUR')).toContain('999');
    });

    it('formats JPY amounts', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(50000, 'JPY')).toContain('50,000');
    });

    it('defaults to USD when no currency code is provided', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      const result = formatCurrency(100);
      expect(result).toContain('100');
      expect(result).toContain('$');
    });

    it('returns symbol + "0" for null amount (default USD)', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      // Documented branch: amount null/undefined => getCurrencySymbol(code) + '0'
      expect(formatCurrency(null)).toBe('$0');
    });

    it('returns symbol + "0" for undefined amount (default USD)', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('returns the GBP symbol + "0" for null amount with GBP', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(null, 'GBP')).toBe('£0');
    });

    it('falls back to the raw code + "0" for null amount with an unsupported code', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      // getCurrencySymbol returns the code itself for unknown currencies.
      expect(formatCurrency(null, 'XYZ' as any)).toBe('XYZ0');
    });

    it('formats zero as a real currency string (not the null fallback)', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      const result = formatCurrency(0, 'USD');
      expect(result).toContain('0');
      // 0 is a valid amount, so it goes through Intl, not the symbol+'0' branch.
      expect(result).toContain('$');
    });

    it('formats with no decimal places', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      const result = formatCurrency(1999, 'USD');
      expect(result).not.toMatch(/\.\d{2}/);
      expect(result).toContain('1,999');
    });

    it('handles negative amounts', async () => {
      const { formatCurrency } = (await loadUseCurrency()).useCurrency();
      expect(formatCurrency(-500, 'USD')).toContain('500');
    });
  });

  // ===========================================================================
  // getCurrencySymbol
  // ===========================================================================
  describe('getCurrencySymbol', () => {
    it('returns $ for USD', async () => {
      const { getCurrencySymbol } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('returns the pound sign for GBP', async () => {
      const { getCurrencySymbol } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('returns the euro sign for EUR', async () => {
      const { getCurrencySymbol } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('returns the yen sign for JPY', async () => {
      const { getCurrencySymbol } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    it('returns kr for SEK', async () => {
      const { getCurrencySymbol } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencySymbol('SEK')).toBe('kr');
    });

    it('returns the code itself for an unknown currency', async () => {
      const { getCurrencySymbol } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencySymbol('XYZ' as any)).toBe('XYZ');
    });
  });

  // ===========================================================================
  // getCurrencyInfo
  // ===========================================================================
  describe('getCurrencyInfo', () => {
    it('returns full info for USD', async () => {
      const { getCurrencyInfo } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencyInfo('USD')).toEqual({ code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' });
    });

    it('returns full info for GBP', async () => {
      const { getCurrencyInfo } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencyInfo('GBP')).toEqual({
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        locale: 'en-GB',
      });
    });

    it('returns undefined for an unknown currency code', async () => {
      const { getCurrencyInfo } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencyInfo('XYZ' as any)).toBeUndefined();
    });

    it('returns undefined for an empty string', async () => {
      const { getCurrencyInfo } = (await loadUseCurrency()).useCurrency();
      expect(getCurrencyInfo('' as any)).toBeUndefined();
    });
  });

  // ===========================================================================
  // isSupportedCurrency
  // ===========================================================================
  describe('isSupportedCurrency', () => {
    it('returns true for USD, GBP, EUR', async () => {
      const { isSupportedCurrency } = (await loadUseCurrency()).useCurrency();
      expect(isSupportedCurrency('USD')).toBe(true);
      expect(isSupportedCurrency('GBP')).toBe(true);
      expect(isSupportedCurrency('EUR')).toBe(true);
    });

    it('returns true for every supported currency code', async () => {
      const mod = await loadUseCurrency();
      const { isSupportedCurrency } = mod.useCurrency();
      for (const currency of mod.SUPPORTED_CURRENCIES) {
        expect(isSupportedCurrency(currency.code)).toBe(true);
      }
    });

    it('returns false for an unsupported currency code', async () => {
      const { isSupportedCurrency } = (await loadUseCurrency()).useCurrency();
      expect(isSupportedCurrency('XYZ')).toBe(false);
    });

    it('returns false for an empty string', async () => {
      const { isSupportedCurrency } = (await loadUseCurrency()).useCurrency();
      expect(isSupportedCurrency('')).toBe(false);
    });

    it('returns false for a lowercase code (case-sensitive)', async () => {
      const { isSupportedCurrency } = (await loadUseCurrency()).useCurrency();
      expect(isSupportedCurrency('usd')).toBe(false);
    });
  });

  // ===========================================================================
  // fetchExchangeRates
  // ===========================================================================
  describe('fetchExchangeRates', () => {
    it('fetches from the /api/exchange-rates endpoint', async () => {
      const { fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      const rates = await fetchExchangeRates();
      expect($fetch).toHaveBeenCalledWith('/api/exchange-rates');
      expect(rates).toEqual(expect.objectContaining({ USD: 1, EUR: 0.85, GBP: 0.73, JPY: 150 }));
    });

    it('updates the exchangeRates ref after a successful fetch', async () => {
      const { fetchExchangeRates, exchangeRates } = (await loadUseCurrency()).useCurrency();
      expect(exchangeRates.value).toBeNull();
      await fetchExchangeRates();
      expect(exchangeRates.value).toEqual(expect.objectContaining({ USD: 1, EUR: 0.85 }));
    });

    it('leaves ratesLoading false after a successful fetch', async () => {
      const { fetchExchangeRates, ratesLoading } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(ratesLoading.value).toBe(false);
    });

    it('returns module-cached rates on subsequent calls without re-fetching', async () => {
      const { fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      const first = await fetchExchangeRates();
      const second = await fetchExchangeRates();
      expect(first).toEqual(second);
      expect($fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null and surfaces the error on fetch failure', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const { fetchExchangeRates, ratesError } = (await loadUseCurrency()).useCurrency();
      const rates = await fetchExchangeRates();
      expect(rates).toBeNull();
      expect(ratesError.value).toBe('Failed to load exchange rates');
    });

    it('leaves ratesLoading false after a failed fetch', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Timeout')));
      const { fetchExchangeRates, ratesLoading } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(ratesLoading.value).toBe(false);
    });

    it('logs the error to console on failure', async () => {
      const networkError = new Error('Network failure');
      vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(networkError));
      const { fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(console.error).toHaveBeenCalledWith('Exchange rate fetch error:', networkError);
    });

    it('does NOT cache a failed fetch — a later call retries and can succeed', async () => {
      const failing = vi.fn().mockRejectedValue(new Error('first try down'));
      vi.stubGlobal('$fetch', failing);
      const { fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      expect(await fetchExchangeRates()).toBeNull();

      // Swap in a working $fetch and retry — the module must not have cached null.
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rates: { ...DEFAULT_RATES } }));
      const second = await fetchExchangeRates();
      expect(second).toEqual(expect.objectContaining({ USD: 1 }));
    });

    it('deduplicates concurrent fetch calls into a single request', async () => {
      const mod = await loadUseCurrency();
      const instance1 = mod.useCurrency();
      const instance2 = mod.useCurrency();
      const [r1, r2] = await Promise.all([instance1.fetchExchangeRates(), instance2.fetchExchangeRates()]);
      expect(r1).toEqual(r2);
      expect($fetch).toHaveBeenCalledTimes(1);
    });

    it('shares the module-level cache across separate useCurrency instances', async () => {
      const mod = await loadUseCurrency();
      const instance1 = mod.useCurrency();
      const instance2 = mod.useCurrency();
      await instance1.fetchExchangeRates();
      const result = await instance2.fetchExchangeRates();
      expect(result).toEqual(expect.objectContaining({ USD: 1 }));
      expect($fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // convertCurrency
  // ===========================================================================
  describe('convertCurrency', () => {
    it('returns null when rates have not been fetched', async () => {
      const { convertCurrency } = (await loadUseCurrency()).useCurrency();
      expect(convertCurrency(100, 'USD', 'EUR')).toBeNull();
    });

    it('returns the same amount for same-currency conversion without rates loaded', async () => {
      const { convertCurrency } = (await loadUseCurrency()).useCurrency();
      expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
    });

    it('returns the same amount for same-currency conversion with rates loaded', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
    });

    it('converts USD to EUR (100 -> 85)', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(convertCurrency(100, 'USD', 'EUR')).toBe(85);
    });

    it('converts GBP to USD (100 -> 137, rounded)', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      // 100 / 0.73 * 1 = 136.98... -> 137
      expect(convertCurrency(100, 'GBP', 'USD')).toBe(137);
    });

    it('converts EUR to GBP (100 -> 86, rounded)', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      // 100 / 0.85 * 0.73 = 85.88... -> 86
      expect(convertCurrency(100, 'EUR', 'GBP')).toBe(86);
    });

    it('converts USD to JPY (100 -> 15000)', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(convertCurrency(100, 'USD', 'JPY')).toBe(15000);
    });

    it('returns null when the fromCurrency rate is missing', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rates: { USD: 1, EUR: 0.85 } }));
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(convertCurrency(100, 'GBP', 'USD')).toBeNull();
    });

    it('returns null when the toCurrency rate is missing', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rates: { USD: 1, EUR: 0.85 } }));
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(convertCurrency(100, 'USD', 'GBP')).toBeNull();
    });

    it('rounds converted amounts to whole numbers', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      const result = convertCurrency(1, 'GBP', 'EUR');
      expect(result).toBe(Math.round((1 / 0.73) * 0.85));
      expect(Number.isInteger(result)).toBe(true);
    });

    it('handles zero amount', async () => {
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      expect(convertCurrency(0, 'USD', 'EUR')).toBe(0);
    });

    it('returns null when a rate is zero (falsy guard)', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ rates: { USD: 1, EUR: 0 } }));
      const { convertCurrency, fetchExchangeRates } = (await loadUseCurrency()).useCurrency();
      await fetchExchangeRates();
      // EUR rate of 0 is falsy, so the guard returns null rather than dividing.
      expect(convertCurrency(100, 'EUR', 'USD')).toBeNull();
      expect(convertCurrency(100, 'USD', 'EUR')).toBeNull();
    });
  });

  // ===========================================================================
  // Reactive state defaults
  // ===========================================================================
  describe('reactive state', () => {
    it('initializes exchangeRates as null', async () => {
      const { exchangeRates } = (await loadUseCurrency()).useCurrency();
      expect(exchangeRates.value).toBeNull();
    });

    it('initializes ratesLoading as false', async () => {
      const { ratesLoading } = (await loadUseCurrency()).useCurrency();
      expect(ratesLoading.value).toBe(false);
    });

    it('initializes ratesError as null', async () => {
      const { ratesError } = (await loadUseCurrency()).useCurrency();
      expect(ratesError.value).toBeNull();
    });

    it('defaults userCurrency to USD', async () => {
      const { userCurrency } = (await loadUseCurrency()).useCurrency();
      expect(userCurrency.value).toBe('USD');
    });
  });

  // ===========================================================================
  // initUserCurrency
  // ===========================================================================
  describe('initUserCurrency', () => {
    it('reads a stored preference from localStorage for visitors', async () => {
      (localStorage.getItem as any).mockReturnValue('GBP');
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency();
      expect(localStorage.getItem).toHaveBeenCalledWith('preferred_currency');
      expect(userCurrency.value).toBe('GBP');
    });

    it('ignores an unsupported stored value and keeps USD', async () => {
      (localStorage.getItem as any).mockReturnValue('XYZ');
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency();
      expect(userCurrency.value).toBe('USD');
    });

    it('reads localStorage only once across repeated calls', async () => {
      (localStorage.getItem as any).mockReturnValue('EUR');
      const { initUserCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency();
      await initUserCurrency();
      expect(localStorage.getItem).toHaveBeenCalledTimes(1);
    });

    it('does not touch Supabase when no userId is provided', async () => {
      const { initUserCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('syncs the profile preferred_currency for a logged-in user', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: { preferred_currency: 'EUR' }, error: null });
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('preferred_currency');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(userCurrency.value).toBe('EUR');
    });

    it('persists the synced profile preference back to localStorage', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: { preferred_currency: 'JPY' }, error: null });
      const { initUserCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency('user-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('preferred_currency', 'JPY');
    });

    it('syncs a given user only once (flag prevents a second query)', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: { preferred_currency: 'EUR' }, error: null });
      const { initUserCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency('user-123');
      await initUserCurrency('user-123');
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('re-syncs when a different user id is passed', async () => {
      mockSupabase._mockSingle
        .mockResolvedValueOnce({ data: { preferred_currency: 'EUR' }, error: null })
        .mockResolvedValueOnce({ data: { preferred_currency: 'GBP' }, error: null });
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency('user-123');
      expect(userCurrency.value).toBe('EUR');
      await initUserCurrency('user-456');
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(userCurrency.value).toBe('GBP');
    });

    it('ignores an unsupported profile preference and leaves the current value', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: { preferred_currency: 'XYZ' }, error: null });
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency('user-123');
      expect(userCurrency.value).toBe('USD');
    });

    it('handles a null profile row without throwing', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: null });
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await expect(initUserCurrency('user-123')).resolves.toBeUndefined();
      expect(userCurrency.value).toBe('USD');
    });

    it('resets the sync flag on a Supabase error so a later call retries', async () => {
      // First call fails at the Supabase layer (error returned, not thrown).
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
      const { initUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await initUserCurrency('user-123');
      expect(userCurrency.value).toBe('USD');

      // Second call should retry (flag was reset) and succeed.
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { preferred_currency: 'GBP' }, error: null });
      await initUserCurrency('user-123');
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(userCurrency.value).toBe('GBP');
    });
  });

  // ===========================================================================
  // setUserCurrency
  // ===========================================================================
  describe('setUserCurrency', () => {
    it('updates userCurrency and writes to localStorage (no userId)', async () => {
      const { setUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await setUserCurrency('EUR');
      expect(userCurrency.value).toBe('EUR');
      expect(localStorage.setItem).toHaveBeenCalledWith('preferred_currency', 'EUR');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('persists the preference to the profile row for a logged-in user', async () => {
      mockSupabase._queryBuilder.eq.mockResolvedValueOnce({ data: null, error: null });
      const { setUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await setUserCurrency('GBP', 'user-123');

      expect(userCurrency.value).toBe('GBP');
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ preferred_currency: 'GBP' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
    });

    it('still updates local state when the profile persist fails', async () => {
      mockSupabase._queryBuilder.eq.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } });
      const { setUserCurrency, userCurrency } = (await loadUseCurrency()).useCurrency();
      await setUserCurrency('JPY', 'user-123');
      // Local preference still applied even though the DB write failed.
      expect(userCurrency.value).toBe('JPY');
      expect(localStorage.setItem).toHaveBeenCalledWith('preferred_currency', 'JPY');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to persist currency preference to profile:',
        expect.anything()
      );
    });

    it('marks the user as synced so a following initUserCurrency skips the query', async () => {
      mockSupabase._queryBuilder.eq.mockResolvedValueOnce({ data: null, error: null });
      const { setUserCurrency, initUserCurrency } = (await loadUseCurrency()).useCurrency();
      await setUserCurrency('GBP', 'user-123');
      // from() was called once for the update; init should not query again.
      const callsAfterSet = mockSupabase.from.mock.calls.length;
      await initUserCurrency('user-123');
      expect(mockSupabase.from.mock.calls.length).toBe(callsAfterSet);
    });

    it('does NOT mark the user as synced when the profile write fails', async () => {
      // setUserCurrency write fails -> sync flag stays unset.
      mockSupabase._queryBuilder.eq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
      const { setUserCurrency, initUserCurrency } = (await loadUseCurrency()).useCurrency();
      await setUserCurrency('GBP', 'user-123');
      const callsAfterSet = mockSupabase.from.mock.calls.length;

      // A subsequent init for the same user SHOULD re-query the profile.
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: { preferred_currency: 'EUR' }, error: null });
      await initUserCurrency('user-123');
      expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(callsAfterSet);
    });
  });
});
