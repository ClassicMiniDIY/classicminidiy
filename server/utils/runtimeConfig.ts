import type { H3Event } from 'h3';

/**
 * `useRuntimeConfig(event)`, typed for the server.
 *
 * CLAUDE.md's guidance is to prefer the event form in new server code: it is
 * per-request, it costs nothing, and it does not depend on workerd populating
 * `process.env` before module evaluation. But the call does not typecheck here.
 * Nitro's `useRuntimeConfig` takes an event; Nuxt's app-side one takes no
 * arguments, and in this tsconfig the app declaration wins — so every correct
 * call reports "Expected 0 arguments, but got 1".
 *
 * That mismatch is a type-resolution artifact, not a runtime problem, and it had
 * accumulated as five identical errors in the typecheck baseline. This wrapper
 * states the real signature once so the documented convention can be followed
 * without adding a sixth.
 */
export function serverRuntimeConfig(event: H3Event) {
  return (useRuntimeConfig as unknown as (e: H3Event) => ReturnType<typeof useRuntimeConfig>)(event);
}
