/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  EXCHANGE_PREFIXES,
  EXCHANGE_FLAG_PREFIXES,
  pathInPrefixes,
} from '~~/app/utils/exchangeRoutes';

describe('EXCHANGE_PREFIXES', () => {
  it('is the canonical marketplace surface list', () => {
    expect(EXCHANGE_PREFIXES).toEqual([
      '/exchange',
      '/dashboard/listings',
      '/dashboard/wanted',
      '/dashboard/notifications',
      '/dashboard/saved-searches',
    ]);
  });

  it('contains no duplicate prefixes', () => {
    expect(new Set(EXCHANGE_PREFIXES).size).toBe(EXCHANGE_PREFIXES.length);
  });

  it('every prefix is absolute and has no trailing slash', () => {
    for (const prefix of EXCHANGE_PREFIXES) {
      expect(prefix.startsWith('/')).toBe(true);
      expect(prefix.endsWith('/')).toBe(false);
    }
  });
});

describe('EXCHANGE_FLAG_PREFIXES', () => {
  it('is EXCHANGE_PREFIXES plus the two flag-only routes', () => {
    expect(EXCHANGE_FLAG_PREFIXES).toEqual([
      '/exchange',
      '/dashboard/listings',
      '/dashboard/wanted',
      '/dashboard/notifications',
      '/dashboard/saved-searches',
      '/onboarding',
      '/admin/exchange',
    ]);
  });

  it('is a strict superset of EXCHANGE_PREFIXES', () => {
    for (const prefix of EXCHANGE_PREFIXES) {
      expect(EXCHANGE_FLAG_PREFIXES).toContain(prefix);
    }
    expect(EXCHANGE_FLAG_PREFIXES.length).toBe(EXCHANGE_PREFIXES.length + 2);
  });

  it('adds /onboarding (the gate target) and /admin/exchange (moderation) only', () => {
    const extras = EXCHANGE_FLAG_PREFIXES.filter((p) => !EXCHANGE_PREFIXES.includes(p));
    expect(extras).toEqual(['/onboarding', '/admin/exchange']);
  });

  it('does not mutate EXCHANGE_PREFIXES (spread copy, not reference)', () => {
    expect(EXCHANGE_FLAG_PREFIXES).not.toBe(EXCHANGE_PREFIXES);
    expect(EXCHANGE_PREFIXES).toHaveLength(5);
  });
});

describe('pathInPrefixes — exact-match (path === prefix)', () => {
  it.each(EXCHANGE_PREFIXES)('matches exact prefix %s against EXCHANGE_PREFIXES', (prefix) => {
    expect(pathInPrefixes(prefix, EXCHANGE_PREFIXES)).toBe(true);
  });

  it.each(EXCHANGE_FLAG_PREFIXES)(
    'matches exact prefix %s against EXCHANGE_FLAG_PREFIXES',
    (prefix) => {
      expect(pathInPrefixes(prefix, EXCHANGE_FLAG_PREFIXES)).toBe(true);
    }
  );
});

describe('pathInPrefixes — child paths (path under prefix)', () => {
  it.each([
    ['/exchange/listings', true],
    ['/exchange/listing/abc-123', true],
    ['/exchange/profile/settings', true],
    ['/dashboard/listings/new', true],
    ['/dashboard/listings/42/edit', true],
    ['/dashboard/wanted/create', true],
    ['/dashboard/notifications/unread', true],
    ['/dashboard/saved-searches/5', true],
  ])('treats %s as inside the exchange', (path, expected) => {
    expect(pathInPrefixes(path, EXCHANGE_PREFIXES)).toBe(expected);
  });

  it('matches deeply nested descendants', () => {
    expect(pathInPrefixes('/exchange/a/b/c/d/e/f', EXCHANGE_PREFIXES)).toBe(true);
  });
});

describe('pathInPrefixes — prefix boundary safety (the load-bearing invariant)', () => {
  // The startsWith check appends a "/" so a sibling route that merely shares
  // a string prefix must NOT match. This is the whole reason the helper exists.
  it.each([
    '/exchanger', // shares "/exchange" but is a different segment
    '/exchanges',
    '/exchange-rates',
    '/exchangeable',
    '/dashboard/listings-archive', // shares "/dashboard/listings"
    '/dashboard/listingsxyz',
    '/dashboard/wantedly',
    '/dashboard/notifications-settings',
    '/dashboard/saved-searches-export',
  ])('does NOT match sibling route %s', (path) => {
    expect(pathInPrefixes(path, EXCHANGE_PREFIXES)).toBe(false);
  });

  it('does not match the bare /dashboard parent', () => {
    expect(pathInPrefixes('/dashboard', EXCHANGE_PREFIXES)).toBe(false);
  });

  it('does not match an unrelated /dashboard tab', () => {
    expect(pathInPrefixes('/dashboard/models', EXCHANGE_PREFIXES)).toBe(false);
    expect(pathInPrefixes('/dashboard/purchases', EXCHANGE_PREFIXES)).toBe(false);
    expect(pathInPrefixes('/dashboard/gear-configs', EXCHANGE_PREFIXES)).toBe(false);
  });

  it('/onboarding and /admin/exchange only match under the FLAG list', () => {
    expect(pathInPrefixes('/onboarding', EXCHANGE_PREFIXES)).toBe(false);
    expect(pathInPrefixes('/admin/exchange', EXCHANGE_PREFIXES)).toBe(false);
    expect(pathInPrefixes('/onboarding', EXCHANGE_FLAG_PREFIXES)).toBe(true);
    expect(pathInPrefixes('/admin/exchange', EXCHANGE_FLAG_PREFIXES)).toBe(true);
    expect(pathInPrefixes('/admin/exchange/reports/3', EXCHANGE_FLAG_PREFIXES)).toBe(true);
  });

  it('does not match /onboarding sibling under FLAG list', () => {
    expect(pathInPrefixes('/onboarding-complete', EXCHANGE_FLAG_PREFIXES)).toBe(false);
    expect(pathInPrefixes('/admin/exchanger', EXCHANGE_FLAG_PREFIXES)).toBe(false);
  });
});

describe('pathInPrefixes — trailing slashes', () => {
  it('matches a prefix WITH a trailing slash (becomes a child path)', () => {
    expect(pathInPrefixes('/exchange/', EXCHANGE_PREFIXES)).toBe(true);
    expect(pathInPrefixes('/dashboard/listings/', EXCHANGE_PREFIXES)).toBe(true);
  });

  it('a child path with a trailing slash still matches', () => {
    expect(pathInPrefixes('/exchange/listings/', EXCHANGE_PREFIXES)).toBe(true);
  });
});

describe('pathInPrefixes — non-matching / unrelated routes', () => {
  it.each([
    '/',
    '/technical',
    '/technical/needles',
    '/archive/manuals',
    '/admin', // /admin/exchange is flag-only, bare /admin is not in either list
    '/about',
    '/membership',
    '/exchang', // truncated, not a prefix at all
    '/dashboard/', // bare dashboard with trailing slash
  ])('returns false for %s', (path) => {
    expect(pathInPrefixes(path, EXCHANGE_PREFIXES)).toBe(false);
  });
});

describe('pathInPrefixes — empty / edge inputs', () => {
  it('returns false when prefixes list is empty', () => {
    expect(pathInPrefixes('/exchange', [])).toBe(false);
    expect(pathInPrefixes('/exchange/listings', [])).toBe(false);
  });

  it('empty path matches an empty-string prefix exactly', () => {
    expect(pathInPrefixes('', [''])).toBe(true);
  });

  it('empty path does not match real exchange prefixes', () => {
    expect(pathInPrefixes('', EXCHANGE_PREFIXES)).toBe(false);
  });

  it('any path matches an empty-string prefix via the "/"-child branch', () => {
    // '' as a prefix: path === '' is false for '/foo', but startsWith('/') is true.
    expect(pathInPrefixes('/anything', [''])).toBe(true);
    // ...and a path with no leading slash does NOT match '' as a child.
    expect(pathInPrefixes('anything', [''])).toBe(false);
  });

  it('matches when the target prefix is present among several', () => {
    expect(pathInPrefixes('/exchange', ['/foo', '/bar', '/exchange'])).toBe(true);
  });

  it('returns false when no prefix in a multi-element list matches', () => {
    expect(pathInPrefixes('/baz', ['/foo', '/bar', '/exchange'])).toBe(false);
  });
});

describe('pathInPrefixes — case sensitivity & exotic input', () => {
  it('is case-sensitive (routes are lowercase)', () => {
    expect(pathInPrefixes('/Exchange', EXCHANGE_PREFIXES)).toBe(false);
    expect(pathInPrefixes('/EXCHANGE/listings', EXCHANGE_PREFIXES)).toBe(false);
  });

  it('handles query strings as part of the literal path (no parsing)', () => {
    // The helper does no URL parsing; "?" is just a character. "/exchange?tab=1"
    // is neither === "/exchange" nor startsWith("/exchange/"), so it is false.
    expect(pathInPrefixes('/exchange?tab=1', EXCHANGE_PREFIXES)).toBe(false);
    // A child route carrying a query string still matches via the "/" branch.
    expect(pathInPrefixes('/exchange/listings?sort=new', EXCHANGE_PREFIXES)).toBe(true);
  });

  it('handles a very long descendant path', () => {
    const longPath = '/exchange/' + 'a/'.repeat(5000) + 'end';
    expect(pathInPrefixes(longPath, EXCHANGE_PREFIXES)).toBe(true);
  });

  it('handles unicode segments under a prefix', () => {
    expect(pathInPrefixes('/exchange/品物/café', EXCHANGE_PREFIXES)).toBe(true);
    expect(pathInPrefixes('/exchangé', EXCHANGE_PREFIXES)).toBe(false);
  });
});
