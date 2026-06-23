// Stripe types no longer needed - using direct checkout URL redirect

export type ListingTier = 'free' | 'paid';

export interface TierPricing {
  tier: ListingTier;
  price: number;
  name: string;
  features: string[];
  photoLimits: {
    vehiclePerSection: number;
    partsEngineTotal: number;
  };
}

export interface CheckoutSessionParams {
  listingId: string;
  tier: ListingTier;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentStatus {
  status: 'pending' | 'paid' | 'refunded';
  tier: ListingTier;
  amount: number;
  paymentReference?: string;
}

export const usePayments = () => {
  const config = useRuntimeConfig();
  const supabase = useSupabase();
  const { capture } = usePostHog();

  // Tier pricing configuration
  const tierPricing: Record<ListingTier, TierPricing> = {
    free: {
      tier: 'free',
      price: 0,
      name: 'Free',
      features: [
        'Fixed price listings only',
        'Vehicles: 5 photos per section',
        'Parts & Engines: 10 photos total',
        'Comment threads & Q&A',
        'Messaging system',
        'Watchlist & favorites',
        'Full listing details',
      ],
      photoLimits: {
        vehiclePerSection: 5,
        partsEngineTotal: 10,
      },
    },
    paid: {
      tier: 'paid',
      price: 1000, // $10.00 in cents
      name: 'Premium',
      features: [
        'Everything in Free tier',
        'Vehicles: 20 photos per section',
        'Parts & Engines: 15 photos total',
        'Featured placement for 30 days',
        'Priority in search results',
        'Homepage carousel exposure',
        'Featured badge on listing',
      ],
      photoLimits: {
        vehiclePerSection: 20,
        partsEngineTotal: 15,
      },
    },
  };

  /**
   * Get pricing information for a tier
   */
  const getTierPricing = (tier: ListingTier): TierPricing => {
    return tierPricing[tier];
  };

  /**
   * Get all tier pricing
   */
  const getAllTierPricing = (): TierPricing[] => {
    return Object.values(tierPricing);
  };

  /**
   * Create a checkout session for a premium listing.
   *
   * Returns `{ url }` for a normal Stripe checkout, or `{ comped: true }` when the
   * server granted the premium tier free of charge for a Sustaining Member
   * (Benefit #5). The caller must treat a missing `url` / `comped: true` as
   * "skip the Stripe redirect, go straight to confirmation."
   */
  const createCheckoutSession = async (
    params: CheckoutSessionParams
  ): Promise<{ url?: string; comped?: boolean; count?: number }> => {
    try {
      const tier = getTierPricing(params.tier);

      // Free tier doesn't need payment
      if (tier.price === 0) {
        throw new Error('Free tier does not require payment');
      }

      // Track checkout initiation
      capture('checkout_initiated', {
        listing_id: params.listingId,
        tier: 'paid',
        amount_cents: tier.price,
        currency: 'usd',
      });

      // The endpoint now authenticates the caller and verifies listing ownership,
      // so forward the Supabase access token (mirrors the bulk-checkout caller).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      // Call API to create checkout session
      const response = await $fetch<{ url?: string; comped?: boolean; count?: number }>(
        '/api/exchange/payments/checkout',
        {
          method: 'POST',
          body: {
            listingId: params.listingId,
            tier: params.tier,
            successUrl: params.successUrl || `${window.location.origin}/exchange/listings/payment/success`,
            cancelUrl: params.cancelUrl || `${window.location.origin}/exchange/listings/payment/cancel`,
          },
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        }
      );

      // A comped member listing returns no URL — that's success, not an error.
      if (!response.url && !response.comped) {
        throw new Error('No checkout URL returned from server');
      }

      return { url: response.url, comped: response.comped, count: response.count };
    } catch (error: any) {
      // Track checkout failure
      capture('checkout_failed', {
        listing_id: params.listingId,
        error_type: error.message || 'unknown',
      });

      console.error('Failed to create checkout session:', error);
      throw new Error(error.message || 'Failed to create checkout session');
    }
  };

  /**
   * Verify a completed checkout on the success page. Server-authoritative:
   * proxies to verify-listing-payment (which marks the listing(s) paid via the
   * service role only if Stripe confirms the session is paid). This replaces the
   * legacy client-side updateListingTier write — the client can no longer flip a
   * listing to paid without a verified Stripe session.
   */
  const verifyPayment = async (
    sessionId: string
  ): Promise<{ verified: boolean; listingIds?: string[]; paymentStatus?: string }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authToken = session?.access_token;
    return await $fetch('/api/exchange/payments/verify', {
      method: 'POST',
      body: { sessionId },
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  };

  /**
   * Get payment status for a listing
   */
  const getPaymentStatus = async (listingId: string): Promise<PaymentStatus | null> => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('tier, paid_amount, payment_status, payment_reference')
        .eq('id', listingId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        status: data.payment_status as 'pending' | 'paid' | 'refunded',
        tier: data.tier as ListingTier,
        amount: data.paid_amount || 0,
        paymentReference: data.payment_reference,
      };
    } catch (error: any) {
      console.error('Failed to get payment status:', error);
      return null;
    }
  };

  /**
   * Update listing tier after successful payment
   */
  const updateListingTier = async (
    listingId: string,
    tier: ListingTier,
    paymentDetails: {
      amount: number;
      paymentReference: string;
      paymentMethod?: string;
    }
  ): Promise<void> => {
    try {
      const pricing = getTierPricing(tier);

      // Calculate featured_until for paid tier (30 days from now)
      const featuredUntil = tier === 'paid' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

      // Update listing
      const { error: listingError } = await supabase
        .from('listings')
        .update({
          tier,
          paid_amount: paymentDetails.amount,
          payment_status: 'paid',
          featured_until: featuredUntil,
        })
        .eq('id', listingId);

      if (listingError) throw listingError;

      // Record promotion
      const { error: promoError } = await supabase.from('listing_promotions').insert({
        listing_id: listingId,
        tier,
        amount_paid: paymentDetails.amount,
        payment_method: paymentDetails.paymentMethod,
        payment_reference: paymentDetails.paymentReference,
        features: {
          ...pricing.features,
          featuredUntil,
        },
      });

      if (promoError) throw promoError;
    } catch (error: any) {
      console.error('Failed to update listing tier:', error);
      throw new Error(error.message || 'Failed to update listing tier');
    }
  };

  /**
   * Format price for display
   */
  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return {
    tierPricing,
    getTierPricing,
    getAllTierPricing,
    createCheckoutSession,
    verifyPayment,
    getPaymentStatus,
    updateListingTier,
    formatPrice,
  };
};
