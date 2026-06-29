import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { cleanupGlobalMocks } from '../../../setup/testHelpers';
import type { ListingTier, TierPricing, PaymentStatus } from '~/app/composables/usePayments';

// ---------------------------------------------------------------------------
// The CMDIY usePayments composable depends on:
//   useRuntimeConfig (vitest.setup stub), useSupabase, usePostHog, and the
//   global $fetch. vitest.setup globally stubs $fetch/useRuntimeConfig/usePostHog,
//   but we need a controllable `capture` handle (to assert checkout_initiated /
//   checkout_failed tracking) and a controllable Supabase client, so we stub
//   those explicitly here — matching the sibling exchange composable tests.
//
// Endpoints (CMDIY-consolidated, differ from TME):
//   checkout -> POST /api/exchange/payments/checkout
//   verify   -> POST /api/exchange/payments/verify
// Paid tier price is 1000 ($10.00) and named "Premium".
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockCapture: ReturnType<typeof vi.fn>;

// Listing row shape returned by getPaymentStatus' single() query.
const mockListingPayment = {
  tier: 'paid',
  paid_amount: 1500,
  payment_status: 'paid',
  payment_reference: 'pi_123456',
};

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockCapture = vi.fn();

  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));

  // Fresh $fetch per test (vitest.setup installs a global vi.fn we reset here).
  vi.stubGlobal('$fetch', vi.fn());

  // window.location.origin drives the default success/cancel URLs.
  Object.defineProperty(window, 'location', {
    value: { origin: 'http://localhost:3000', href: 'http://localhost:3000' },
    writable: true,
  });

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.clearAllMocks();
});

const importUsePayments = async () => {
  const { usePayments } = await import('~/app/composables/usePayments');
  return usePayments;
};

describe('usePayments', () => {
  // -------------------------------------------------------------------------
  // tierPricing (static config)
  // -------------------------------------------------------------------------
  describe('tierPricing', () => {
    it('has correct config for the free tier', async () => {
      const usePayments = await importUsePayments();
      const { tierPricing } = usePayments();

      expect(tierPricing.free.tier).toBe('free');
      expect(tierPricing.free.price).toBe(0);
      expect(tierPricing.free.name).toBe('Free');
      expect(Array.isArray(tierPricing.free.features)).toBe(true);
      expect(tierPricing.free.photoLimits).toEqual({ vehiclePerSection: 5, partsEngineTotal: 10 });
    });

    it('has correct config for the paid tier', async () => {
      const usePayments = await importUsePayments();
      const { tierPricing } = usePayments();

      expect(tierPricing.paid.tier).toBe('paid');
      expect(tierPricing.paid.price).toBe(1000); // $10.00 in cents
      expect(tierPricing.paid.name).toBe('Premium');
      expect(Array.isArray(tierPricing.paid.features)).toBe(true);
      expect(tierPricing.paid.photoLimits).toEqual({ vehiclePerSection: 20, partsEngineTotal: 15 });
    });

    it('exposes exactly the free and paid tiers (no legacy deluxe tier)', async () => {
      const usePayments = await importUsePayments();
      const { tierPricing } = usePayments();

      expect(Object.keys(tierPricing).sort()).toEqual(['free', 'paid']);
    });
  });

  // -------------------------------------------------------------------------
  // getTierPricing()
  // -------------------------------------------------------------------------
  describe('getTierPricing()', () => {
    it('returns the free tier pricing object', async () => {
      const usePayments = await importUsePayments();
      const { getTierPricing } = usePayments();

      const pricing: TierPricing = getTierPricing('free');
      expect(pricing.tier).toBe('free');
      expect(pricing.price).toBe(0);
      expect(pricing.name).toBe('Free');
    });

    it('returns the paid tier pricing object', async () => {
      const usePayments = await importUsePayments();
      const { getTierPricing } = usePayments();

      const pricing = getTierPricing('paid');
      expect(pricing.tier).toBe('paid');
      expect(pricing.price).toBe(1000);
      expect(pricing.name).toBe('Premium');
    });
  });

  // -------------------------------------------------------------------------
  // getAllTierPricing()
  // -------------------------------------------------------------------------
  describe('getAllTierPricing()', () => {
    it('returns an array of both tiers in declaration order', async () => {
      const usePayments = await importUsePayments();
      const { getAllTierPricing } = usePayments();

      const all = getAllTierPricing();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.tier)).toEqual(['free', 'paid']);
    });

    it('each pricing object carries the required shape', async () => {
      const usePayments = await importUsePayments();
      const { getAllTierPricing } = usePayments();

      getAllTierPricing().forEach((pricing) => {
        expect(pricing).toHaveProperty('tier');
        expect(pricing).toHaveProperty('price');
        expect(pricing).toHaveProperty('name');
        expect(pricing).toHaveProperty('features');
        expect(pricing).toHaveProperty('photoLimits');
        expect(Array.isArray(pricing.features)).toBe(true);
      });
    });
  });

  // -------------------------------------------------------------------------
  // createCheckoutSession()
  // -------------------------------------------------------------------------
  describe('createCheckoutSession()', () => {
    it('POSTs to the exchange checkout endpoint with the Bearer token and returns the URL', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/test-session';
      ($fetch as any).mockResolvedValueOnce({ url: checkoutUrl });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      const result = await createCheckoutSession({ listingId: 'listing-1', tier: 'paid' });

      expect($fetch).toHaveBeenCalledWith('/api/exchange/payments/checkout', {
        method: 'POST',
        body: {
          listingId: 'listing-1',
          tier: 'paid',
          successUrl: 'http://localhost:3000/exchange/listings/payment/success',
          cancelUrl: 'http://localhost:3000/exchange/listings/payment/cancel',
        },
        headers: { Authorization: 'Bearer mock-access-token' },
      });

      expect(result.url).toBe(checkoutUrl);
      expect(result.comped).toBeUndefined();
    });

    it('tracks checkout_initiated with the paid tier price before calling the API', async () => {
      ($fetch as any).mockResolvedValueOnce({ url: 'https://checkout.stripe.com/x' });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await createCheckoutSession({ listingId: 'listing-1', tier: 'paid' });

      expect(mockCapture).toHaveBeenCalledWith('checkout_initiated', {
        listing_id: 'listing-1',
        tier: 'paid',
        amount_cents: 1000,
        currency: 'usd',
      });
    });

    it('uses custom success and cancel URLs when provided', async () => {
      ($fetch as any).mockResolvedValueOnce({ url: 'https://checkout.stripe.com/x' });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await createCheckoutSession({
        listingId: 'listing-1',
        tier: 'paid',
        successUrl: 'http://example.com/success',
        cancelUrl: 'http://example.com/cancel',
      });

      expect($fetch).toHaveBeenCalledWith('/api/exchange/payments/checkout', {
        method: 'POST',
        body: {
          listingId: 'listing-1',
          tier: 'paid',
          successUrl: 'http://example.com/success',
          cancelUrl: 'http://example.com/cancel',
        },
        headers: { Authorization: 'Bearer mock-access-token' },
      });
    });

    it('sends empty headers (no Authorization) for an anonymous caller without a session', async () => {
      // No session -> no access token -> headers must be {} (not { Authorization: undefined }).
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      ($fetch as any).mockResolvedValueOnce({ url: 'https://checkout.stripe.com/x' });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await createCheckoutSession({ listingId: 'listing-1', tier: 'paid' });

      const callArgs = ($fetch as any).mock.calls[0][1];
      expect(callArgs.headers).toEqual({});
    });

    it('returns the comp sentinel (comped, no URL) when the server comps a member listing', async () => {
      // Benefit #5: a Sustaining Member gets the premium tier free. The server
      // returns { comped: true } with no url — that is success, not an error.
      ($fetch as any).mockResolvedValueOnce({ comped: true });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      const result = await createCheckoutSession({ listingId: 'listing-1', tier: 'paid' });

      expect(result.comped).toBe(true);
      expect(result.url).toBeUndefined();
    });

    it('returns comped with count for a bulk member comp', async () => {
      ($fetch as any).mockResolvedValueOnce({ comped: true, count: 3 });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      const result = await createCheckoutSession({ listingId: 'listing-1', tier: 'paid' });

      expect(result.comped).toBe(true);
      expect(result.count).toBe(3);
    });

    it('throws for the free tier before any API call', async () => {
      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await expect(createCheckoutSession({ listingId: 'listing-1', tier: 'free' })).rejects.toThrow(
        'Free tier does not require payment'
      );
      expect($fetch).not.toHaveBeenCalled();
    });

    it('throws when the server returns neither a url nor a comp', async () => {
      ($fetch as any).mockResolvedValueOnce({ url: null });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await expect(createCheckoutSession({ listingId: 'listing-1', tier: 'paid' })).rejects.toThrow(
        'No checkout URL returned from server'
      );
    });

    it('tracks checkout_failed and rethrows when the API call fails', async () => {
      const apiError = new Error('API Error');
      ($fetch as any).mockRejectedValueOnce(apiError);

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await expect(createCheckoutSession({ listingId: 'listing-1', tier: 'paid' })).rejects.toThrow('API Error');

      expect(mockCapture).toHaveBeenCalledWith('checkout_failed', {
        listing_id: 'listing-1',
        error_type: 'API Error',
      });
      expect(console.error).toHaveBeenCalledWith('Failed to create checkout session:', apiError);
    });

    it('preserves the error message when the rejection has a message property', async () => {
      ($fetch as any).mockRejectedValueOnce({ message: 'Custom error message' });

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await expect(createCheckoutSession({ listingId: 'listing-1', tier: 'paid' })).rejects.toThrow(
        'Custom error message'
      );
    });

    it('falls back to a generic message when the rejection has no message', async () => {
      ($fetch as any).mockRejectedValueOnce({});

      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      await expect(createCheckoutSession({ listingId: 'listing-1', tier: 'paid' })).rejects.toThrow(
        'Failed to create checkout session'
      );

      // checkout_failed uses 'unknown' as the error_type when no message exists.
      expect(mockCapture).toHaveBeenCalledWith('checkout_failed', {
        listing_id: 'listing-1',
        error_type: 'unknown',
      });
    });

    it('returns a Promise (is async)', async () => {
      ($fetch as any).mockResolvedValueOnce({ url: 'https://x' });
      const usePayments = await importUsePayments();
      const { createCheckoutSession } = usePayments();

      const p = createCheckoutSession({ listingId: 'listing-1', tier: 'paid' });
      expect(p).toBeInstanceOf(Promise);
      await p;
    });
  });

  // -------------------------------------------------------------------------
  // verifyPayment() — server-authoritative success-page verification.
  // -------------------------------------------------------------------------
  describe('verifyPayment()', () => {
    it('POSTs the sessionId to the verify endpoint with the Bearer token and returns the server result', async () => {
      const serverResult = { verified: true, listingIds: ['listing-1'], paymentStatus: 'paid' };
      ($fetch as any).mockResolvedValueOnce(serverResult);

      const usePayments = await importUsePayments();
      const { verifyPayment } = usePayments();

      const result = await verifyPayment('cs_test_123');

      expect($fetch).toHaveBeenCalledWith('/api/exchange/payments/verify', {
        method: 'POST',
        body: { sessionId: 'cs_test_123' },
        headers: { Authorization: 'Bearer mock-access-token' },
      });
      expect(result).toEqual(serverResult);
    });

    it('sends empty headers for an anonymous caller without a session', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      ($fetch as any).mockResolvedValueOnce({ verified: false });

      const usePayments = await importUsePayments();
      const { verifyPayment } = usePayments();

      await verifyPayment('cs_test_123');

      const callArgs = ($fetch as any).mock.calls[0][1];
      expect(callArgs.headers).toEqual({});
    });

    it('returns an unverified result verbatim from the server', async () => {
      ($fetch as any).mockResolvedValueOnce({ verified: false });

      const usePayments = await importUsePayments();
      const { verifyPayment } = usePayments();

      const result = await verifyPayment('cs_unpaid');
      expect(result).toEqual({ verified: false });
    });

    it('propagates server errors (no swallow)', async () => {
      // verifyPayment has no try/catch — a rejected $fetch surfaces to the caller.
      ($fetch as any).mockRejectedValueOnce(new Error('verify boom'));

      const usePayments = await importUsePayments();
      const { verifyPayment } = usePayments();

      await expect(verifyPayment('cs_test_123')).rejects.toThrow('verify boom');
    });
  });

  // -------------------------------------------------------------------------
  // getPaymentStatus()
  // -------------------------------------------------------------------------
  describe('getPaymentStatus()', () => {
    it('queries the listings table by id with single() and maps the row', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockListingPayment, error: null });

      const usePayments = await importUsePayments();
      const { getPaymentStatus } = usePayments();

      const status = await getPaymentStatus('listing-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('listings');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('tier, paid_amount, payment_status, payment_reference');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'listing-1');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(status).toEqual<PaymentStatus>({
        status: 'paid',
        tier: 'paid',
        amount: 1500,
        paymentReference: 'pi_123456',
      });
    });

    it('returns null when no row is found', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const usePayments = await importUsePayments();
      const { getPaymentStatus } = usePayments();

      const status = await getPaymentStatus('non-existent');
      expect(status).toBeNull();
    });

    it('returns null and logs when Supabase returns an error', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

      const usePayments = await importUsePayments();
      const { getPaymentStatus } = usePayments();

      const status = await getPaymentStatus('listing-1');
      expect(status).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Failed to get payment status:', expect.any(Object));
    });

    it('defaults amount to 0 when paid_amount is null', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({
        data: { tier: 'free', paid_amount: null, payment_status: 'pending', payment_reference: null },
        error: null,
      });

      const usePayments = await importUsePayments();
      const { getPaymentStatus } = usePayments();

      const status = await getPaymentStatus('listing-1');
      expect(status?.amount).toBe(0);
      expect(status?.status).toBe('pending');
      expect(status?.tier).toBe('free');
    });

    it('returns null and logs when the query throws', async () => {
      mockSupabase._mockSingle.mockRejectedValueOnce(new Error('Network error'));

      const usePayments = await importUsePayments();
      const { getPaymentStatus } = usePayments();

      const status = await getPaymentStatus('listing-1');
      expect(status).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('returns a Promise (is async)', async () => {
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: null });
      const usePayments = await importUsePayments();
      const { getPaymentStatus } = usePayments();

      const p = getPaymentStatus('listing-1');
      expect(p).toBeInstanceOf(Promise);
      await p;
    });
  });

  // -------------------------------------------------------------------------
  // formatPrice()
  // -------------------------------------------------------------------------
  describe('formatPrice()', () => {
    it('formats cents to a USD currency string', async () => {
      const usePayments = await importUsePayments();
      const { formatPrice } = usePayments();
      expect(formatPrice(500)).toBe('$5.00');
    });

    it('formats the paid tier price (1000c -> $10.00)', async () => {
      const usePayments = await importUsePayments();
      const { formatPrice } = usePayments();
      expect(formatPrice(1000)).toBe('$10.00');
    });

    it('formats zero', async () => {
      const usePayments = await importUsePayments();
      const { formatPrice } = usePayments();
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('formats sub-dollar cents', async () => {
      const usePayments = await importUsePayments();
      const { formatPrice } = usePayments();
      expect(formatPrice(1099)).toBe('$10.99');
    });

    it('adds thousands separators for large amounts', async () => {
      const usePayments = await importUsePayments();
      const { formatPrice } = usePayments();
      expect(formatPrice(100000)).toBe('$1,000.00');
    });
  });

  // -------------------------------------------------------------------------
  // return value structure
  // -------------------------------------------------------------------------
  describe('return value structure', () => {
    it('exposes the full public API', async () => {
      const usePayments = await importUsePayments();
      const api = usePayments();

      expect(api).toHaveProperty('tierPricing');
      expect(typeof api.getTierPricing).toBe('function');
      expect(typeof api.getAllTierPricing).toBe('function');
      expect(typeof api.createCheckoutSession).toBe('function');
      expect(typeof api.verifyPayment).toBe('function');
      expect(typeof api.getPaymentStatus).toBe('function');
      expect(typeof api.formatPrice).toBe('function');
    });

    it('does not expose the legacy client-side updateListingTier writer', async () => {
      // The legacy direct write was replaced by the server-authoritative
      // verifyPayment flow; the client can no longer flip a listing to paid.
      const usePayments = await importUsePayments();
      const api = usePayments();
      expect(api).not.toHaveProperty('updateListingTier');
    });
  });
});
