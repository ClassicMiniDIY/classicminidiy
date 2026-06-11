/**
 * Post-auth redirect validation (pre-launch punch list D1).
 *
 * Accepts only same-site path redirects, rejecting every known open-redirect
 * shape — used by /login (?redirect= → localStorage), /auth/callback
 * (localStorage consume), and /welcome (?redirect=). Keep all three on this
 * single validator so a bypass can't be reintroduced in one of them.
 *
 * Rejected shapes:
 *  - absolute URLs (`https://evil.com`, `javascript:…`) — no leading `/`
 *  - protocol-relative (`//evil.com`)
 *  - backslash variants (`/\evil.com`, `/\\evil.com`) — browsers normalize
 *    `\` to `/`, turning them protocol-relative
 *  - control characters (tab/newline/NUL) — stripped by browser URL parsers,
 *    which could resurrect a rejected shape
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function sanitizeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || CONTROL_CHARS.test(value)) return null;
  return value;
}
