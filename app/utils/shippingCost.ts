import { SUPPORTED_CURRENCIES } from '~/composables/useCurrency';

/**
 * Shipping cost as stored on `listings.shipping_cost`:
 *
 * - `0` is free shipping. The detail page shows its "Free shipping" badge
 *   only for 0, and the /exchange/listings "Free shipping" filter matches only 0.
 * - `null` means the cost varies by location (the seller quotes it).
 * - A positive number is a flat domestic cost.
 *
 * Form inputs bound with `v-model.number` hand back `''` for an empty field,
 * and a `|| null` turns a real 0 into "varies". Pass every value through
 * this before it is stored.
 */
export function normalizeShippingCost(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * A shipping amount in the listing's currency, with cents when it has them.
 * Not useCurrency().formatCurrency: that rounds to whole units for prices, so
 * a 12.50 shipping cost would read as 13. Callers word 0 ("Free") and null
 * ("Varies") themselves.
 */
export function formatShippingAmount(amount: number, currencyCode: string | null | undefined): string {
  const code = currencyCode || 'USD';
  const currency = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  try {
    return new Intl.NumberFormat(currency?.locale || 'en-US', {
      style: 'currency',
      currency: code,
      // 15 -> "$15", 12.5 -> "$12.50"
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency?.symbol || code}${amount}`;
  }
}
