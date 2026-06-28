/**
 * Sanitize user input to prevent XSS attacks
 * Strips HTML tags and normalizes whitespace, storing raw text.
 * Do NOT HTML-encode here — the render layer (Vue mustache) escapes on output.
 * Encoding here would double-escape and hide patterns from moderation/URL detection.
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove potential script injection patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Sanitize comment content
 * Strips HTML tags while preserving newlines/whitespace, storing raw text.
 * Comments render as plain text (whitespace-pre-wrap, NOT v-html), so do NOT
 * HTML-encode here — encoding produces inert, double-escaped output (e.g. "&lt;3").
 */
export function sanitizeCommentContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Limit length
  const maxLength = 2000;
  let sanitized = content.slice(0, maxLength);

  // Remove all HTML tags (newlines/whitespace preserved as-is)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script injection patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // Trim but preserve paragraph breaks
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validate and sanitize URL input
 */
/**
 * Private/internal IP patterns that should not be fetched server-side (SSRF prevention).
 */
const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0'];
const BLOCKED_IP_PREFIXES = ['127.', '10.', '192.168.', '169.254.'];
const BLOCKED_IPV6 = ['::1', '::'];

function isPrivateHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.includes(hostname)) return true;
  if (BLOCKED_IPV6.includes(hostname)) return true;
  if (BLOCKED_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) return true;
  // 172.16.0.0 – 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Block requests to private/internal networks (SSRF prevention)
    if (isPrivateHost(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
