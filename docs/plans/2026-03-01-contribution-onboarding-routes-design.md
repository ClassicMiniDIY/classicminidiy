# Contribution System, Onboarding & Route Cleanup — Design Document

**Date:** 2026-03-01
**Status:** Draft
**Scope:** Unify contribution flows under `/contribute`, add first-time onboarding with unified account messaging, add profile editing, clean up route inconsistencies.

---

## Goals

1. Single entry point for all archive contributions at `/contribute`
2. Clear first-time onboarding that communicates shared identity across classicminidiy.com and theminiexchange.com
3. Profile editing on CMDIY that writes to the shared `profiles` table
4. Inline suggest-edit flow on item detail pages (no separate route)
5. Consistent route naming and 301 redirects from old paths
6. Contextual "Contribute" CTAs within the archive section

---

## Route Structure

### New Routes

| Route | Purpose |
|---|---|
| `/welcome` | First-time user onboarding (profile setup + unified account explanation) |
| `/profile/edit` | Edit shared profile fields (display_name, avatar, bio) |
| `/contribute` | Hub: pick contribution type (document, color, wheel, registry) |
| `/contribute/document` | New document submission form (with type selector: manual, advert, catalogue, tuning) |
| `/contribute/color` | New color submission form |
| `/contribute/wheel` | New wheel submission form |
| `/contribute/registry` | New registry entry submission form |

### Redirects (301 via `nuxt.config.ts` routeRules)

| Old Route | New Route |
|---|---|
| `/archive/documents/submit` | `/contribute/document` |
| `/archive/colors/contribute` | `/contribute/color` |
| `/archive/wheels/submit` | `/contribute/wheel` |

### Removed Routes

| Route | Replacement |
|---|---|
| `/archive/documents/[slug]/suggest-edit` | Inline modal on document detail page |

### Unchanged Routes

| Route | Notes |
|---|---|
| `/login` | Updated copy to mention unified account |
| `/submissions` | User's submission history (no changes) |
| `/contributors/[id]` | Public contributor profiles (no changes) |
| `/auth/callback` | OAuth callback (updated redirect logic for first-time detection) |

---

## Account & Onboarding

### Shared Auth (Already Implemented)

Both classicminidiy.com and theminiexchange.com use the same Supabase project (`psoqirvbujwohemmwplv` at `auth.theminiexchange.com`). Auth methods (magic link, Google OAuth, Apple OAuth) and the `profiles` table are shared. No auth infrastructure changes needed.

### Login Page Updates

Add unified account messaging below the sign-in form:

> Your account works across classicminidiy.com and theminiexchange.com — one account for the entire Classic Mini DIY family.

### First-Time Detection

After the auth callback completes:

1. Check if `profiles.display_name` is null
2. If null → redirect to `/welcome` instead of the default destination
3. Store the intended destination (query param or sessionStorage) for post-onboarding redirect

### Welcome Page (`/welcome`)

Layout:
- Hero section with welcome message
- Unified account explanation: "Your account works on classicminidiy.com and theminiexchange.com"
- Profile setup form (optional — user can skip):
  - Display name (text input)
  - Avatar (image upload)
  - Bio (textarea)
- Feature overview (what you can do on CMDIY):
  - Browse the archive — manuals, colors, wheels, registry
  - Use technical tools — calculators, decoders, specs
  - Contribute — help grow the archive with your knowledge
- "Get Started" button → redirects to stored intended destination or `/`

The welcome page is accessible later at `/welcome` but only auto-redirects on first visit (null display_name trigger).

---

## Contribution System

### `/contribute` Hub Page

Requires authentication (redirect to `/login` if not signed in).

Content:
- Page title: "Contribute to the Archive"
- Subtitle: "Help preserve Classic Mini history"
- Grid of 4 cards linking to type-specific forms:
  - **Document** — Manuals, adverts, catalogues, tuning guides
  - **Color** — Paint colors and swatches
  - **Wheel** — Fitment data and photos
  - **Registry** — Register your Mini
- User's contribution stats at the bottom:
  - Total submissions, approved count
  - Current trust level
  - Link to `/submissions` for full history

### Submission Forms

Each `/contribute/*` page is a dedicated form that replaces the existing scattered submission pages:

| Form | Source (migrated from) | Key Fields |
|---|---|---|
| `/contribute/document` | `pages/archive/documents/submit.vue` | Type selector (manual/advert/catalogue/tuning), title, description, code, author, year, file upload, thumbnail |
| `/contribute/color` | `pages/archive/colors/contribute.vue` + `components/ColorSubmission.vue` | Name, code, hex value, year range, model, swatch upload |
| `/contribute/wheel` | `pages/archive/wheels/submit.vue` + `components/WheelSubmit.vue` | Name, size, width, offset, bolt pattern, style, manufacturer, photos |
| `/contribute/registry` | `components/RegistrySubmission.vue` (inline component, no page existed) | Year, model, engine number, body number, color, owner, location, notes, photos |

All forms:
- Use the existing `submission_queue` system via `useSubmissions.submitNewItem()`
- Trusted users get auto-approval via existing Postgres trigger
- Others go to mod queue as `pending`
- After submission: redirect to `/submissions` with success toast
- Forms follow the existing auth-gate pattern (`v-if="!isAuthenticated"` → sign-in CTA)

### Suggest Edit (Inline on Detail Pages)

The "Suggest Edit" capability moves from a separate page to an inline experience:

- "Suggest Edit" button visible to authenticated users on each item detail page
- Opens a modal/drawer showing current values in editable fields
- User makes changes and provides a reason
- Submits via existing `useSubmissions.submitEditSuggestion()` with the diff format:

```json
{
  "changes": {
    "field_name": { "from": "old value", "to": "new value" }
  },
  "reason": "User-provided reason for the change"
}
```

- Creates an `edit_suggestion` entry in `submission_queue`
- Applicable to: documents, colors, wheels, registry entries

### Archive Section CTAs

Contextual contribution prompts placed within the archive:

1. **`/archive` hub page** — Add a "Contribute" card alongside the existing section tiles (Documents, Registry, Colors, Wheels)
2. **Each archive section listing page** — Banner: "Know something we're missing? Help grow the archive." with link to the relevant `/contribute/*` page
3. **Each item detail page** — "Suggest Edit" button (auth-gated)

No top-level nav change — contribution is discoverable from within the archive context where it's most relevant.

---

## Profile Editing

### `/profile/edit` Page

Requires authentication. Edits the shared `profiles` table:

| Field | Input Type | Notes |
|---|---|---|
| `display_name` | Text input | Required for contributor visibility |
| `avatar_url` | Image upload | Supabase Storage `avatars/` bucket |
| `bio` | Textarea | Optional |

Changes are reflected on both classicminidiy.com and theminiexchange.com since both read from the same `profiles` table.

### Access Points

- **Nav dropdown** (authenticated): "Edit Profile" link → `/profile/edit`
- **Welcome page**: Same fields shown during onboarding
- **Contributor profile** (`/contributors/[id]`): "Edit Profile" link when viewing own profile

---

## Implementation Summary

### New Files

| File | Purpose |
|---|---|
| `pages/welcome.vue` | First-time onboarding page |
| `pages/profile/edit.vue` | Profile editing page |
| `pages/contribute/index.vue` | Contribution hub |
| `pages/contribute/document.vue` | Document submission form (migrated) |
| `pages/contribute/color.vue` | Color submission form (migrated) |
| `pages/contribute/wheel.vue` | Wheel submission form (migrated) |
| `pages/contribute/registry.vue` | Registry submission form (new dedicated page) |
| `components/SuggestEditModal.vue` | Reusable suggest-edit modal for all item types |
| `components/ContributeCard.vue` | CTA card for archive pages |

### Removed Files

| File | Replacement |
|---|---|
| `pages/archive/documents/submit.vue` | `/contribute/document` + 301 redirect |
| `pages/archive/colors/contribute.vue` | `/contribute/color` + 301 redirect |
| `pages/archive/wheels/submit.vue` | `/contribute/wheel` + 301 redirect |
| `pages/archive/documents/[slug]/suggest-edit.vue` | Inline `SuggestEditModal` on detail page |

### Modified Files

| File | Change |
|---|---|
| `pages/login.vue` | Add unified account messaging |
| `pages/auth/callback.vue` | First-time detection (null display_name → `/welcome`) |
| `pages/archive/index.vue` | Add contribute CTA card |
| `pages/archive/documents/index.vue` | Add "help grow the archive" banner |
| `pages/archive/documents/[slug].vue` | Add suggest-edit modal trigger |
| `pages/archive/colors/index.vue` | Add contribute banner |
| `pages/archive/colors/[...color].vue` | Add suggest-edit modal trigger |
| `pages/archive/wheels/index.vue` | Add contribute banner |
| `pages/archive/wheels/[...wheel].vue` | Add suggest-edit modal trigger |
| `pages/archive/registry/index.vue` | Add contribute banner, add suggest-edit modal trigger |
| `components/MainNav.vue` | Add "Edit Profile" to auth dropdown, add "My Submissions" if not present |
| `nuxt.config.ts` | Add 301 redirect routeRules |

### No New Composables

The existing data layer handles everything:
- `useSubmissions` — submit new items, suggest edits, list user's submissions
- `useContributions` — contribution stats, contributor profiles
- `useAuth` — profile fetching, authentication state
- Per-type composables (`useArchiveDocuments`, `useColors`, `useWheels`, `useRegistry`) — data queries

### No Database Changes

All required tables and columns already exist:
- `profiles` with `display_name`, `avatar_url`, `bio`, `trust_level`, submission counters
- `submission_queue` with `type`, `target_type`, `data`, `status`
- `contributions` for history tracking
- Storage buckets for file uploads

---

## Implementation Phases

### Phase 1: Route Cleanup & Redirects
- Add 301 redirects in `nuxt.config.ts`
- Create placeholder `/contribute` pages (can be empty initially)
- Verify old URLs redirect correctly

### Phase 2: Onboarding
- Update `/login` page with unified account messaging
- Build `/welcome` page with profile setup
- Update `/auth/callback` with first-time detection logic

### Phase 3: Profile Editing
- Build `/profile/edit` page
- Add "Edit Profile" links to nav dropdown and contributor profile
- Wire up avatar upload to Supabase Storage

### Phase 4: Contribution Hub & Forms
- Build `/contribute` hub page
- Migrate document submission form to `/contribute/document`
- Migrate color submission form to `/contribute/color`
- Migrate wheel submission form to `/contribute/wheel`
- Build new registry submission form at `/contribute/registry`
- Remove old submission pages (replaced by redirects)

### Phase 5: Suggest Edit & Archive CTAs
- Build `SuggestEditModal.vue` component
- Add suggest-edit to document, color, wheel, and registry detail pages
- Remove `/archive/documents/[slug]/suggest-edit` page
- Build `ContributeCard.vue` component
- Add CTAs to archive hub and section listing pages
