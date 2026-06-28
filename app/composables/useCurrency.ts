/**
 * Multi-currency support composable
 * Handles currency formatting, conversion, and exchange rate fetching
 */

// Supported currencies with metadata (Top 15 world currencies)
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'zh-HK' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', locale: 'es-MX' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

// Module-level cache for exchange rates. These are the SAME for every viewer
// (they don't depend on who's logged in), so caching them at module scope is
// safe even under SSR — there's no per-request data to leak.
let cachedRates: Record<string, number> | null = null;
let ratesFetchPromise: Promise<Record<string, number> | null> | null = null;

export function useCurrency() {
  // User-specific state must use useState so it's request-scoped under SSR —
  // module-level refs would be shared across concurrent requests on the
  // server and leak one user's preference into another user's initial render.
  const userCurrency = useState<CurrencyCode>('currency:user-preferred', () => 'USD');
  const localStorageLoaded = useState<boolean>('currency:localStorage-loaded', () => false);
  const profileSyncedForUserId = useState<string | null>('currency:profile-synced-user-id', () => null);

  const exchangeRates = ref<Record<string, number> | null>(cachedRates);
  const ratesLoading = ref(false);
  const ratesError = ref<string | null>(null);

  /**
   * Fetch exchange rates from server (cached for 24 hours on server)
   * Uses module-level cache to avoid redundant fetches across components
   */
  const fetchExchangeRates = async (): Promise<Record<string, number> | null> => {
    // Return cached rates if available
    if (cachedRates) {
      exchangeRates.value = cachedRates;
      return cachedRates;
    }

    // If a fetch is already in progress, wait for it
    if (ratesFetchPromise) {
      const rates = await ratesFetchPromise;
      exchangeRates.value = rates;
      return rates;
    }

    ratesLoading.value = true;
    ratesError.value = null;

    ratesFetchPromise = $fetch<{ rates: Record<string, number> }>('/api/exchange-rates')
      .then((data) => {
        cachedRates = data.rates;
        exchangeRates.value = data.rates;
        return data.rates;
      })
      .catch((error) => {
        console.error('Exchange rate fetch error:', error);
        ratesError.value = 'Failed to load exchange rates';
        return null;
      })
      .finally(() => {
        ratesLoading.value = false;
        ratesFetchPromise = null;
      });

    return ratesFetchPromise;
  };

  /**
   * Format currency with proper locale and symbol
   */
  const formatCurrency = (amount: number | null | undefined, currencyCode: CurrencyCode = 'USD'): string => {
    if (amount === null || amount === undefined) {
      return getCurrencySymbol(currencyCode) + '0';
    }

    const currency = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
    const locale = currency?.locale || 'en-US';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Convert amount from one currency to another using cached rates
   * Returns null if rates are not available
   */
  const convertCurrency = (amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number | null => {
    if (fromCurrency === toCurrency) return amount;
    // Read the reactive ref (not the module-level cachedRates) so computed
    // callers (e.g. convertedPrice in ListingCard) re-evaluate once the async
    // rates fetch resolves.
    if (!exchangeRates.value) return null;

    // Rates are relative to USD
    const fromRate = exchangeRates.value[fromCurrency];
    const toRate = exchangeRates.value[toCurrency];

    if (!fromRate || !toRate) return null;

    // Convert: amount in fromCurrency -> USD -> toCurrency
    const amountInUSD = amount / fromRate;
    return Math.round(amountInUSD * toRate);
  };

  /**
   * Get currency symbol by code
   */
  const getCurrencySymbol = (code: CurrencyCode): string => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  /**
   * Get full currency info by code
   */
  const getCurrencyInfo = (code: CurrencyCode) => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === code);
  };

  /**
   * Check if a currency code is supported
   */
  const isSupportedCurrency = (code: string): code is CurrencyCode => {
    return SUPPORTED_CURRENCIES.some((c) => c.code === code);
  };

  /**
   * Initialize user currency from localStorage / profile.
   * - localStorage is read once (for visitors and initial hydration).
   * - Profile sync runs once per user id, so calling again after the user
   *   logs in or changes picks up their profile preference.
   */
  const initUserCurrency = async (userId?: string) => {
    // localStorage for everyone (including visitors) — read once per session
    if (!localStorageLoaded.value && import.meta.client) {
      localStorageLoaded.value = true;
      const stored = localStorage.getItem('preferred_currency');
      if (stored && isSupportedCurrency(stored)) {
        userCurrency.value = stored as CurrencyCode;
      }
    }

    // Logged-in user's profile preference is authoritative — sync once per user
    if (userId && profileSyncedForUserId.value !== userId) {
      profileSyncedForUserId.value = userId;
      try {
        const supabase = useSupabase();
        // Destructure `error` so a Supabase-level failure (which returns
        // { data: null, error } without throwing) is surfaced — otherwise
        // the sync flag stays set and blocks retries until reload.
        const { data, error } = await supabase
          .from('profiles')
          .select('preferred_currency')
          .eq('id', userId)
          .single();
        if (error) throw error;
        if (data?.preferred_currency && isSupportedCurrency(data.preferred_currency)) {
          userCurrency.value = data.preferred_currency as CurrencyCode;
          if (import.meta.client) {
            localStorage.setItem('preferred_currency', data.preferred_currency);
          }
        }
      } catch {
        // Reset so a later retry can attempt again
        profileSyncedForUserId.value = null;
      }
    }
  };

  /**
   * Update the global user currency preference. Persists to localStorage and,
   * if a user id is provided, to their profile row.
   */
  const setUserCurrency = async (code: CurrencyCode, userId?: string) => {
    userCurrency.value = code;
    if (import.meta.client) {
      localStorage.setItem('preferred_currency', code);
    }
    if (userId) {
      try {
        const supabase = useSupabase();
        // Destructure `error` so a silent Supabase failure doesn't leave the
        // sync flag set — otherwise future `initUserCurrency` calls would
        // trust the flag and never re-sync from the profile row.
        const { error } = await supabase.from('profiles').update({ preferred_currency: code }).eq('id', userId);
        if (error) throw error;
        profileSyncedForUserId.value = userId;
      } catch (error) {
        console.error('Failed to persist currency preference to profile:', error);
      }
    }
  };

  return {
    SUPPORTED_CURRENCIES,
    userCurrency,
    exchangeRates: readonly(exchangeRates),
    ratesLoading: readonly(ratesLoading),
    ratesError: readonly(ratesError),
    fetchExchangeRates,
    formatCurrency,
    convertCurrency,
    getCurrencySymbol,
    getCurrencyInfo,
    isSupportedCurrency,
    initUserCurrency,
    setUserCurrency,
  };
}
