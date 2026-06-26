# Spam protection & account verification — incident response + hardening plan

**Date:** 2026-06-26
**Branch:** `claude/spam-protection-account-verification-7ph1d3`
**Trigger:** A scammer registered an account on the shared CMDIY platform and sent
a phishing message ("During a review of your account, violations … access … has
been temporarily restricted") to many users. The account was deleted manually.

This doc captures (1) what was hardened in **this repo** in response, and (2) the
larger fixes that belong in **other repos** because that's where the abused
surface actually lives.

---

## Where the abuse actually happened (read this first)

The phishing was delivered through **user-to-user messaging**, which is **not in
this repo**. The architecture (see root `CLAUDE.md` → CMDIY Ecosystem):

| Concern                                                      | Lives in                                               |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| Account/auth + `profiles` table (shared)                     | **classicminidiy-supabase** (Supabase Auth + Postgres) |
| `conversations` / `messages` tables, RLS, `report_message()` | **classicminidiy-supabase**                            |
| Marketplace messaging UI + send flow                         | **TheMiniExchange** (Nuxt)                             |
| This site (archive, technical tools, model library, AI chat) | **this repo**                                          |

So the highest-leverage fixes — throttling message sends, gating new accounts from
messaging, content-scanning message bodies — must land in **Supabase** (RLS +
edge functions) and **TheMiniExchange** (UI). This repo can only harden the
surfaces it owns. Both halves are below.

---

## Existing defenses (already in place before this incident)

This platform is **not** undefended — the layers already shipped:

- **Cloudflare Turnstile** on the magic-link login form (`app/pages/login.vue`).
  OAuth (Google/Apple) intentionally skips it — those providers verify their own
  users and bots rarely complete real OAuth.
- **Per-IP rate limiting** on the unauthenticated AI chat proxy
  (`server/middleware/rate-limit.ts`).
- **Vercel BotID** invisible challenge on high-value POSTs (chat, model checkout,
  seller onboard) — see `docs/runbooks/2026-06-15-botid-endpoint-protection.md`.
- **Moderation backend** in the shared schema: `trust_level`
  (`new → contributor → trusted → moderator → admin`), `is_banned`,
  `warning_count`, `admin_increment_warning_count()`, a unified review queue
  (`/api/admin/queue/*`), `report_message()`, and per-message moderation fields
  (`moderation_status`, `reported_by[]`, `report_reason`, `reported_at`).
- **New-trust content gating**: a `new`-trust user's model comments are inserted
  as `pending` via Supabase RLS and are invisible to others until approved
  (see `server/api/models/[modelId]/comments.get.ts`).

The gaps this incident exposed are about (a) enforcement timing and (b) coverage,
not a total absence of controls.

---

## Part 1 — Shipped in this repo (this branch)

### 1.1 Ban enforcement in the shared auth helper

**Problem:** `requireUserAuth` (`server/utils/userAuth.ts`) verified the Supabase
access token but never checked `profiles.is_banned`. A Supabase access token stays
valid until it expires (~1h) even after an admin bans the account, so a
just-banned scammer could keep hitting **all 27 authenticated write endpoints**
(submissions, uploads, comments, checkout, seller onboarding) until their token
lapsed. `is_banned` was referenced **nowhere** in the server or app code.

**Fix:** `requireUserAuth` now does one extra lookup
(`profiles.select('is_banned')`) after token verification and throws **403
"Account suspended"** when `is_banned === true`. Because `requireUserClient`
delegates to `requireUserAuth`, every authed write inherits the check from one
place. It is **fail-open**: a missing profile row or a query error never blocks —
only an explicit `is_banned === true` does. The ban now takes effect on the
banned user's **next request**, not whenever their token happens to expire.

### 1.2 Generalized per-IP write rate limiting

**Problem:** `server/middleware/rate-limit.ts` only throttled `/api/langgraph/**`.
Nothing throttled the content-submission endpoints, so a script could flood the
moderation queue or spray scam links across registry/wheel/color/model/comment/
config submissions.

**Fix:** added a second policy — a per-IP throttle on **mutating** requests
(`POST/PUT/PATCH/DELETE`) to `/api/**`, default **30 / 60s**, tunable via
`WRITE_RATELIMIT_MAX` / `WRITE_RATELIMIT_WINDOW_MS`. `/api/admin/**` is exempt
(moderators doing bulk queue work, already gated by `requireAdminAuth`) and
`/api/langgraph` keeps its own stricter policy. Same caveat as before: per-warm-
instance counter, so it's an abuse **dampener**, not a hard global quota.

> Note: this repo has **no inbound webhooks** (payments are thin proxies to
> Supabase edge functions), so throttling write methods cannot drop Stripe
> webhook deliveries.

### What this repo deliberately did **not** change

- **Account creation throttling / email checks.** Signup goes straight to
  Supabase Auth (`signInWithOtp` / OAuth) and never transits this app's `/api`,
  so it can't be rate-limited here. That belongs in Supabase (Part 2).
- **Turnstile on OAuth.** Low value (providers verify their own users); left as-is.
- **Expanding Vercel BotID** to more routes. BotID is production-only and the
  runbook stresses keeping the client `protect` list and the handler
  `checkBotId()` calls in lockstep — expanding it blind, unverifiable locally, is
  riskier than the per-IP write throttle above. Candidate follow-up, not done here.

---

## Part 2 — Needs to land in other repos (the real messaging fix)

> Tracked for cross-property cascade per root `CLAUDE.md`. Consider a card on
> **CMDIY Platform #9** (Web = Shipped for Part 1; Supabase / TME = Not Started).

### 2.1 `classicminidiy-supabase` — throttle & gate at the source

1. **Rate-limit message sends in the DB/edge layer.** A `BEFORE INSERT` trigger
   (or the send edge function) that rejects when a sender exceeds, e.g., _N
   messages/hour_ or _M distinct new recipients/day_. The phishing pattern was
   one new account → many recipients → identical body; cap distinct-recipient
   fan-out for low-trust accounts hardest.
2. **New-account messaging probation.** Block message sends (or hold them
   `pending`) for accounts that are `trust_level = 'new'` AND below an age
   threshold (e.g. < 24–48h) AND/or with zero approved contributions. Mirror the
   existing "new-trust comment → pending" RLS pattern already used for
   `model_comments`. Auto-lift as the account ages / earns `contributor`.
3. **Verified-email gate.** Require `auth.users.email_confirmed_at` before a first
   outbound message. (Magic-link implies confirmation; OAuth/other paths may not.)
4. **Content heuristics on insert.** Flag bodies with the classic phishing markers
   (account-suspension language, external links, urgency) to `pending` for
   low-trust senders. Cheap regex/keyword pass in the trigger or edge function.
5. **Surface `report_message()` in the UI** (Part 2.2) and wire a moderator alert
   when `reported_by` count crosses a threshold.

### 2.2 `TheMiniExchange` — make abuse visible & costly

1. **Per-recipient "Report" + "Block" controls** in the message thread UI, calling
   the existing `report_message()` RPC.
2. **Client-side send guardrails** for new accounts (cooldown between sends,
   recipient cap) that mirror the server limits, for fast UX feedback.
3. **Trust/age badges** on sender identity so recipients can spot a brand-new
   account messaging them out of the blue.

### 2.3 Operational follow-ups

- **Notify affected users** that the suspicious "account review / access
  restricted" message was a scam and CMDIY will never DM them to restrict access.
- **Add a moderator alert** (email/Discord) when a single account messages > K
  distinct recipients in a short window — early-warning for the next attempt.

---

## Verification

- `bun run test` (vitest): added coverage for the ban check
  (`tests/unit/server/utils/userAuth.test.ts`: 403-on-banned, allow-when-not-banned,
  fail-open-on-error) and the write throttle
  (`tests/unit/server/middleware/rate-limit.test.ts`: GET not throttled,
  POST/PUT/PATCH/DELETE throttled at the limit, `/api/admin` exempt, write budget
  independent of the chat budget). All pass.
- The middleware throttle and BotID are **production-only / per-instance**; smoke-
  test the write throttle in a Vercel Preview, not locally.
- Pre-existing unrelated failure: `tests/unit/data/generic-model.test.ts`
  ("ToolboxItems has 8 items" — now 9). Not touched by this branch.
