/**
 * Sanitize user input to prevent XSS attacks
 * Strips HTML tags and encodes dangerous characters
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Encode special characters
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  sanitized = sanitized.replace(/[&<>"'\/]/g, (char) => htmlEntities[char] || char);

  // Remove potential script injection patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Sanitize comment content
 * Allows basic formatting but removes dangerous content
 */
export function sanitizeCommentContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Limit length
  const maxLength = 2000;
  let sanitized = content.slice(0, maxLength);

  // Remove HTML tags except basic formatting (newlines preserved)
  sanitized = sanitized.replace(/<(?!br\s*\/?)[^>]+>/gi, '');

  // Encode dangerous characters but preserve basic punctuation
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  // Remove script injection patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  sanitized = sanitized.replace(/<script/gi, '&lt;script');

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
