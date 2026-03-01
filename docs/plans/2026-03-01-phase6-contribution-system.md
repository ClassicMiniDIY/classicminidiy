# Phase 6: Contribution System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the community contribution system — authenticated submission forms, user submission tracking, "Suggest Edit" flow, contributor profiles, and trust level display. This replaces the anonymous name/email submission pattern with auth-linked submissions.

**Architecture:** Submissions insert into `submission_queue` via client composables (RLS grants INSERT to `authenticated`). Users can view their own submissions (RLS grants SELECT on own rows). Contributor profiles are public (RLS grants public SELECT on `profiles` and `contributions`). Trust levels are auto-calculated by existing Postgres triggers. Admin approval routes use service_role key (already built in Phase 4).

**Tech Stack:** Nuxt 4.3.1, @supabase/supabase-js, Nuxt UI 4.4.0, i18n, TypeScript

**Repo:** Classic Mini DIY (`/Users/colegentry/Development/classicminidiy`)

---

## Context

Phase 1 created the database infrastructure — `submission_queue`, `contributions`, `profiles` (with `trust_level`, `total_submissions`, `approved_submissions`, `rejected_submissions` columns), trust level triggers, and contribution logging triggers. Phase 4 rewrote the data layer with Supabase composables. Phase 5 unified the document archive.

**What exists:**
- `submission_queue` table with RLS: authenticated users INSERT own rows, SELECT own rows, admins/moderators can UPDATE (review)
- `contributions` table with RLS: public SELECT, admin INSERT
- `profiles` table has `trust_level` (enum: new/contributor/trusted/moderator/admin), `total_submissions`, `approved_submissions`, `rejected_submissions`
- Trust triggers: `handle_submission_approved()` fires on `submission_queue` UPDATE — logs contribution, updates counters, recalculates trust level
- `useAuth()` composable fetches `is_admin, display_name, email, avatar_url` from profiles
- Existing submit methods: `useColors().submitColor()`, `useWheels().submitWheel()`, `useRegistry().submitRegistryEntry()` — all insert into `submission_queue` but pass submitter as plain text in `data` jsonb
- Existing contribution forms: `/archive/colors/contribute` (anonymous name/email), `/archive/wheels/submit` (shell), `/archive/registry/pending` (read-only list)
- Admin review pages: `/admin/colors/review`, `/admin/wheels/review`, `/admin/registry/review` — fully functional
- `server/utils/adminAuth.ts` has `getServiceClient()` and `requireAdminAuth()`

**What needs building:**
- `useSubmissions` composable — list user's own submissions, submit new items, submit edit suggestions
- `useContributions` composable — query contribution history for a user
- Update `useAuth()` to include trust level fields in profile
- Document submission form (`/archive/documents/submit`)
- Edit suggestion flow (`/archive/documents/[slug]/suggest-edit`)
- User submissions page (`/submissions`)
- Contributor profile page (`/contributors/[id]`)
- Update existing submit forms to use authenticated user identity
- Update admin dashboard to show document queue counts

**Critical file references:**
- `app/composables/useAuth.ts:26` — `fetchUserProfile` SELECT only fetches 4 fields, needs trust level fields added
- `app/composables/useColors.ts` — `submitColor()` puts `submittedBy`/`submittedByEmail` in `data` jsonb
- `app/composables/useWheels.ts` — `submitWheel()` same pattern
- `app/composables/useRegistry.ts` — `submitRegistryEntry()` same pattern
- `app/composables/useArchiveDocuments.ts` — no submit methods yet
- `app/pages/archive/colors/contribute.vue` — collects name/email in form, calls `submitColor()`
- `server/utils/adminAuth.ts` — has `getServiceClient()` and `requireAdminAuth()`
- Supabase migrations: `20260301000008_create_contributions.sql`, `20260301000009_create_submission_queue.sql`, `20260301000010_create_trust_functions.sql`, `20260301000002_add_archive_profile_fields.sql`

---

## Task 1: Update useAuth to Include Trust Level Fields

**Files:**
- Modify: `app/composables/useAuth.ts`

**Step 1: Extend UserProfile interface and fetchUserProfile query**

The `UserProfile` interface currently has 4 fields. Add trust level and submission counter fields:

```typescript
interface UserProfile {
  is_admin: boolean;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  trust_level: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
  total_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
}
```

Update the `fetchUserProfile` SELECT query at line 26:

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('is_admin, display_name, email, avatar_url, trust_level, total_submissions, approved_submissions, rejected_submissions')
  .eq('id', userId)
  .single();
```

**Step 2: Commit**

---

## Task 2: Create useSubmissions Composable

**Files:**
- Create: `app/composables/useSubmissions.ts`

**Step 1: Write the composable**

Provides methods for users to view their own submissions, submit new items across all target types, and submit edit suggestions.

```typescript
export interface SubmissionItem {
  id: string;
  type: 'new_item' | 'edit_suggestion' | 'new_collection';
  targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel';
  targetId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, any>;
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const useSubmissions = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  const mapToSubmission = (row: any): SubmissionItem => ({
    id: row.id,
    type: row.type,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    data: row.data || {},
    reviewerNotes: row.reviewer_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  });

  // List current user's submissions
  const listMySubmissions = async (opts?: {
    status?: 'pending' | 'approved' | 'rejected';
    targetType?: string;
  }): Promise<SubmissionItem[]> => {
    if (!user.value) return [];

    let query = supabase
      .from('submission_queue')
      .select('*')
      .eq('submitted_by', user.value.id)
      .order('created_at', { ascending: false });

    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.targetType) query = query.eq('target_type', opts.targetType);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToSubmission);
  };

  // Submit a new item (generic — works for any target type)
  const submitNewItem = async (
    targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel',
    itemData: Record<string, any>,
  ): Promise<SubmissionItem> => {
    if (!user.value) throw new Error('Must be authenticated to submit');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: targetType,
        submitted_by: user.value.id,
        status: 'pending',
        data: itemData,
      })
      .select()
      .single();

    if (error) throw error;
    return mapToSubmission(data);
  };

  // Submit an edit suggestion for an existing item
  const submitEditSuggestion = async (
    targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel',
    targetId: string,
    changes: Record<string, { from: any; to: any }>,
    reason: string,
  ): Promise<SubmissionItem> => {
    if (!user.value) throw new Error('Must be authenticated to suggest edits');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'edit_suggestion',
        target_type: targetType,
        target_id: targetId,
        submitted_by: user.value.id,
        status: 'pending',
        data: { changes, reason },
      })
      .select()
      .single();

    if (error) throw error;
    return mapToSubmission(data);
  };

  // Get a single submission by ID (user can only see their own via RLS)
  const getSubmission = async (id: string): Promise<SubmissionItem | null> => {
    const { data, error } = await supabase
      .from('submission_queue')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapToSubmission(data);
  };

  return { listMySubmissions, submitNewItem, submitEditSuggestion, getSubmission };
};
```

**Step 2: Commit**

---

## Task 3: Create useContributions Composable

**Files:**
- Create: `app/composables/useContributions.ts`

**Step 1: Write the composable**

Queries the public `contributions` table for displaying contribution history on contributor profile pages.

```typescript
export interface ContributionItem {
  id: string;
  action: 'submitted' | 'edited' | 'approved' | 'rejected';
  targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel';
  targetId: string;
  targetTitle: string | null;
  details: string | null;
  createdAt: string;
}

export interface ContributorProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  trustLevel: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
  totalSubmissions: number;
  approvedSubmissions: number;
  joinedAt: string;
}

export const useContributions = () => {
  const supabase = useSupabase();

  const mapToContribution = (row: any): ContributionItem => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetTitle: row.target_title,
    details: row.details,
    createdAt: row.created_at,
  });

  // Get public contributor profile
  const getContributorProfile = async (userId: string): Promise<ContributorProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, trust_level, total_submissions, approved_submissions, joined_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      trustLevel: data.trust_level,
      totalSubmissions: data.total_submissions,
      approvedSubmissions: data.approved_submissions,
      joinedAt: data.joined_at || data.created_at,
    };
  };

  // Get contribution history for a user
  const listContributions = async (
    userId: string,
    opts?: { targetType?: string; limit?: number },
  ): Promise<ContributionItem[]> => {
    let query = supabase
      .from('contributions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (opts?.targetType) query = query.eq('target_type', opts.targetType);
    if (opts?.limit) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToContribution);
  };

  // Get contribution counts grouped by target type
  const getContributionStats = async (userId: string): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from('contributions')
      .select('target_type')
      .eq('user_id', userId)
      .eq('action', 'approved');

    if (error) throw error;

    const stats: Record<string, number> = {};
    for (const row of data || []) {
      stats[row.target_type] = (stats[row.target_type] || 0) + 1;
    }
    return stats;
  };

  return { getContributorProfile, listContributions, getContributionStats };
};
```

**Step 2: Commit**

---

## Task 4: Add Document Submit Method to useArchiveDocuments

**Files:**
- Modify: `app/composables/useArchiveDocuments.ts`

**Step 1: Add submitDocument method**

Add a method for submitting new archive documents via the submission queue:

```typescript
// Add inside the useArchiveDocuments function, before the return statement:

const submitDocument = async (documentData: {
  type: 'manual' | 'advert' | 'catalogue' | 'tuning' | 'electrical';
  title: string;
  description?: string;
  code?: string;
  author?: string;
  year?: number;
  filePath?: string;
  thumbnailPath?: string;
}): Promise<{ id: string }> => {
  const { user } = useAuth();
  if (!user.value) throw new Error('Must be authenticated to submit');

  const { data, error } = await supabase
    .from('submission_queue')
    .insert({
      type: 'new_item',
      target_type: 'document',
      submitted_by: user.value.id,
      status: 'pending',
      data: documentData,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
};
```

Update the return statement to include `submitDocument`:

```typescript
return { listByType, listAll, listCollections, getByPath, getDocumentBySlug, getCollectionBySlug, getStorageUrl, getThumbnailUrl, submitDocument };
```

**Step 2: Commit**

---

## Task 5: Build Document Submission Page

**Files:**
- Create: `app/pages/archive/documents/submit.vue`

**Step 1: Build the page**

Auth-gated form for submitting new archive documents. Requires the user to be authenticated (redirect to `/login` if not). Fields: type (dropdown: manual/advert/catalogue/tuning/electrical), title (required), description, code (part number/identifier), author, year, file URL (text input for now — file upload via Supabase Storage is a Phase 7 enhancement). On submit, calls `useSubmissions().submitNewItem('document', data)`. Shows success state with submission ID after submission.

**Key patterns to follow from** `app/pages/archive/colors/contribute.vue`:
- Hero component with archive type
- Breadcrumb navigation
- UCard with form inside
- Form validation before submit
- Processing/loading state on submit button
- Success state with submission ID display and "Make Another" button
- Error alert with UAlert
- i18n with 10 locale blocks
- SEO: `useHead()`, `useSeoMeta()`
- Uses `useAuth()` for authentication check — if not authenticated, show a login prompt instead of the form

**Differences from colors/contribute:**
- No "submittedBy" / "submittedByEmail" text fields — we use the authenticated user's identity
- Type selector dropdown (manual, advert, catalogue, tuning, electrical)
- Different form fields (title, description, code, author, year)
- Calls `useSubmissions().submitNewItem('document', {...})` instead of domain-specific submit method

**Step 2: Commit**

---

## Task 6: Build Edit Suggestion Page

**Files:**
- Create: `app/pages/archive/documents/[slug]/suggest-edit.vue`

**Step 1: Build the page**

Auth-gated page for suggesting edits to existing archive documents. Loads the current document via `useArchiveDocuments().getDocumentBySlug(slug)`, displays current values as read-only, and provides editable fields alongside. Only changed fields are submitted. Requires a reason/explanation text field.

**Layout:**
- Hero + breadcrumbs
- Two-column layout: left shows current values (read-only UCard), right shows the edit form
- Form pre-fills with current values
- On submit: compares current vs. proposed, builds `changes` diff object (`{ fieldName: { from: oldVal, to: newVal } }`), and calls `useSubmissions().submitEditSuggestion('document', documentId, changes, reason)`
- Success state with submission ID

**Edge cases:**
- If document not found: show 404-style message
- If no changes detected: show warning, don't submit
- If not authenticated: show login prompt

**Step 2: Commit**

---

## Task 7: Build User Submissions Page

**Files:**
- Create: `app/pages/submissions/index.vue`

**Step 1: Build the page**

Auth-gated page showing the current user's submission history with status tracking. Uses `useSubmissions().listMySubmissions()`.

**Layout:**
- Hero + breadcrumb
- Status filter chips: All | Pending | Approved | Rejected
- Type filter chips: All | Documents | Registry | Colors | Wheels
- List of submissions as UCard items, each showing:
  - Submission type badge (new_item / edit_suggestion)
  - Target type badge (document / registry / color / wheel)
  - Title from `data.title` or `data.name` (depends on type)
  - Status badge (pending=warning, approved=success, rejected=error)
  - Date submitted (relative time)
  - Reviewer notes (if any, shown for approved/rejected items)
- Empty state: "No submissions yet. Start contributing to the archive!"
- Link to each section's contribute page

**Step 2: Commit**

---

## Task 8: Build Contributor Profile Page

**Files:**
- Create: `app/pages/contributors/[id].vue`

**Step 1: Build the page**

Public page showing a contributor's profile, trust level, stats, and contribution history. Uses `useContributions().getContributorProfile()` and `useContributions().listContributions()`.

**Layout:**
- Hero + breadcrumb
- Profile card: avatar, display name, trust level badge, bio
- Stats row: total submissions, approved count, member since
- Trust level badge with visual indicator:
  - new → neutral badge
  - contributor → info badge
  - trusted → success badge
  - moderator → warning badge
  - admin → primary badge
- Contribution history: list of approved contributions grouped by type
  - Each shows: action, target type icon, target title (linked if document/color/wheel), date
- Empty state if no contributions yet

**Step 2: Commit**

---

## Task 9: Update Existing Submit Forms to Use Auth

**Files:**
- Modify: `app/composables/useColors.ts` — update `submitColor()` to use `user.value.id` as `submitted_by`
- Modify: `app/composables/useWheels.ts` — update `submitWheel()` to use `user.value.id` as `submitted_by`
- Modify: `app/composables/useRegistry.ts` — update `submitRegistryEntry()` to use `user.value.id` as `submitted_by`
- Modify: `app/pages/archive/colors/contribute.vue` — remove name/email fields, require auth

**Step 1: Update composable submit methods**

Each composable's submit method currently does NOT set `submitted_by` (the FK field) — it stores the submitter's name and email inside the `data` jsonb blob. The `submission_queue` table requires `submitted_by` as a non-null FK to `profiles.id`.

Update each submit method to set `submitted_by: user.value.id` instead of putting name/email in data. Keep the data blob for the actual item content only.

**useColors.ts — submitColor():**
```typescript
const submitColor = async (colorData: Partial<Color>) => {
  const { user } = useAuth();
  if (!user.value) throw new Error('Must be authenticated to submit');

  const { data, error } = await supabase.from('submission_queue').insert({
    type: 'new_item',
    target_type: 'color',
    submitted_by: user.value.id,
    status: 'pending',
    data: colorData,
  }).select().single();
  if (error) throw error;
  return data;
};
```

Same pattern for `useWheels.submitWheel()` and `useRegistry.submitRegistryEntry()`.

**Step 2: Update colors contribute page**

- Remove the `submittedBy` and `submittedByEmail` form fields and validation
- Add auth check: if `!isAuthenticated`, show a "Sign in to contribute" card with login button instead of the form
- Update the `submit()` function: call `submitColor(colorData)` without name/email params
- The user's identity is now captured automatically via `submitted_by` FK in the composable

**Step 3: Commit**

---

## Task 10: Update Admin Dashboard for Documents Queue

**Files:**
- Modify: `app/pages/admin/index.vue`

**Step 1: Add document submission count to dashboard**

The admin dashboard currently shows pending counts for registry, wheels, and colors. Add a document submissions card. Fetch pending document submissions via `useFetch('/api/admin/queue/list?targetType=document')` or add a new simple server route.

Since the admin review routes already exist for colors/wheels/registry but NOT for documents, and Phase 7 will build the unified admin queue, for now just add a count display card that shows how many pending document submissions exist. Use an inline `useAsyncData` with the service client via a new simple server API route.

**Create: `server/api/admin/queue/count.ts`**

```typescript
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);
  const targetType = query.targetType?.toString();

  let q = supabase
    .from('submission_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (targetType) q = q.eq('target_type', targetType);

  const { count, error } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return { count: count || 0 };
});
```

**Update admin/index.vue:** Add a "Documents Queue" card alongside the existing three, showing the pending count from this new endpoint. Link it to `/archive/documents` for now (Phase 7 will build the proper admin review page for documents).

**Step 2: Commit**

---

## Task 11: Build + Verify

**Step 1: Run build**

```bash
cd /Users/colegentry/Development/classicminidiy && bun run build
```

Fix any build errors (import paths, TypeScript issues).

**Step 2: Verification checklist**

1. **Auth profile:** `useAuth().userProfile` now includes `trust_level`, `total_submissions`, etc.
2. **Document submission:** Visit `/archive/documents/submit` — form loads when authenticated, redirects to login when not. Submit a document — appears in `submission_queue`.
3. **Edit suggestion:** Visit `/archive/documents/[slug]/suggest-edit` — current values display, form allows changes, submission creates an `edit_suggestion` row.
4. **User submissions:** Visit `/submissions` — shows current user's submission history with status tracking.
5. **Contributor profile:** Visit `/contributors/[id]` — shows public profile with trust level and contribution history.
6. **Colors contribute:** `/archive/colors/contribute` now requires authentication (no more name/email fields). Submit a color — `submitted_by` FK is set correctly.
7. **Admin dashboard:** `/admin` shows document queue count alongside existing counts.

**Step 3: Commit final fixes if any**

---

## Scope Notes

**Deferred to Phase 7 (Moderation):**
- Unified admin moderation queue (`/admin/queue`) with side-by-side diff view
- Admin document review page
- Reviewer notes UI
- User trust level management (promote/demote)
- Notification to submitters on approval/rejection

**Deferred to later:**
- File upload via Supabase Storage in submission form (currently text URL input)
- Profile edit page (`/profile/edit`) — users can edit display name, avatar, bio
- Auto-approval for trusted users (trigger exists but UI doesn't surface it)
