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
export interface SellerStatus {
  hasAccount: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  selling_disabled?: boolean;
}

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

  /**
   * Re-sync the seller's Stripe account onto seller_accounts and return the
   * fresh flags. This is the webhook-lag fallback: the selling page calls it so
   * a just-onboarded seller flips to enabled without waiting on the
   * account.updated webhook. Returns null on failure (caller keeps prior state).
   */
  async function refreshSellerStatus(): Promise<SellerStatus | null> {
    const headers = await authHeader();
    if (!headers.Authorization) return null;
    try {
      return await $fetch<SellerStatus>('/api/models/seller/status', { method: 'POST', headers });
    } catch {
      return null;
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

  /**
   * Download a model file. A plain <a href> can't authenticate (the Supabase
   * session is in localStorage, not a cookie), so fetch the route with the
   * Bearer header, get the short-lived presigned URL, and trigger the download
   * from JS. Returns an error message on failure, or null on success.
   */
  async function downloadFile(modelId: string, fileId: string): Promise<string | null> {
    const headers = await authHeader();
    if (!headers.Authorization) {
      await navigateTo('/login');
      return null;
    }
    try {
      const res = await $fetch<{ url?: string }>(`/api/models/${modelId}/files/${fileId}/download?json=1`, {
        headers,
      });
      if (!res?.url) return 'Could not start the download. Please try again.';
      // The presigned URL carries Content-Disposition: attachment, so a click on
      // a transient anchor downloads it without navigating away from the page.
      const a = document.createElement('a');
      a.href = res.url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return null;
    } catch (e: any) {
      return errMessage(e, 'Could not start the download. Please try again.');
    }
  }

  /**
   * Download every file as a single zip. There's no server-side bundling (zip
   * bombs / egress), so we fetch each entitlement-gated file in the browser and
   * zip them client-side with the lazily-imported client-zip. Each file still
   * goes through the gated download route (auth + entitlement + count); the
   * cross-origin S3 fetch that follows the 302 works because S3 CORS allows the
   * site origin (same path the 3D viewer uses).
   */
  async function downloadAll(
    modelId: string,
    files: { id: string; fileName: string }[],
    zipName: string
  ): Promise<string | null> {
    const headers = await authHeader();
    if (!headers.Authorization) {
      await navigateTo('/login');
      return null;
    }
    if (!files.length) return null;
    try {
      const { downloadZip } = await import('client-zip');
      const entries: { name: string; input: Blob }[] = [];
      for (const f of files) {
        const res = await fetch(`/api/models/${modelId}/files/${f.id}/download`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch ${f.fileName}`);
        entries.push({ name: f.fileName, input: await res.blob() });
      }
      const zipBlob = await downloadZip(entries).blob();
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return null;
    } catch (e: any) {
      return errMessage(e, 'Could not download all files. Try downloading them individually.');
    }
  }

  return { startCheckout, startSellerOnboarding, refreshSellerStatus, verifyPurchase, downloadFile, downloadAll };
}
