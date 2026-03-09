# Archive Migration to Supabase — Design Document

**Date:** 2026-03-01
**Status:** Approved
**Scope:** Migrate Classic Mini DIY archive from DynamoDB/S3/GitHub to Supabase, unify authentication with TheMiniExchange, add community contribution system with moderation.

---

## Goals

1. Replace DynamoDB, S3, and Nuxt Content (GitHub) with a single Supabase project
2. Unify authentication across Classic Mini DIY and TheMiniExchange via OAuth 2.1
3. Enable community contributions with a Wikipedia-style moderation queue
4. Support simple (single document) and complex (collection) archive items
5. Add public contributor profiles with trust-level progression
6. Unify the five document sections into a single filterable archive view
7. Zero downtime — live site stays functional throughout migration

---

## System Architecture

Two separate Supabase projects with shared identity:

```
┌─────────────────────┐         ┌─────────────────────┐
│  TheMiniExchange     │         │  Classic Mini DIY     │
│  (Supabase Project)  │         │  (Supabase Project)   │
│                      │         │                       │
│  - Marketplace DB    │  OAuth  │  - Archive DB         │
│  - Auth Provider ◄───┼────────►│  - Archive Storage    │
│  - Listing Storage   │  2.1    │  - Profiles (local)   │
│  - profiles table    │         │  - Mod queue          │
│  - is_admin flag     │         │  - Contributor system  │
└─────────────────────┘         └───────────────────────┘
         │                                 │
         └────── Shared User Identity ─────┘
              (one account, both sites)
```

### Authentication Flow

1. User clicks "Sign in" on CMDIY
2. Redirected to TME's Supabase Auth (OAuth 2.1 authorization endpoint)
3. User authenticates via magic link (or any method TME supports)
4. Redirected back to CMDIY with authorization code
5. CMDIY exchanges code for tokens, creates/links a local profile in its own Supabase
6. Admin status inherited from TME's token claims (`is_admin` flag)

TME enables its OAuth 2.1 server feature and registers CMDIY as an OAuth client. TME requires zero code changes.

---

## Data Model

### Archive Documents (unified table — manuals, adverts, catalogues, tuning, electrical)

```sql
archive_documents
├── id (uuid, PK)
├── slug (text, unique, indexed) -- e.g., "akd4935-workshop-manual"
├── type (enum: manual, advert, catalogue, tuning, electrical)
├── collection_id (uuid, FK → document_collections, nullable)
├── title (text)
├── description (text)
├── code (text) -- original identifier, e.g., "AKD4935"
├── author (text)
├── year (int, nullable)
├── file_path (text) -- Supabase Storage path
├── thumbnail_path (text) -- Supabase Storage path
├── metadata (jsonb) -- type-specific extras
├── sort_order (int) -- position within collection
├── status (enum: draft, pending, approved, rejected)
├── submitted_by (uuid, FK → profiles)
├── reviewed_by (uuid, FK → profiles, nullable)
├── reviewed_at (timestamptz, nullable)
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### Document Collections (grouping revisions/series)

```sql
document_collections
├── id (uuid, PK)
├── slug (text, unique, indexed) -- e.g., "akd7000-workshop-manual"
├── type (enum: manual, advert, catalogue, tuning, electrical)
├── title (text)
├── description (text)
├── thumbnail_path (text)
├── status (enum: pending, approved, rejected)
├── submitted_by (uuid, FK → profiles)
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

A standalone document has `collection_id = null`. A grouped set (e.g., 4 revisions of a workshop manual) shares a `collection_id`. Items within a collection use `sort_order` for sequencing.

Slugs are auto-generated from titles with collision handling (append `-2`, `-3`, etc.). Migration script generates slugs from existing content identifiers.

### Registry Entries

```sql
registry_entries
├── id (uuid, PK)
├── year (int)
├── model (text)
├── engine_number (text)
├── body_number (text)
├── color (text)
├── owner (text)
├── location (text)
├── notes (text)
├── photos (text[]) -- Supabase Storage paths
├── status (enum: draft, pending, approved, rejected)
├── submitted_by (uuid, FK → profiles)
├── reviewed_by (uuid, FK → profiles, nullable)
├── reviewed_at (timestamptz, nullable)
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### Colors

```sql
colors
├── id (uuid, PK)
├── name (text)
├── code (text)
├── hex_value (text)
├── year_start (int, nullable)
├── year_end (int, nullable)
├── model (text)
├── swatch_path (text) -- Supabase Storage path
├── metadata (jsonb)
├── status (enum: draft, pending, approved, rejected)
├── submitted_by (uuid, FK → profiles)
├── reviewed_by (uuid, FK → profiles, nullable)
├── reviewed_at (timestamptz, nullable)
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### Wheels

```sql
wheels
├── id (uuid, PK)
├── name (text)
├── size (int)
├── width (text)
├── offset (text)
├── bolt_pattern (text)
├── style (text)
├── manufacturer (text)
├── photos (text[]) -- Supabase Storage paths
├── metadata (jsonb)
├── status (enum: draft, pending, approved, rejected)
├── submitted_by (uuid, FK → profiles)
├── reviewed_by (uuid, FK → profiles, nullable)
├── reviewed_at (timestamptz, nullable)
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### Shared Pattern

Every user-submitted table follows the same columns: `status`, `submitted_by`, `reviewed_by`, `reviewed_at`. This makes the moderation system consistent across all types.

---

## Profiles & Trust Levels

### Profiles

```sql
profiles
├── id (uuid, PK) -- matches TME auth user ID
├── display_name (text)
├── avatar_url (text)
├── bio (text, nullable)
├── trust_level (enum: new, contributor, trusted, moderator, admin)
├── total_submissions (int, default 0)
├── approved_submissions (int, default 0)
├── rejected_submissions (int, default 0)
├── joined_at (timestamptz)
├── last_active_at (timestamptz)
```

### Trust Level Progression

| Level           | Threshold                         | Permissions                                             |
| --------------- | --------------------------------- | ------------------------------------------------------- |
| **new**         | Default on signup                 | Submissions always go to mod queue                      |
| **contributor** | 3+ approved submissions           | Same as new, earns profile badge                        |
| **trusted**     | 10+ approved, <20% rejection rate | Submissions auto-approved. Edits still queued.          |
| **moderator**   | Manually promoted by admin        | Can review/approve/reject others' submissions           |
| **admin**       | Inherited from TME `is_admin`     | Full access. Can promote moderators, override anything. |

Trust levels recalculated automatically via Postgres triggers when submissions are approved/rejected. Admins can manually promote or demote.

### Contributions

```sql
contributions
├── id (uuid, PK)
├── user_id (uuid, FK → profiles)
├── action (enum: submitted, edited, approved, rejected)
├── target_type (enum: document, collection, registry, color, wheel)
├── target_id (uuid)
├── target_title (text) -- denormalized for display
├── details (text, nullable)
├── created_at (timestamptz)
```

Powers public profile pages showing contribution history grouped by type.

---

## Moderation & Edit Suggestions

### Submission Queue (unified across all types)

```sql
submission_queue
├── id (uuid, PK)
├── type (enum: new_item, edit_suggestion, new_collection)
├── target_type (enum: document, collection, registry, color, wheel)
├── target_id (uuid, nullable) -- null for new items, set for edits
├── submitted_by (uuid, FK → profiles)
├── status (enum: pending, approved, rejected)
├── data (jsonb) -- full item data for new items, or proposed changes for edits
├── reviewer_notes (text, nullable)
├── reviewed_by (uuid, FK → profiles, nullable)
├── reviewed_at (timestamptz, nullable)
├── created_at (timestamptz)
```

### New Submission Flow

1. User fills out submission form
2. Row inserted into `submission_queue` with `type: new_item` and full data in `data`
3. If user is **trusted**: auto-approved — Postgres function creates the real row, logs contribution
4. If user is **new/contributor**: sits in queue as `pending`
5. Moderator/admin reviews, approves or rejects with optional notes
6. On approval: Postgres function creates real row, updates counters, recalculates trust, logs contribution

### Edit Suggestion Flow

1. User clicks "Suggest Edit" on an existing item
2. Form shows current data pre-filled, user makes changes
3. Row inserted into `submission_queue` with `type: edit_suggestion`, `target_id` set, `data` containing only changed fields as a diff:

```json
{
  "changes": {
    "color": { "from": "Tartan Red", "to": "Flame Red" },
    "year": { "from": 1967, "to": 1968 }
  },
  "reason": "Checked against heritage certificate - color was misidentified"
}
```

4. Moderator sees side-by-side: current values vs. proposed values
5. On approval: Postgres function applies changes to target row

---

## Storage

### Supabase Storage Buckets

```
CMDIY Supabase Storage
├── archive-documents/       # PDFs, scanned pages, diagrams
│   ├── manuals/
│   ├── adverts/
│   ├── catalogues/
│   ├── tuning/
│   └── electrical/
├── archive-thumbnails/      # Generated thumbnails for documents
├── wheels/                  # Wheel photos
├── colors/                  # Color swatch images
├── registry/                # Registry photos
└── avatars/                 # User profile images
```

Public read access on all archive buckets. Authenticated write access (uploads go through the submission system, so RLS on the queue table is the real gatekeeper).

---

## Unified Document Archive

The five separate document sections (manuals, adverts, catalogues, tuning, electrical) merge into a single filterable view.

### Route Structure

```
/archive                              → hub (4 sections: Documents, Registry, Colors, Wheels)
/archive/documents                    → unified document grid (filterable by type)
/archive/documents/[slug]             → standalone document detail
/archive/documents/collection/[slug]  → collection detail with listed items
/archive/documents/submit             → submit new document or collection
/archive/documents/[slug]/suggest-edit → suggest edit to existing item
/archive/registry                     → registry (unchanged)
/archive/colors                       → colors (unchanged)
/archive/wheels                       → wheels (unchanged)
```

### Unified Documents Page

- Grid of `DocumentCard` and `CollectionCard` components
- Type filter chips: All | Manuals | Adverts | Catalogues | Tuning | Electrical
- Search bar with full-text search
- Sort options (newest, oldest, title)
- Collections display with stacked card visual and item count badge

### Collection Page

- Lists all items in `sort_order` with individual download links
- "Add Edition to Collection" button for logged-in users (goes through mod queue)
- Credits all contributors who added items to the collection

### Redirect Strategy

**Static section-level redirects** (301, via `nuxt.config.ts` `routeRules`):

| Old Route             | New Route                            |
| --------------------- | ------------------------------------ |
| `/archive/manuals`    | `/archive/documents?type=manual`     |
| `/archive/adverts`    | `/archive/documents?type=advert`     |
| `/archive/catalogues` | `/archive/documents?type=catalogue`  |
| `/archive/tuning`     | `/archive/documents?type=tuning`     |
| `/archive/electrical` | `/archive/documents?type=electrical` |

**Dynamic individual document redirects**: Store `legacy_slug` on `archive_documents`. Server middleware catches old URLs (e.g., `/archive/manuals/akd4935`), looks up by legacy slug, issues 301 to new slug-based URL.

---

## Codebase Changes

### Removed

- `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`
- `@nuxt/content` module and `content.config.ts`
- `server/utils/dynamodb.ts`
- `server/utils/adminAuth.ts` and `server/api/auth/login.post.ts` (in-memory sessions)
- Env vars: `dynamo_id`, `dynamo_key`, `s3_id`, `s3_key`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

### Added

- `@supabase/supabase-js`
- `composables/useSupabase.ts` — CMDIY Supabase client
- `composables/useAuth.ts` — OAuth login flow against TME
- `composables/useArchive.ts` — CRUD for documents, collections
- `composables/useSubmissions.ts` — submission queue, edit suggestions
- `composables/useContributions.ts` — contribution history, trust levels
- `composables/useProfile.ts` — contributor profile management

### Rewritten

- All `server/api/registry/*` routes — DynamoDB → Supabase
- All `server/api/colors/*` routes — DynamoDB → Supabase
- All `server/api/wheels/*` routes — DynamoDB → Supabase
- `server/api/wheels/save/images.ts` — S3 → Supabase Storage
- All archive pages — Nuxt Content/DynamoDB → Supabase composables
- Admin pages — unified mod queue replaces per-type review pages
- `app/middleware/admin.global.ts` — Supabase Auth replaces cookie verify

### New Pages

- `/login` — "Sign in with Classic Mini DIY" OAuth button
- `/profile` — public contributor profile with stats and contribution list
- `/profile/edit` — edit display name, avatar, bio
- `/submissions` — user's submission history with status tracking
- `/archive/documents` — unified document archive with filtering
- `/archive/documents/[slug]` — document detail page
- `/archive/documents/collection/[slug]` — collection detail page
- `/archive/documents/submit` — document submission form
- `/archive/documents/[slug]/suggest-edit` — edit suggestion form
- `/admin/queue` — unified mod queue
- `/admin/users` — user management with trust level controls

### New Components

- `DocumentCard.vue` — single document card for grid
- `CollectionCard.vue` — stacked/badged card for collections
- `DocumentDetail.vue` — standalone document detail view
- `CollectionDetail.vue` — collection view with listed items
- `DocumentSubmitForm.vue` — new document submission form

---

## Implementation Phases

### Phase 1: Foundation (no visible changes to live site)

- Create CMDIY Supabase project
- Create all tables with RLS policies
- Create storage buckets
- Enable OAuth 2.1 server on TME's Supabase, register CMDIY as client

### Phase 2: Migration Scripts

- DynamoDB → Supabase (registry, colors, wheels + queue tables)
- S3 → Supabase Storage (wheel photos, color swatches)
- GitHub archive repo → Supabase (parse markdown, upload files, create documents, auto-detect collections)
- Generate slugs from existing identifiers
- Verify data integrity

### Phase 3: Auth Integration

- Add `@supabase/supabase-js` to CMDIY
- Build `useAuth` composable (OAuth flow against TME)
- Build `useSupabase` composable (CMDIY project client)
- Update `admin.global.ts` middleware
- Build login page
- Remove old in-memory auth system

### Phase 4: Rewrite Archive Data Layer

- Replace all DynamoDB API routes with Supabase queries
- Replace Nuxt Content calls with Supabase queries
- Replace S3 uploads with Supabase Storage
- Remove AWS SDK packages and `@nuxt/content` module
- All existing pages continue working, just different data source

### Phase 5: Unified Document Archive

- Build unified `/archive/documents` page with type filtering, search, sort
- Build `DocumentCard` and `CollectionCard` components
- Build document detail and collection detail pages (slug-based URLs)
- Update `/archive` hub to 4-section layout
- Set up 301 redirects (static route rules + legacy slug catch-all)

### Phase 6: Contribution System

- Build submission forms (new documents, registry entries, etc.)
- Build `useSubmissions` composable
- Build "Suggest Edit" flow with diff-based proposals
- Build contributor profile pages and `useContributions` composable
- Implement trust level calculation (Postgres triggers)

### Phase 7: Moderation

- Build unified admin mod queue (`/admin/queue`)
- Side-by-side diff view for edit suggestions
- Approve/reject with reviewer notes
- User management with trust level controls
- Notification to submitters on approval/rejection

### Phase 8: Cleanup

- Verify all old URLs redirect correctly
- Remove all AWS SDK dependencies
- Remove `content.config.ts`
- Clean up unused env vars
- 30-day observation period
