/**
 * UUID generation for values that must not collide.
 *
 * `crypto.randomUUID()` is restricted to SECURE CONTEXTS, so it is undefined
 * over plain HTTP and in older browsers — which is why every call site here
 * grew its own fallback. Those fallbacks reached for `Math.random()`, which is
 * not a CSPRNG and gives no distinctness guarantee across concurrent tabs or
 * after a page restore.
 *
 * `crypto.getRandomValues()` has none of that restriction — it is available in
 * insecure contexts and everywhere `crypto` exists at all — so it is the
 * correct fallback and the one this uses.
 *
 * (CodeQL js/insecure-randomness, issue #779.)
 */

/** RFC 4122 v4 from 16 CSPRNG bytes. */
function uuidFromBytes(bytes: Uint8Array): string {
  // Version 4 and the RFC variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A v4 UUID, from the strongest source available.
 *
 * The final `Math.random()` branch is unreachable in any browser that supports
 * `Uint8Array` (getRandomValues predates it), and exists only so an upload path
 * degrades rather than throwing. Do not treat it as a supported case.
 */
export function randomUuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) return uuidFromBytes(c.getRandomValues(new Uint8Array(16)));
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return uuidFromBytes(bytes);
}

/**
 * A short lowercase-alphanumeric token, for a slug suffix or filename segment
 * where a full UUID is unnecessarily long. Derived from `randomUuid`, so it
 * inherits the same source — 8 hex chars, ~4.3 billion values.
 */
export function randomToken(length = 8): string {
  return randomUuid().replace(/-/g, '').slice(0, length);
}
