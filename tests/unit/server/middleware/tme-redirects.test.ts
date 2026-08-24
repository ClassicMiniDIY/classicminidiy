/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  TME_EXACT,
  TME_PREFIX,
  resolveTmeRedirect,
  isTmeHost,
} from '~/server/utils/tmeRedirects';

/**
 * Table-driven coverage of the whole TME map.
 *
 * The point is exhaustiveness: every source is asserted in BOTH slash forms,
 * because Vercel's patterns are literal globs (`/about` does not match
 * `/about/`) and this app has prerendered assets at several of those slash
 * variants. A missed slash form serves a CMDIY page as a 200 on a
 * theminiexchange.com URL instead of redirecting.
 */
describe('TME map — every exact source, both slash forms', () => {
  for (const [source, destination] of TME_EXACT) {
    it(`${source} -> ${destination}`, () => {
      expect(resolveTmeRedirect(source)).toBe(destination);
    });
    if (source !== '/') {
      it(`${source}/ (trailing slash) -> ${destination}`, () => {
        expect(resolveTmeRedirect(source + '/')).toBe(destination);
      });
    }
  }
});

describe('TME map — every prefix source', () => {
  for (const [source, destination] of TME_PREFIX) {
    it(`${source} -> ${destination}`, () => {
      expect(resolveTmeRedirect(source)).toBe(destination);
    });
    it(`${source}/ -> ${destination}`, () => {
      expect(resolveTmeRedirect(source + '/')).toBe(destination);
    });
    it(`${source}/deeper/path is preserved`, () => {
      expect(resolveTmeRedirect(`${source}/deeper/path`)).toBe(`${destination}/deeper/path`);
    });
  }
});

describe('TME map — ordering and edge cases', () => {
  it('an exact source beats an overlapping prefix', () => {
    // vercel.json relies on array order for this; resolveTmeRedirect must not.
    expect(resolveTmeRedirect('/admin/users')).toBe('https://www.classicminidiy.com/admin/users');
    expect(resolveTmeRedirect('/admin/anything-else')).toBe(
      'https://www.classicminidiy.com/admin/exchange/anything-else'
    );
  });

  it('the root maps to /exchange', () => {
    expect(resolveTmeRedirect('/')).toBe('https://www.classicminidiy.com/exchange');
  });

  it('returns null for an unmapped path so it can 404 rather than soft-redirect', () => {
    // Production behaviour: theminiexchange.com/nope is a real 404. A catch-all
    // would turn the entire unmatched URL space into soft-200 redirects.
    expect(resolveTmeRedirect('/definitely-not-mapped')).toBeNull();
    expect(resolveTmeRedirect('/listingsnotaprefix')).toBeNull();
  });

  it('does not treat a longer word starting with a prefix as that prefix', () => {
    expect(resolveTmeRedirect('/profiles')).toBeNull();
    expect(resolveTmeRedirect('/users-list')).toBeNull();
  });

  it('every destination is an absolute classicminidiy.com URL', () => {
    for (const [, destination] of [...TME_EXACT, ...TME_PREFIX]) {
      expect(destination).toMatch(/^https:\/\/www\.classicminidiy\.com\//);
    }
  });

  it('has the full 28-rule map', () => {
    expect(TME_EXACT.length + TME_PREFIX.length).toBe(28);
  });
});

describe('isTmeHost', () => {
  it.each([
    ['theminiexchange.com', true],
    ['www.theminiexchange.com', true],
    ['THEMINIEXCHANGE.COM', true],
    ['theminiexchange.com:443', true],
    ['www.classicminidiy.com', false],
    ['classicminidiy.com', false],
    ['nottheminiexchange.com', false],
    [undefined, false],
  ])('%s -> %s', (host, want) => {
    expect(isTmeHost(host as string | undefined)).toBe(want);
  });
});
