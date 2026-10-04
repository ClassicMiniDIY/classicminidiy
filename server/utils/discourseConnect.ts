/**
 * DiscourseConnect (Discourse SSO) wire format, provider side.
 *
 * Design: docs/plans/2026-10-03-discourse-sso.md. Used only by
 * server/api/discourse/sso.post.ts.
 *
 * Discourse sends `sso` (base64 of a query string) and `sig` (lowercase hex
 * HMAC-SHA256 of the base64 TEXT, not of the decoded bytes) under a shared
 * secret. The answer has the same shape. Everything here is Web Crypto and
 * pure: no `node:crypto`, no I/O, no runtime config.
 */

/** Largest `sso` value accepted. A real request is about 150 characters. */
export const DISCOURSE_SSO_MAX_LENGTH = 2048;

const SIG_FORMAT = /^[0-9a-f]{64}$/;
// Strict base64 after line breaks are removed. Line breaks are tolerated on
// input only: older Discourse releases (and the protocol's published example)
// used Ruby's `encode64`, which adds them. They stay part of the signed text.
const BASE64_FORMAT = /^[A-Za-z0-9+/]+={0,2}$/;

const encoder = new TextEncoder();

/** True for exactly 64 lowercase hex characters. */
export function isValidDiscourseSig(sig: unknown): sig is string {
  return typeof sig === 'string' && SIG_FORMAT.test(sig);
}

/** True for a non-empty base64 string (line breaks allowed) under the size limit. */
export function isValidDiscourseSsoParam(sso: unknown): sso is string {
  if (typeof sso !== 'string' || sso.length === 0 || sso.length > DISCOURSE_SSO_MAX_LENGTH) return false;
  const compact = sso.replace(/[\r\n]/g, '');
  return compact.length > 0 && compact.length % 4 === 0 && BASE64_FORMAT.test(compact);
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/**
 * Verify `sig` over the `sso` text. `crypto.subtle.verify` compares in
 * constant time; never compare hex strings with `===`. A malformed `sso` or
 * `sig` returns false without touching the key.
 */
export async function verifyDiscourseSig(sso: string, sig: string, secret: string): Promise<boolean> {
  if (!secret || !isValidDiscourseSsoParam(sso) || !isValidDiscourseSig(sig)) return false;
  const key = await hmacKey(secret, 'verify');
  return crypto.subtle.verify('HMAC', key, hexToBytes(sig), encoder.encode(sso));
}

/** Decode a VERIFIED `sso` value into its parameters. Null when it does not decode. */
export function decodeDiscoursePayload(sso: string): URLSearchParams | null {
  if (!isValidDiscourseSsoParam(sso)) return null;
  try {
    const binary = atob(sso.replace(/[\r\n]/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

/** Strict base64 (no line breaks) of the UTF-8 bytes of `text`. */
function toBase64(text: string): string {
  let binary = '';
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Encode and sign an answer payload. `sso` is strict base64 of
 * `params.toString()`; `sig` is lowercase hex HMAC-SHA256 of that base64 text.
 * Neither is URL-encoded here: the caller encodes `sso` when it builds the URL.
 */
export async function signDiscoursePayload(
  params: URLSearchParams,
  secret: string
): Promise<{ sso: string; sig: string }> {
  const sso = toBase64(params.toString());
  const key = await hmacKey(secret, 'sign');
  const sig = bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(sso)));
  return { sso, sig };
}
