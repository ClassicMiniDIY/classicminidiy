# Vercel BotID — endpoint protection

Invisible bot protection (Vercel BotID) on the high-value POST endpoints. Complements
the existing per-IP rate limit (`server/middleware/rate-limit.ts`) and Turnstile — does
not replace them.

## What's protected

| Route | Why |
|---|---|
| `POST /api/langgraph/*` (chat: thread create + run/stream) | Unauthenticated, public, spends the LangSmith budget |
| `POST /api/models/*/checkout` | Mints a Stripe Checkout session |
| `POST /api/models/seller/onboard` | Creates a Stripe Connect onboarding link |

GET reads (e.g. `/api/langgraph/.../state`) are **not** protected — only POSTs carry the
challenge header, so `[...path].ts` only bot-checks `event.method === 'POST'`.

## How it's wired

- `nuxt.config.ts` → `modules: [..., 'botid/nuxt']` sets up the challenge proxy rewrites.
- `app/plugins/botid.client.ts` → `initBotId({ protect: [...] })` lists the protected
  paths so the browser attaches a challenge header to `fetch`/`$fetch` calls to them.
- Each protected handler calls `await checkBotId()` and `throw createError({ statusCode: 403 })`
  when `isBot`.

**Invariant:** the `protect` list in the client plugin and the `checkBotId()` calls in the
handlers must stay in sync. A path in `protect` without `checkBotId()` does nothing; a
`checkBotId()` on a path NOT in `protect` will 403 every (header-less) request.

## Critical behavior

- **Production-only.** Local dev and `curl` always classify as **human** (`isBot: false`),
  so this cannot be validated locally. Test in a **Vercel Preview** deployment by using the
  feature from a real page (the chat widget; a model checkout) — a `fetch` from a loaded page
  carries the header. Hitting a protected route directly with `curl` in production is blocked.
- **Browser-only routes only.** A non-browser caller (server-to-server, a mobile app) hitting
  a protected route is blocked. The three routes above are browser-only: the web chat widget
  and web model marketplace. The admin LangGraph routes (`server/api/admin/threads/*`) call
  the SDK directly and bypass `/api/langgraph`, so they're unaffected.

## Plan / dashboard

- **Basic** mode works with just the `botid` package — no dashboard config.
- **Deep Analysis** (Kasada-powered, stronger) is optional and enabled in the Vercel
  dashboard: Project → Firewall → Rules → enable **Vercel BotID Deep Analysis** (may require
  a plan tier). Leave on Basic if you'd rather not.

## Adding / removing a protected route

1. Add/remove the `{ path, method }` entry in `app/plugins/botid.client.ts`.
2. Add/remove the `checkBotId()` guard in the matching handler.
3. Only ever protect a route the browser calls via fetch. Re-test in Preview.
