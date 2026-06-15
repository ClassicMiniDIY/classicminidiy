/**
 * SSRF protection for the external-model scraper. Every outbound fetch to a
 * user-supplied URL (the page itself AND any image URLs scraped from it) goes
 * through `safeFetch`, which resolves the host and refuses private, loopback,
 * link-local, or cloud-metadata addresses — at every redirect hop — then caps
 * the body size to prevent OOM on huge/streaming responses.
 *
 * `isBlockedAddress` is pure and unit-tested; the DNS/redirect layers wrap it.
 */
import { promises as dns } from 'node:dns';
import net from 'node:net';

const MAX_REDIRECTS = 5;

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

function ipv4Blocked(ip: string): boolean {
  const o = ip.split('.').map((p) => Number(p));
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

/** Expand a (net.isIP-validated) IPv6 string to 16 bytes, or null if malformed. */
export function ipv6ToBytes(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);

  // Trailing dotted-IPv4 (e.g. ::ffff:127.0.0.1) consumes the last two groups.
  let v4: number[] = [];
  if (s.includes('.')) {
    const colon = s.lastIndexOf(':');
    if (colon < 0) return null;
    const quad = s.slice(colon + 1).split('.');
    if (quad.length !== 4) return null;
    v4 = quad.map((q) => Number(q));
    if (v4.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    s = s.slice(0, colon); // drop ":a.b.c.d"
  }

  const dbl = s.split('::');
  if (dbl.length > 2) return null;
  const groupsOf = (g: string) => (g ? g.split(':') : []);
  const head = groupsOf(dbl[0]);
  const tail = dbl.length === 2 ? groupsOf(dbl[1]) : [];
  const wanted = 8 - (v4.length ? 2 : 0);

  let hex: string[];
  if (dbl.length === 2) {
    const missing = wanted - head.length - tail.length;
    if (missing < 0) return null;
    hex = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    if (head.length !== wanted) return null;
    hex = head;
  }

  const bytes: number[] = [];
  for (const h of hex) {
    const g = parseInt(h, 16);
    if (Number.isNaN(g) || g < 0 || g > 0xffff) return null;
    bytes.push((g >> 8) & 0xff, g & 0xff);
  }
  bytes.push(...v4);
  return bytes.length === 16 ? bytes : null;
}

function ipv6Blocked(bytes: number[]): boolean {
  const zero10 = bytes.slice(0, 10).every((b) => b === 0);
  // ::ffff:a.b.c.d (v4-mapped) and 64:ff9b::/96 (NAT64) → judge the embedded v4
  if (zero10 && bytes[10] === 0xff && bytes[11] === 0xff) return ipv4Blocked(bytes.slice(12).join('.'));
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    return ipv4Blocked(bytes.slice(12).join('.'));
  }
  if (bytes.every((b) => b === 0)) return true; // :: unspecified
  if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) return true; // ::1 loopback
  if (bytes[0] === 0xff) return true; // ff00::/8 multicast
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  return false;
}

/** True if an IP literal is private/loopback/link-local/metadata/reserved. */
export function isBlockedAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return ipv4Blocked(ip);
  if (kind === 6) {
    const bytes = ipv6ToBytes(ip);
    return bytes ? ipv6Blocked(bytes) : true;
  }
  return true; // not an IP (shouldn't reach here — DNS returns IPs)
}

/** Throw SsrfError unless `rawUrl` is http(s) and resolves only to public IPs. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SsrfError('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new SsrfError('Only http(s) URLs are allowed');

  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((r) => r.address);
    } catch {
      throw new SsrfError('Could not resolve host');
    }
    if (!addresses.length) throw new SsrfError('Could not resolve host');
  }
  for (const a of addresses) if (isBlockedAddress(a)) throw new SsrfError('Refusing to fetch a private or local address');
}

/**
 * Fetch with SSRF validation at every redirect hop (manual redirects). Returns
 * the final Response (body unread) — read it with `readBodyCapped`.
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new SsrfError('Too many redirects');
}

/** Read a response body, aborting (and throwing) once it exceeds `maxBytes`. */
export async function readBodyCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new SsrfError('Response too large');
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SsrfError('Response too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
