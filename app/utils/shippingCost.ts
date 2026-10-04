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
