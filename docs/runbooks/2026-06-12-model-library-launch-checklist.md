# 3D Model Library — Launch Checklist (PR 11)

Keystone: `classicminidiy-supabase/docs/plans/2026-06-11-3d-model-library.md` §11.
Branch: `feature/3d-models` → merges to `main` once this checklist is green.

> Note on the launch gate: the original plan gated the web feature behind a
> `modelsEnabled` runtime flag. That flag was **removed** — the feature ships by
> merging `feature/3d-models` to `main`. There is no flag to flip; "launch" = merge.

## 1. Legal — must clear before merge

- [ ] **Lawyer review** of the Paid File License copy — page `app/pages/legal/paid-file-license.vue`
      AND the `model_licenses.license_text` seed for `CMDIY-PAID-PERSONAL` /
      `CMDIY-PAID-COMMERCIAL` (migration `20260611000004`, currently prefixed
      "DRAFT — pending legal review"). Reconcile the two so they match.
- [ ] **Lawyer review** of the Model Library Terms & Safety copy — `app/pages/legal/model-terms.vue`.
- [ ] Remove the `DRAFT` prefix from `model_licenses.license_text` (new migration in
      the supabase repo) once the wording is final.
- [ ] **DMCA designated agent** registered with the U.S. Copyright Office DMCA
      Designated Agent Directory (~$6). Fill the agent block in
      `app/pages/legal/dmca.vue` (name + mailing address; email already set).
- [ ] Confirm the three legal pages are reachable and linked: footer, model detail
      (license area), upload wizard (license + safety steps).

## 2. Stripe — Connect (model marketplace)

- [ ] **Connect webhook endpoint** created in the Stripe Dashboard, pointing at the
      deployed `stripe-connect-webhook` function URL, with **"Listen to events on
      Connected accounts" enabled**. This is SEPARATE from the membership webhook
      endpoint.
- [ ] Events selected: `checkout.session.completed`, `charge.refunded`,
      `charge.dispute.created`, `charge.dispute.closed`, `account.updated`.
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` set as a Supabase function secret (distinct
      from the membership webhook secret).
- [ ] `STRIPE_SECRET_KEY` present (shared with membership — already set).
- [ ] Optional: `MODELS_ALLOWED_ORIGINS` if testing redirects from a non-prod origin
      other than localhost.

## 3. Edge functions — deploy

- [ ] Merge `fix/marketplace-localhost-redirect` (supabase repo) and redeploy the
      shared-helper consumers:
      `supabase functions deploy create-seller-onboarding create-model-checkout verify-model-purchase`
- [ ] `stripe-connect-webhook` deployed and reachable.

## 4. Web env (Nitro)

- [ ] `S3_MODELS_BUCKET`, `S3_MODELS_ACCESS_KEY_ID`, `S3_MODELS_SECRET_ACCESS_KEY`
      set in Vercel (and locally in `.env` for dev testing).
- [ ] `supabaseUrl` / `supabaseKey` public runtime config present (already in use).

## 5. End-to-end smoke (Stripe test mode)

- [ ] **Free model:** download works for a signed-in user; blocked when signed out.
- [ ] **Seller onboarding:** Selling tab → Stripe onboarding → return to
      `/dashboard/selling` → `charges_enabled` reflects (via `account.updated`
      webhook + page reload).
- [ ] **Paid purchase:** PriceBox → Stripe Checkout → success returns to the model
      page → `verify-purchase` unlocks files → row in `/dashboard/purchases`.
- [ ] **Tip:** TipPicker → checkout → success.
- [ ] **Webhook lifecycle:** `checkout.session.completed` records the purchase;
      issue a refund in Stripe → `charge.refunded` flips status; entitlement
      revoked on next download attempt.
- [ ] **Admin:** `/admin/models` queue approve/reject (RPC); resolve a report;
      takedown unpublishes a model; toggle a seller's kill switch; sales tab totals.
- [ ] **Report:** report a model from the detail page → appears in the admin Reports
      tab → resolve → reporter notification enqueued.

## 6. Merge

- [ ] All of the above checked → rebase-and-merge `feature/3d-models` into `main`.
- [ ] Post-merge: regenerate `types/database.ts` if any schema changed since the
      last gen; smoke the live model library once.
