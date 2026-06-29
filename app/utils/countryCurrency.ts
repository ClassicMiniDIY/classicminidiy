/**
 * Map a country name to a default currency code from SUPPORTED_CURRENCIES.
 * Only currencies supported by the app are returned — others fall back to USD.
 */
import type { CurrencyCode } from '~/composables/useCurrency';

// Country name (lowercased) → currency code. Only maps to currencies the app
// actually supports. Regions whose real currency isn't supported are omitted
// so callers can apply their own fallback.
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  // GBP
  'united kingdom': 'GBP',
  uk: 'GBP',
  'great britain': 'GBP',
  england: 'GBP',
  scotland: 'GBP',
  wales: 'GBP',
  'northern ireland': 'GBP',

  // USD
  'united states': 'USD',
  usa: 'USD',
  america: 'USD',

  // EUR (eurozone)
  ireland: 'EUR',
  germany: 'EUR',
  france: 'EUR',
  netherlands: 'EUR',
  'the netherlands': 'EUR',
  holland: 'EUR',
  belgium: 'EUR',
  italy: 'EUR',
  spain: 'EUR',
  portugal: 'EUR',
  austria: 'EUR',
  finland: 'EUR',
  luxembourg: 'EUR',
  greece: 'EUR',
  malta: 'EUR',
  cyprus: 'EUR',
  estonia: 'EUR',
  latvia: 'EUR',
  lithuania: 'EUR',
  slovakia: 'EUR',
  slovenia: 'EUR',
  croatia: 'EUR',

  // AUD / NZD / CAD
  australia: 'AUD',
  'new zealand': 'NZD',
  canada: 'CAD',

  // CHF / SEK / NOK
  switzerland: 'CHF',
  sweden: 'SEK',
  norway: 'NOK',

  // JPY / CNY / HKD / SGD / KRW
  japan: 'JPY',
  china: 'CNY',
  'hong kong': 'HKD',
  singapore: 'SGD',
  'south korea': 'KRW',
  korea: 'KRW',

  // MXN
  mexico: 'MXN',
};

/**
 * Get the default currency for a country name. Returns `undefined` if no match
 * so callers can decide the fallback (typically USD).
 */
export function currencyForCountry(country: string | null | undefined): CurrencyCode | undefined {
  if (!country) return undefined;
  const key = country.toLowerCase().trim();
  // Own-property guard: bracket access would otherwise leak inherited members
  // (e.g. 'constructor', '__proto__') as a return value, violating the type.
  return Object.hasOwn(COUNTRY_CURRENCY, key) ? COUNTRY_CURRENCY[key] : undefined;
}
