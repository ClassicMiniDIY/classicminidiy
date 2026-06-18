/**
 * Allowed domains for message link moderation.
 *
 * Links to these shipping carriers (and their subdomains) are NOT flagged
 * as "off-platform" URLs in chat messages, so sellers can share tracking
 * numbers without triggering a safety warning.
 *
 * Matching is done via URL parsing and exact-or-subdomain hostname match,
 * NOT substring match, to prevent bypasses like `usps.com.evil.com`.
 */

export const SHIPPING_CARRIER_DOMAINS = [
  'usps.com',
  'ups.com',
  'fedex.com',
  'dhl.com',
  'canadapost.ca',
  'royalmail.com',
  'parcelforce.com',
  'auspost.com.au',
  'purolator.com',
] as const;

/**
 * Normalize a URL-like string into a URL object.
 * Handles bare `www.foo.com` inputs by prepending a protocol.
 * Returns null if the string cannot be parsed.
 */
function parseUrl(raw: string): URL | null {
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

/**
 * Returns true if the given URL/host matches an allowed shipping carrier
 * domain exactly or as a subdomain.
 *
 * Examples:
 *   isAllowedDomain('https://usps.com/track')          → true
 *   isAllowedDomain('https://tools.usps.com/x')        → true
 *   isAllowedDomain('www.fedex.com/fedextrack/')       → true
 *   isAllowedDomain('https://usps.com.evil.com')       → false
 *   isAllowedDomain('https://not-usps.com')            → false
 */
export function isAllowedDomain(urlOrHost: string): boolean {
  const parsed = parseUrl(urlOrHost.trim());
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return SHIPPING_CARRIER_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

/**
 * Extracts all http(s):// and www. URLs from a block of text.
 * Used by both client- and server-side moderation to decide which URLs
 * (if any) need to be flagged after filtering out the allowlist.
 */
export function extractUrls(content: string): string[] {
  const pattern = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
  return content.match(pattern) ?? [];
}

/**
 * Returns true if the message contains at least one URL AND at least one
 * of those URLs is NOT on the allowlist. Allowlist-only messages return false.
 */
export function hasDisallowedUrl(content: string): boolean {
  const urls = extractUrls(content);
  if (urls.length === 0) return false;
  return urls.some((url) => !isAllowedDomain(url));
}
