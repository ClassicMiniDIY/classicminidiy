/**
 * sanitizeRedirectPath (app/utils/redirect.ts) — the single internal-path
 * validator behind /login?redirect=, the /auth/callback localStorage consume,
 * and /welcome?redirect=. Exercises the open-redirect attack shapes from the
 * PR #608 review (protocol-relative, backslash normalization, encoded
 * schemes, control characters).
 */
import { describe, it, expect } from 'vitest';
import { sanitizeRedirectPath } from '~/app/utils/redirect';

describe('sanitizeRedirectPath', () => {
  it('accepts plain internal paths', () => {
    expect(sanitizeRedirectPath('/')).toBe('/');
    expect(sanitizeRedirectPath('/admin')).toBe('/admin');
    expect(sanitizeRedirectPath('/membership?subscribe=1')).toBe('/membership?subscribe=1');
    expect(sanitizeRedirectPath('/archive/manuals#section-2')).toBe('/archive/manuals#section-2');
  });

  it('rejects non-string values (repeated query params arrive as arrays)', () => {
    expect(sanitizeRedirectPath(undefined)).toBeNull();
    expect(sanitizeRedirectPath(null)).toBeNull();
    expect(sanitizeRedirectPath(['/a', '//evil.com'])).toBeNull();
    expect(sanitizeRedirectPath(42)).toBeNull();
  });

  it('rejects absolute URLs and scheme-prefixed values', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBeNull();
    expect(sanitizeRedirectPath('http://evil.com/')).toBeNull();
    expect(sanitizeRedirectPath('javascript:alert(1)')).toBeNull();
    expect(sanitizeRedirectPath('mailto:a@evil.com')).toBeNull();
    expect(sanitizeRedirectPath('')).toBeNull();
    expect(sanitizeRedirectPath(' /evil.com')).toBeNull();
  });

  it('rejects protocol-relative //host shapes', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBeNull();
    expect(sanitizeRedirectPath('///evil.com')).toBeNull();
    expect(sanitizeRedirectPath('//evil.com/membership')).toBeNull();
  });

  it('rejects backslash variants that browsers normalize to forward slashes', () => {
    expect(sanitizeRedirectPath('/\\evil.com')).toBeNull();
    expect(sanitizeRedirectPath('/\\\\evil.com')).toBeNull();
    expect(sanitizeRedirectPath('\\/evil.com')).toBeNull();
    expect(sanitizeRedirectPath('/membership\\..\\evil')).toBeNull();
  });

  it('rejects control characters that URL parsers strip', () => {
    expect(sanitizeRedirectPath('/\tevil.com')).toBeNull();
    expect(sanitizeRedirectPath('/\n/evil.com')).toBeNull();
    expect(sanitizeRedirectPath('/membership\u0000')).toBeNull();
    expect(sanitizeRedirectPath('/\u007Fevil.com')).toBeNull();
  });

  it('keeps percent-encoded values inert but unmodified (single-decode happens upstream)', () => {
    // Once-decoded query values containing a literal backslash are rejected;
    // still-encoded sequences are just opaque path characters for the router.
    expect(sanitizeRedirectPath('/%5Cevil.com')).toBe('/%5Cevil.com');
    expect(sanitizeRedirectPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
  });
});
