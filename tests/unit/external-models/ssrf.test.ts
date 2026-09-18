/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  isBlockedAddress,
  ipv6ToBytes,
  resolveHost,
  assertPublicUrl,
  SsrfError,
} from '~~/server/utils/external-models/ssrf';

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

/**
 * A fake DoH endpoint. `answers` is keyed by query type and holds the raw
 * Answer array Cloudflare would return, so a test can hand back the same
 * CNAME-then-A chain a real resolver does.
 */
type Answer = { name: string; type: number; data: string };
function dohFetch(answers: Partial<Record<'A' | 'AAAA', Answer[]>>, status = 0, httpOk = true): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    expect(url.origin + url.pathname).toBe('https://cloudflare-dns.com/dns-query');
    const type = url.searchParams.get('type') as 'A' | 'AAAA';
    const body = { Status: status, Answer: answers[type] };
    return new Response(JSON.stringify(body), { status: httpOk ? 200 : 502 });
  }) as typeof fetch;
}

const FACEBOOK_CHAIN: Answer[] = [
  { name: 'www.facebook.com', type: 5, data: 'star-mini.c10r.facebook.com.' },
  { name: 'star-mini.c10r.facebook.com', type: 1, data: '57.144.252.1' },
];
const FACEBOOK_CHAIN_V6: Answer[] = [
  { name: 'www.facebook.com', type: 5, data: 'star-mini.c10r.facebook.com.' },
  { name: 'star-mini.c10r.facebook.com', type: 28, data: '2a03:2880:f37e:1:face:b00c:0:25de' },
];

describe('resolveHost — DoH, A + AAAA only', () => {
  it('drops CNAME records from the answer chain and keeps the IPs', async () => {
    const addresses = await resolveHost('www.facebook.com', dohFetch({ A: FACEBOOK_CHAIN, AAAA: FACEBOOK_CHAIN_V6 }));
    expect(addresses).toEqual(['57.144.252.1', '2a03:2880:f37e:1:face:b00c:0:25de']);
  });

  it('returns bare A records when there is no AAAA', async () => {
    const addresses = await resolveHost(
      'bringatrailer.com',
      dohFetch({ A: [{ name: 'bringatrailer.com', type: 1, data: '192.0.66.40' }] })
    );
    expect(addresses).toEqual(['192.0.66.40']);
  });

  it('fails closed on NXDOMAIN (no records)', async () => {
    await expect(resolveHost('nope.invalid', dohFetch({}, 3))).rejects.toBeInstanceOf(SsrfError);
  });

  it('fails closed on SERVFAIL', async () => {
    await expect(resolveHost('example.com', dohFetch({}, 2))).rejects.toBeInstanceOf(SsrfError);
  });

  it('fails closed when the resolver is unreachable', async () => {
    await expect(resolveHost('example.com', dohFetch({}, 0, false))).rejects.toBeInstanceOf(SsrfError);
    const boom = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(resolveHost('example.com', boom)).rejects.toBeInstanceOf(SsrfError);
  });
});

describe('assertPublicUrl — resolver integration', () => {
  it('accepts a public host behind a CNAME', async () => {
    await expect(
      assertPublicUrl('https://www.facebook.com/marketplace/item/1/', dohFetch({ A: FACEBOOK_CHAIN }))
    ).resolves.toBeUndefined();
  });

  it('refuses a host whose A record is loopback', async () => {
    await expect(
      assertPublicUrl('https://evil.example/', dohFetch({ A: [{ name: 'evil.example', type: 1, data: '127.0.0.1' }] }))
    ).rejects.toThrow(/private or local/);
  });

  it('refuses a host with one public and one private address', async () => {
    await expect(
      assertPublicUrl(
        'https://evil.example/',
        dohFetch({
          A: [
            { name: 'evil.example', type: 1, data: '8.8.8.8' },
            { name: 'evil.example', type: 1, data: '10.0.0.1' },
          ],
        })
      )
    ).rejects.toThrow(/private or local/);
  });

  it('refuses an IP literal in a private range without resolving', async () => {
    const neverCalled = (async () => {
      throw new Error('resolver must not be called for an IP literal');
    }) as unknown as typeof fetch;
    await expect(assertPublicUrl('http://169.254.169.254/latest/', neverCalled)).rejects.toThrow(/private or local/);
    await expect(assertPublicUrl('http://[::1]/', neverCalled)).rejects.toThrow(/private or local/);
  });

  it('refuses a non-http scheme', async () => {
    await expect(assertPublicUrl('ftp://example.com/')).rejects.toThrow(/http\(s\)/);
  });
});
