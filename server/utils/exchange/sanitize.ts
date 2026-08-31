/**
 * Apply removal patterns until the string stops changing.
 *
 * A single pass is not enough: removal can REASSEMBLE the very pattern it just
 * removed. `javajavascript:script:` survives one `.replace(/javascript:/gi)`
 * as `javascript:`, and `<scr<script>ipt>` survives one tag strip as
 * `<script>`. Looping to a fixpoint closes both.
 *
 * Bounded at 8 passes. Real input converges in one or two; the cap only stops a
 * pathological string from spinning, and stopping early can leave residue but
 * never hangs. Values from here are rendered as TEXT (see the note on each
 * function), so residue is inert — this is depth, not the only line of defence.
 */
function stripUntilStable(input: string, patterns: RegExp[]): string {
  let current = input;
  for (let pass = 0; pass < 8; pass++) {
    let next = current;
    for (const pattern of patterns) next = next.replace(pattern, '');
    if (next === current) return next;
    current = next;
  }
  return current;
}

/**
 * Anything that can carry script in a URL position. `javascript:` alone was the
 * old denylist, which let `data:text/html;base64,…` and `vbscript:` through.
 * `sanitizeUrl` below uses a protocol ALLOWLIST and is the right shape; these
 * text fields cannot, because they are prose that may legitimately contain a
 * colon, so the best available is a denylist of the schemes that execute.
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /<[^>]*>/g, // HTML tags
  /(?:javascript|vbscript|data)\s*:/gi, // executable URL schemes
  /on\w+\s*=/gi, // inline event handlers (onclick=, onerror=…)
];

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

  const sanitized = stripUntilStable(input, DANGEROUS_PATTERNS);

  // Normalize whitespace
  return sanitized.replace(/\s+/g, ' ').trim();
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

  // Strip markup and executable schemes (newlines/whitespace preserved as-is)
  sanitized = stripUntilStable(sanitized, DANGEROUS_PATTERNS);

  // Trim but preserve paragraph breaks
  return sanitized.trim();
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

export function isPrivateHost(hostname: string): boolean {
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
