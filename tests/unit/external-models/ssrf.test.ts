/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { isBlockedAddress, ipv6ToBytes } from '~~/server/utils/external-models/ssrf';

describe('isBlockedAddress — IPv4', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1', // CGNAT
    '127.0.0.1',
    '169.254.169.254', // cloud metadata
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '198.18.0.5', // benchmarking
    '224.0.0.1', // multicast
    '255.255.255.255',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '172.15.0.1', // just below 172.16/12
    '172.32.0.1', // just above 172.16/12
    '100.63.255.255', // just below CGNAT
    '100.128.0.1', // just above CGNAT
    '169.253.0.1', // not link-local
  ])('allows %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe('isBlockedAddress — IPv6', () => {
  it.each([
    '::1', // loopback
    '::', // unspecified
    'fe80::1', // link-local
    'fc00::1', // ULA
    'fd12:3456:789a::1', // ULA
    'ff02::1', // multicast
    '::ffff:127.0.0.1', // v4-mapped loopback
    '::ffff:10.0.0.1', // v4-mapped private
    '64:ff9b::7f00:1', // NAT64 of 127.0.0.1
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '2606:4700:4700::1111', // Cloudflare
    '2001:4860:4860::8888', // Google
    '::ffff:8.8.8.8', // v4-mapped public
  ])('allows %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe('ipv6ToBytes', () => {
  it('expands loopback to 16 bytes', () => {
    expect(ipv6ToBytes('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
  it('maps an embedded IPv4', () => {
    expect(ipv6ToBytes('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 127, 0, 0, 1]);
  });
  it('returns null for malformed input', () => {
    expect(ipv6ToBytes('::ffff:999.0.0.1')).toBeNull();
  });
});

describe('isBlockedAddress — non-IP input is refused', () => {
  it('blocks a hostname (defensive default)', () => {
    expect(isBlockedAddress('example.com')).toBe(true);
  });
});
