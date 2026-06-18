/**
 * Remembers the last listings browse URL (with filters + pagination)
 * so that when a user navigates from /listings → /listings/:slug → back,
 * they land on the exact page/filter state they were on — not page 1.
 *
 * Backed by sessionStorage (per-tab, wiped on tab close, never sent to
 * the server) so SSR and privacy aren't impacted.
 *
 * Usage:
 *   - In app/pages/exchange/listings/index.vue, watch route.fullPath and call
 *     rememberListingsReturnUrl(route.fullPath).
 *   - In app/pages/exchange/listings/[slug]/index.vue, read getListingsReturnUrl()
 *     for the href of a "Back to Listings" button.
 */

const STORAGE_KEY = 'tme:listings-return-url';
const DEFAULT_URL = '/listings';

export const useListingsReturnUrl = () => {
  const rememberListingsReturnUrl = (fullPath: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, fullPath);
    } catch {
      // sessionStorage can throw in private mode / quota issues — ignore
    }
  };

  const getListingsReturnUrl = (): string => {
    if (typeof window === 'undefined') return DEFAULT_URL;
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
    } catch {
      return DEFAULT_URL;
    }
  };

  const clearListingsReturnUrl = () => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return {
    rememberListingsReturnUrl,
    getListingsReturnUrl,
    clearListingsReturnUrl,
  };
};
