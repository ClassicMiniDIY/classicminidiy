/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { detectFindSourceSite } from '~~/data/models/find-sources';

describe('detectFindSourceSite', () => {
  it('matches the registered domains exactly', () => {
    expect(detectFindSourceSite('https://bringatrailer.com/listing/1959-mini')).toBe('bat');
    expect(detectFindSourceSite('https://carsandbids.com/auctions/abc')).toBe('carsandbids');
    expect(detectFindSourceSite('https://copart.com/lot/123')).toBe('copart');
    expect(detectFindSourceSite('https://craigslist.org/x')).toBe('craigslist');
    expect(detectFindSourceSite('https://facebook.com/marketplace/item/1')).toBe('facebook');
    expect(detectFindSourceSite('https://ebay.com/itm/1')).toBe('ebay');
    expect(detectFindSourceSite('https://ebay.co.uk/itm/1')).toBe('ebay');
  });

  it('matches real subdomains these sites actually use', () => {
    expect(detectFindSourceSite('https://www.ebay.com/itm/1')).toBe('ebay');
    expect(detectFindSourceSite('https://m.facebook.com/marketplace/item/1')).toBe('facebook');
    expect(detectFindSourceSite('https://sfbay.craigslist.org/cto/d/mini/123.html')).toBe('craigslist');
    expect(detectFindSourceSite('https://www.bringatrailer.com/listing/x')).toBe('bat');
  });

  // The bug this module was extracted for. `hostname.includes('ebay.com')`
  // matched anywhere in the host, and find URLs are user-submitted — so a
  // listing on an unrelated domain was badged as coming from eBay.
  it('does NOT match a registered domain appearing as a suffix of another host', () => {
    expect(detectFindSourceSite('https://ebay.com.example.net/itm/1')).toBe('other');
    expect(detectFindSourceSite('https://notebay.com/itm/1')).toBe('other');
    expect(detectFindSourceSite('https://fake-ebay.com.attacker.tld/x')).toBe('other');
    expect(detectFindSourceSite('https://facebook.com.phish.example/x')).toBe('other');
    expect(detectFindSourceSite('https://mycraigslist.org/x')).toBe('other');
  });

  it('is case-insensitive on the hostname', () => {
    expect(detectFindSourceSite('https://WWW.EBAY.COM/itm/1')).toBe('ebay');
  });

  it('returns other for unrecognised hosts and unparseable input', () => {
    expect(detectFindSourceSite('https://example.com/x')).toBe('other');
    expect(detectFindSourceSite('not a url')).toBe('other');
    expect(detectFindSourceSite('')).toBe('other');
  });

  // Deliberate asymmetry: the DB CHECK may reject 'copart', and the insert path
  // in useExternalListings retries as 'other' on a 23514. Detection still
  // reports it so the badge is right for a site we do recognise.
  it('still reports copart, which the insert path downgrades separately', () => {
    expect(detectFindSourceSite('https://www.copart.com/lot/999')).toBe('copart');
  });
});
