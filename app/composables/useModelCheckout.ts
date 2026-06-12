/**
 * Client helpers for the 3D Model Library marketplace (keystone §6).
 *
 * All three actions forward the caller's Supabase access token (session lives in
 * localStorage, so /api routes need an explicit Bearer header) to thin web
 * proxies, which in turn call the Stripe edge functions. Redirect URLs are built
 * from the browser's real origin so dev returns to localhost and prod to
 * classicminidiy.com — the edge functions validate the origin against their
 * allowlist either way.
 */
export function useModelCheckout() {
  const supabase = useSupabase();

  async function authHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }

  function errMessage(e: any, fallback: string): string {
    return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || fallback;
  }

  /**
   * Start a purchase or tip checkout. On success the browser is redirected to
   * Stripe (returns null); on failure returns a human error message.
   */
  async function startCheckout(
    modelId: string,
    kind: 'purchase' | 'tip',
    amountCents?: number
  ): Promise<string | null> {
    const headers = await authHeader();
    if (!headers.Authorization) return 'Please sign in to continue.';

    const base = `${window.location.origin}${window.location.pathname}`;
    try {
      const res = await $fetch<{ url?: string }>(`/api/models/${modelId}/checkout`, {
        method: 'POST',
        headers,
        body: {
          kind,
          ...(amountCents != null ? { amountCents } : {}),
          successUrl: `${base}?purchase=success`,
          cancelUrl: `${base}?purchase=cancelled`,
        },
      });
      if (res?.url) {
        window.location.href = res.url;
        return null;
      }
      return 'Could not start checkout. Please try again.';
    } catch (e: any) {
      return errMessage(e, 'Could not start checkout. Please try again.');
    }
  }

  /** Start (or resume) Stripe Connect seller onboarding. Redirects on success. */
  async function startSellerOnboarding(): Promise<string | null> {
    const headers = await authHeader();
    if (!headers.Authorization) return 'Please sign in to continue.';

    const origin = window.location.origin;
    try {
      const res = await $fetch<{ url?: string }>('/api/models/seller/onboard', {
        method: 'POST',
        headers,
        body: {
          returnUrl: `${origin}/dashboard/selling?onboarded=1`,
          refreshUrl: `${origin}/dashboard/selling?refresh=1`,
        },
      });
      if (res?.url) {
        window.location.href = res.url;
        return null;
      }
      return 'Could not start onboarding. Please try again.';
    } catch (e: any) {
      return errMessage(e, 'Could not start onboarding. Please try again.');
    }
  }

  /** Webhook-lag fallback called on the success page. */
  async function verifyPurchase(
    modelId: string,
    sessionId: string
  ): Promise<{ verified: boolean; kind?: 'purchase' | 'tip'; recorded?: boolean; paymentStatus?: string }> {
    const headers = await authHeader();
    if (!headers.Authorization) return { verified: false };
    try {
      return await $fetch(`/api/models/${modelId}/verify-purchase`, {
        method: 'POST',
        headers,
        body: { sessionId },
      });
    } catch {
      return { verified: false };
    }
  }

  return { startCheckout, startSellerOnboarding, verifyPurchase };
}
