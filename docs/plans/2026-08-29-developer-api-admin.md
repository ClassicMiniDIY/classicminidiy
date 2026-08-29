# Developer API — admin surface (web half)

Status: design approved 2026-08-29. Branch `feature/developer-api-admin`.
Private half (comp RPC changes, migration): see the same-named doc in
`classicminidiy-supabase/docs/plans/`.

Builds on `docs/plans/2026-08-28-developer-api-subscription.md`, which shipped
the product itself.

## What operators need to do

Five jobs, all previously impossible without hand-written SQL:

1. Comp someone the paid Developer API tier.
2. Revoke that comp.
3. Revoke a user's API key.
4. Issue an API key on a user's behalf (support cases).
5. See a specific user's usage.

## Where it lives

- **Per-user actions** extend the existing membership modal on `/admin/users`
  — the modal already carries comp-Sustaining, so everything about one person
  stays on one screen. A new "Developer API" section adds the five jobs above.
- **`/admin/developer`** is a new fleet view: who is subscribed (paid vs
  comped), how many active keys exist, and the top usage over 30 days. This is
  the "who are my subscribers" question the per-user modal cannot answer.

## The blocking constraint (private repo)

`subscriptions_user_comp_key` is `UNIQUE (user_id) WHERE platform = 'comp'` —
**one comp row per user regardless of product** — and
`grant_comp_membership` hardcodes `product_id = 'sustaining'`. As shipped, a
user comped for Sustaining cannot also be comped for Developer API; the second
grant would collide with the first and rewrite it.

The migration therefore:

- Replaces that index with `UNIQUE (user_id, product_id) WHERE platform = 'comp'`.
- `DROP`s and recreates `grant_comp_membership` / `revoke_comp_membership` with
  a trailing `p_product_id TEXT DEFAULT 'sustaining'`. Dropping is required
  rather than `CREATE OR REPLACE`: adding a defaulted parameter creates an
  *overload*, and a 3-argument call would then be ambiguous between the two
  ("function is not unique"). Existing callers pass three named params and keep
  working unchanged against the new function.
- Adds `admin_get_developer_summary(p_user_id)` — subscription state, active
  key count and 30-day call total in one round trip, `is_admin()`-guarded like
  its siblings.

## Split of mechanism (follows existing house patterns)

| Job | Mechanism | Why |
|---|---|---|
| Comp grant / revoke | Supabase RPC, admin's own JWT, `is_admin()` in SQL | Matches the existing comp-Sustaining UI exactly |
| Key list / issue / revoke, usage, overview | Nitro routes under `/api/admin/developer/**`, `requireAdminAuth` + service client | Matches `/api/admin/users/*`; and issuing must mint a key and purge the worker's KV auth cache, which only the worker can do |

## Admin-issued keys — the trust rule

Issuing a key for someone hands the admin a working credential for that
person's account: it calls the MCP as them and counts against their usage. That
is a legitimate support tool, but it must never be indistinguishable from a key
the user made themselves. Therefore:

- The key name is **forced** to `Admin-issued by <admin email>` — the user sees
  that in their own `/dashboard/api-keys` list and can revoke it.
- Every issue and every admin revoke writes an `admin_audit_log` row
  (`developer_key_issued` / `developer_key_revoked`) carrying the target user,
  the key prefix, and the acting admin.
- The plaintext is shown to the admin exactly once, as with self-serve minting.
- The per-user cap (5 active keys) still applies — admins do not bypass it.

## Cache coherence

Both the tier and the key set are cached in the worker's KV auth cache. Every
admin mutation purges the affected entries, so changes are effective on the
next MCP request rather than after the 5-minute TTL:

- Revoking a key purges that key's entry (same as the user-facing route).
- Comping or revoking the subscription purges **all** of that user's key
  entries, because their tier just changed.

## Files

**Web**
- `server/api/admin/developer/[userId]/keys.get.ts` — list a user's active keys
- `server/api/admin/developer/[userId]/keys.post.ts` — issue (forced name, audit, cap enforced)
- `server/api/admin/developer/[userId]/usage.get.ts` — 30-day usage by tool/day
- `server/api/admin/developer/keys/[id].delete.ts` — revoke + KV purge + audit
- `server/api/admin/developer/overview.get.ts` — fleet: subscribers, key counts, top usage
- `server/api/admin/developer/[userId]/refresh.post.ts` — purge a user's key cache after a tier change
- `app/composables/useAdminDeveloper.ts`
- `app/composables/useAdminMembership.ts` — thread `productId` through grant/revoke
- `app/pages/admin/users.vue` — "Developer API" section in the membership modal
- `app/pages/admin/developer.vue` + `NAV_GROUPS` entry in `app/components/admin/Shell.vue`

**Private repo**
- `migrations/20260829000001_developer_api_admin.sql`

## Testing

- Unit: admin routes reject non-admins; issue enforces the 5-key cap and the
  forced name; revoke purges the cache entry and writes an audit row; usage
  window matches the user-facing one.
- Manual: comp a test account, confirm its key flips to `developer` tier on the
  next MCP call without waiting out the TTL; revoke and confirm the reverse.

## Out of scope

Editing another user's key *name*, and transferring keys between accounts.
Neither has a support story, and both muddy the audit trail.
