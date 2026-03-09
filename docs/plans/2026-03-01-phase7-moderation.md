# Phase 7: Moderation System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified admin moderation queue that replaces the 3 separate per-type review pages, adds side-by-side diff view for edit suggestions, reviewer notes, user management with trust level controls, and submitter email notifications on approval/rejection.

**Architecture:** One unified `/admin/queue` page queries all submission types from `submission_queue` table via new server API routes (admin-only, service_role key). Existing per-type review pages kept as deep-links. User management page queries `profiles` table with trust level update support. Email notifications sent via existing email utility pattern.

**Tech Stack:** Nuxt 4.3.1, @supabase/supabase-js, Nuxt UI 4.4.0, TypeScript, daisyUI 5.0

**Repo:** Classic Mini DIY (`/Users/colegentry/Development/classicminidiy`)

---

## Context

Phase 6 built the contribution system: submission forms, `useSubmissions` composable, edit suggestion flow, contributor profiles, and trust level integration. The `submission_queue` table already stores all submission types (document, registry, color, wheel) with status, reviewer_notes, reviewed_by, and reviewed_at fields.

Currently the admin has 3 separate review pages (`/admin/colors/review`, `/admin/wheels/review`, `/admin/registry/review`) with duplicated code patterns. Each page:

- Fetches its own type-specific list via dedicated API routes
- Uses inline editing with approve/reject buttons
- Has a rejection confirmation modal (but NO reviewer notes field)
- Maps Supabase status to legacy P/A/R status codes

Phase 7 unifies these into a single queue page while keeping the per-type pages as optional deep-links.

**Key existing files:**

- `server/utils/adminAuth.ts` — `requireAdminAuth()` and `getServiceClient()`
- `server/utils/supabase.ts` — `getServiceClient()` for Supabase service_role client
- `server/api/admin/queue/count.ts` — existing pending count endpoint
- `app/composables/useSubmissions.ts` — client-side submission types/interfaces
- `app/composables/useAuth.ts` — UserProfile with trust_level fields
- `app/pages/admin/index.vue` — dashboard with stat cards
- `data/models/generic.ts` — `BREADCRUMB_VERSIONS`, `HERO_TYPES`

---

## Task 1: Create Unified Queue API Routes

**Files:**

- Create: `server/api/admin/queue/list.ts`
- Create: `server/api/admin/queue/approve.post.ts`
- Create: `server/api/admin/queue/reject.post.ts`

**Step 1: Create `server/api/admin/queue/list.ts`**

Lists all submissions from `submission_queue` with optional filtering by target_type and status. Joins profile display_name for submitter info.

```typescript
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);

  const targetType = query.targetType?.toString();
  const status = query.status?.toString() || 'pending';

  let q = supabase
    .from('submission_queue')
    .select('*, profiles!submission_queue_submitted_by_fkey(display_name, email, avatar_url, trust_level)')
    .order('created_at', { ascending: false });

  if (status !== 'all') q = q.eq('status', status);
  if (targetType) q = q.eq('target_type', targetType);

  const { data, error } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return (data || []).map((item: any) => ({
    id: item.id,
    type: item.type,
    targetType: item.target_type,
    targetId: item.target_id,
    status: item.status,
    data: item.data,
    reviewerNotes: item.reviewer_notes,
    reviewedAt: item.reviewed_at,
    createdAt: item.created_at,
    submittedBy: item.submitted_by,
    submitterName: item.profiles?.display_name || item.profiles?.email || 'Unknown',
    submitterEmail: item.profiles?.email || null,
    submitterAvatar: item.profiles?.avatar_url || null,
    submitterTrustLevel: item.profiles?.trust_level || 'new',
  }));
});
```

**Step 2: Create `server/api/admin/queue/approve.post.ts`**

Generic approve endpoint. Based on `target_type`, inserts the approved item into the correct table (colors, wheels, registry_entries, archive_documents), then updates `submission_queue` status.

```typescript
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { id, reviewerNotes, editedData } = body;

  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing submission id' });
  }

  // Fetch the submission
  const { data: submission, error: fetchError } = await supabase
    .from('submission_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !submission) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' });
  }

  const itemData = editedData || submission.data;

  // For new_item submissions, insert into the appropriate table
  if (submission.type === 'new_item') {
    const insertError = await insertApprovedItem(supabase, submission.target_type, itemData);
    if (insertError) {
      throw createError({ statusCode: 500, statusMessage: insertError });
    }
  }

  // For edit_suggestion submissions, apply the changes to the target
  if (submission.type === 'edit_suggestion' && submission.target_id) {
    const applyError = await applyEditSuggestion(supabase, submission.target_type, submission.target_id, itemData);
    if (applyError) {
      throw createError({ statusCode: 500, statusMessage: applyError });
    }
  }

  // Update submission status
  const { error: updateError } = await supabase
    .from('submission_queue')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
      data: editedData || submission.data,
    })
    .eq('id', id);

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  return { success: true };
});

// Helper: insert approved item into the correct table
async function insertApprovedItem(supabase: any, targetType: string, data: any): Promise<string | null> {
  let error;

  switch (targetType) {
    case 'color':
      ({ error } = await supabase.from('colors').insert({
        name: data.name,
        code: data.code || '',
        short_code: data.shortCode || data.short_code || '',
        ditzler_ppg_code: data.ditzlerPpgCode || data.ditzler_ppg_code || '',
        dulux_code: data.duluxCode || data.dulux_code || '',
        hex_value: data.primaryColor || data.hex_value || '',
        has_swatch: data.hasSwatch || data.has_swatch || false,
        swatch_path: data.imageSwatch || data.swatch_path || null,
        contributor_images: data.images || data.contributor_images || [],
        status: 'approved',
        legacy_submitted_by: data.submittedBy || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.submittedByEmail || data.legacy_submitted_by_email || null,
      }));
      break;

    case 'wheel':
      ({ error } = await supabase.from('wheels').insert({
        name: data.name || '',
        wheel_type: data.type || data.wheel_type || '',
        size: parseInt(data.size) || 10,
        width: data.width || '',
        offset_value: data.offset || data.offset_value || '',
        bolt_pattern: data.boltPattern || data.bolt_pattern || null,
        center_bore: data.centerBore || data.center_bore || null,
        manufacturer: data.manufacturer || null,
        weight: data.weight || null,
        notes: data.notes || null,
        photos: data.photos || (data.images || []).map((img: any) => img.src || img),
        status: 'approved',
        legacy_submitted_by: data.userName || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.emailAddress || data.legacy_submitted_by_email || null,
      }));
      break;

    case 'registry':
      ({ error } = await supabase.from('registry_entries').insert({
        year: data.year || 0,
        model: data.model || '',
        body_number: data.bodyNum || data.body_number || '',
        engine_number: data.engineNum || data.engine_number || '',
        engine_size: data.engineSize || data.engine_size || null,
        body_type: data.bodyType || data.body_type || null,
        color: data.color || null,
        trim: data.trim || null,
        build_date: data.buildDate || data.build_date || null,
        owner: data.owner || null,
        location: data.location || null,
        notes: data.notes || null,
        status: 'approved',
        legacy_submitted_by: data.submittedBy || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.submittedByEmail || data.legacy_submitted_by_email || null,
      }));
      break;

    case 'document':
      ({ error } = await supabase.from('archive_documents').insert({
        slug: (data.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        type: data.type || 'manual',
        title: data.title || '',
        description: data.description || null,
        code: data.code || null,
        author: data.author || null,
        year: data.year || null,
        file_path: data.filePath || data.file_path || null,
        thumbnail_path: data.thumbnailPath || data.thumbnail_path || null,
        status: 'approved',
      }));
      break;

    default:
      return `Unsupported target type: ${targetType}`;
  }

  return error?.message || null;
}

// Helper: apply edit suggestion changes to the target item
async function applyEditSuggestion(
  supabase: any,
  targetType: string,
  targetId: string,
  data: any
): Promise<string | null> {
  const changes = data.changes;
  if (!changes || typeof changes !== 'object') return 'No changes provided';

  // Build update object from the diff
  const updates: Record<string, any> = {};
  for (const [field, diff] of Object.entries(changes)) {
    if (diff && typeof diff === 'object' && 'to' in (diff as any)) {
      updates[field] = (diff as any).to;
    }
  }

  if (Object.keys(updates).length === 0) return null;

  const tableMap: Record<string, string> = {
    color: 'colors',
    wheel: 'wheels',
    registry: 'registry_entries',
    document: 'archive_documents',
  };

  const table = tableMap[targetType];
  if (!table) return `Unsupported target type: ${targetType}`;

  const { error } = await supabase.from(table).update(updates).eq('id', targetId);
  return error?.message || null;
}
```

**Step 3: Create `server/api/admin/queue/reject.post.ts`**

Generic reject endpoint with reviewer notes.

```typescript
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { id, reviewerNotes } = body;

  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing submission id' });
  }

  const { error } = await supabase
    .from('submission_queue')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
    })
    .eq('id', id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});
```

**Step 4: Commit**

---

## Task 2: Create Unified Queue Page

**Files:**

- Create: `app/pages/admin/queue.vue`

**Step 1: Build the unified queue page**

This page replaces navigating to 3 separate review pages. It shows all submissions in a card-based layout with:

- Filter chips: All | Documents | Registry | Colors | Wheels
- Status filter: Pending (default) | Approved | Rejected | All
- Each submission card shows: type badge, target type badge, submitter info, date, data preview, action buttons
- For `new_item` submissions: expandable detail view showing all submitted fields
- For `edit_suggestion` submissions: side-by-side diff view (current vs. proposed)
- Approve button opens modal with optional reviewer notes textarea
- Reject button opens modal with optional reviewer notes textarea

The page fetches from `/api/admin/queue/list` with query params for filtering.

Key UI elements:

- `UBadge` for type/target/status badges
- `UCard` for each submission item
- `UModal` for approve/reject with reviewer notes `UTextarea`
- Type badge colors: document→accent, registry→primary, color→warning, wheel→secondary
- Status badge colors: pending→warning, approved→success, rejected→error
- Submission type labels: new_item→"New", edit_suggestion→"Edit Suggestion", new_collection→"New Collection"

For edit suggestions, the diff view should show:

```
Field Name    | Current Value | Proposed Value
──────────────┼───────────────┼──────────────
color         | Tartan Red    | Flame Red ←(highlighted)
year          | 1967          | 1968 ←(highlighted)
```

Use a two-column layout inside a `UCard` with `bg-error/5` for "from" values and `bg-success/5` for "to" values.

**Step 2: Commit**

---

## Task 3: Create User Management API Routes

**Files:**

- Create: `server/api/admin/users/list.ts`
- Create: `server/api/admin/users/update-trust.post.ts`

**Step 1: Create `server/api/admin/users/list.ts`**

Lists all users from `profiles` table with trust level, submission stats, and admin status. Supports search by display_name/email and filtering by trust level.

```typescript
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);

  const search = query.search?.toString();
  const trustLevel = query.trustLevel?.toString();
  const limit = parseInt(query.limit?.toString() || '50');
  const offset = parseInt(query.offset?.toString() || '0');

  let q = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (trustLevel && trustLevel !== 'all') q = q.eq('trust_level', trustLevel);
  if (search) q = q.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error, count } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return {
    users: data || [],
    total: count || 0,
  };
});
```

**Step 2: Create `server/api/admin/users/update-trust.post.ts`**

Allows admin to manually set a user's trust level. Only admin can promote to moderator/admin.

```typescript
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { userId, trustLevel } = body;

  if (!userId || typeof userId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' });
  }

  const validLevels = ['new', 'contributor', 'trusted', 'moderator', 'admin'];
  if (!validLevels.includes(trustLevel)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid trust level' });
  }

  const updates: Record<string, any> = { trust_level: trustLevel };
  if (trustLevel === 'admin') updates.is_admin = true;
  if (trustLevel !== 'admin') updates.is_admin = false;

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});
```

**Step 3: Commit**

---

## Task 4: Create User Management Page

**Files:**

- Create: `app/pages/admin/users.vue`

**Step 1: Build the user management page**

Admin page showing all users with:

- Search bar for display name / email
- Trust level filter chips: All | New | Contributor | Trusted | Moderator | Admin
- Table/card layout showing: avatar, display name, email, trust level badge, submission counts (total/approved/rejected), joined date
- Trust level dropdown per user to promote/demote
- Confirmation modal when changing trust level
- Pagination (50 per page)

Trust level badge colors:

- new → neutral
- contributor → info
- trusted → success
- moderator → warning
- admin → primary

The page fetches from `/api/admin/users/list` and uses `/api/admin/users/update-trust` for trust level changes.

**Step 2: Commit**

---

## Task 5: Update Admin Dashboard

**Files:**

- Modify: `app/pages/admin/index.vue`

**Step 1: Add unified queue link and users link**

Update the admin dashboard to:

1. Add a "Moderation Queue" card that links to `/admin/queue` (replace or supplement the individual type cards)
2. Add a "User Management" card linking to `/admin/users`
3. Keep existing per-type cards as secondary deep-links
4. Update the Quick Stats to show total pending across all types (use existing `/api/admin/queue/count` without targetType)

**Step 2: Commit**

---

## Task 6: Build & Verify

**Step 1: Run `bun run build`** in `/Users/colegentry/Development/classicminidiy`

Verify no TypeScript errors, no missing imports, clean build.

**Step 2: Commit any fixes**

---

## Verification

1. `/admin/queue` — Shows all pending submissions across all types. Filter by type works. Status filter works.
2. Click approve on a new_item submission — modal with reviewer notes appears. Approve inserts into correct table, updates submission status.
3. Click reject — modal with reviewer notes appears. Reject updates status, stores notes.
4. Edit suggestion submissions show side-by-side diff view with current vs. proposed values highlighted.
5. `/admin/users` — Lists all users with trust levels. Search by name/email works. Trust level filter works.
6. Change a user's trust level — updates immediately, confirmation modal shown first.
7. Dashboard shows unified queue card and users card. Stats reflect total pending count.
8. Existing per-type review pages still work (not removed).
9. Build passes cleanly.
