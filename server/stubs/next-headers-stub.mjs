// Stub for `next/headers`, aliased in nuxt.config.ts (nitro.alias).
//
// botid/server does a guarded `await import("next/headers")` to read request
// headers when running inside Next.js. This is a Nuxt app — that module doesn't
// exist, and the import sits inside a try/catch that falls back to null, so the
// only effect of the missing module was a noisy Rollup UNRESOLVED_IMPORT warning
// on every server build. Aliasing the bare specifier here makes it resolve.
//
// `headers()` throws so botid's try/catch takes its existing null fallback; it is
// never actually invoked in production (botid reads headers from the Vercel
// request context first and only probes next/headers in dev).
//
// Kept in server/stubs (NOT server/utils) so Nitro doesn't auto-import these
// generic names into server code.
export function headers() {
  throw new Error('next/headers is not available outside Next.js');
}

export function cookies() {
  throw new Error('next/cookies is not available outside Next.js');
}
