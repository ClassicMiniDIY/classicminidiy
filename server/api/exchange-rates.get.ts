/**
 * USD-based exchange rates for the marketplace's multi-currency display.
 *
 * `useCurrency().fetchExchangeRates()` has always called `/api/exchange-rates`,
 * but the route never came across in the TME merge (the composable landed in
 * "Stage 3: port self-contained utility composables" without it). Every call
 * therefore fell through Nitro into the Vue app, matched the site-wide catch-all
 * `app/pages/[...slug].vue`, and threw its fatal "Archive document not found" —
 * which is why opening a listing produced a 500 with an archive error in it, and
 * why the page took seconds to resolve.
 *
 * Shape is fixed by the consumer: `{ rates }` keyed by currency code and
 * relative to USD, so `rates.USD === 1`. `convertCurrency()` returns null for
 * any code missing from that map and the UI falls back to the listing's own
 * currency — which is what makes the degraded response below safe.
 */

/** ECB reference rates via Frankfurter — no API key, no signup, no rate limit. */
const PROVIDER = 'https://api.frankfurter.dev/v1/latest';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface RatesPayload {
  rates: Record<string, number>;
  fetchedAt: string;
  degraded?: boolean;
}

/**
 * Cached by hand rather than with defineCachedEventHandler, for one reason:
 * that helper caches whatever the handler returns, including a degraded
 * response. One blip at the provider would then hide currency conversion for
 * every viewer for a full day. Only successful fetches are stored here.
 *
 * Per warm instance, like server/utils/rateLimit.ts — a few extra provider calls
 * across instances is nothing next to a day of wrong behaviour.
 */
let cached: { payload: RatesPayload; expiresAt: number } | null = null;
let inFlight: Promise<RatesPayload> | null = null;

async function loadRates(): Promise<RatesPayload> {
  // No `symbols` filter on purpose: fetching the provider's full set means there
  // is no currency list to keep in sync with SUPPORTED_CURRENCIES in
  // app/composables/useCurrency.ts. The client already ignores codes it doesn't
  // know, so adding one there needs no change here.
  const response = await $fetch<{ base: string; rates: Record<string, number> }>(PROVIDER, {
    query: { base: 'USD' },
    timeout: 5000,
    retry: 1,
  });

  // USD is the base, so the provider omits it. The consumer divides by
  // `rates[from]`, and a missing USD entry would make every conversion *out of*
  // USD return null — which is most of the marketplace.
  return { rates: { USD: 1, ...response.rates }, fetchedAt: new Date().toISOString() };
}

export default defineEventHandler(async (event): Promise<RatesPayload> => {
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    setHeader(event, 'cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return cached.payload;
  }

  // Collapse a thundering herd on a cold instance onto one provider call.
  if (!inFlight) {
    inFlight = loadRates()
      .then((payload) => {
        cached = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
        return payload;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  try {
    const payload = await inFlight;
    setHeader(event, 'cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return payload;
  } catch (error) {
    console.error('[exchange-rates] provider fetch failed:', (error as Error)?.message);

    // Serve stale before serving nothing — day-old FX beats no conversion.
    if (cached) {
      setHeader(event, 'cache-control', 'public, max-age=60');
      return { ...cached.payload, degraded: true };
    }

    // Deliberately NOT a thrown error and NOT an invented rate table. A 5xx here
    // would break every listing page that merely displays a price, and made-up
    // rates would show people wrong numbers. USD alone makes convertCurrency()
    // return null for other codes, so prices render in their original currency —
    // exactly what happens before the rates land on any cold page load.
    setHeader(event, 'cache-control', 'public, max-age=60');
    return { rates: { USD: 1 }, degraded: true, fetchedAt: new Date().toISOString() };
  }
});
