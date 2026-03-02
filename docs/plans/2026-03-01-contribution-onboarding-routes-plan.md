# Contribution System, Onboarding & Route Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify all archive contribution flows under `/contribute`, add first-time user onboarding with unified account messaging, add profile editing, and clean up route inconsistencies.

**Architecture:** New top-level `/contribute` hub with type-specific form pages. `/welcome` page for first-time users detected via null `display_name`. Profile editing via `/profile/edit` on the shared Supabase `profiles` table. Inline suggest-edit modals on detail pages replace the separate route. 301 redirects from old submission paths.

**Tech Stack:** Nuxt 4 / Vue 3 / Nuxt UI / Supabase / i18n (10 locales) / PostHog analytics

**Design doc:** `docs/plans/2026-03-01-contribution-onboarding-routes-design.md`

---

## Conventions

All pages in this project follow these patterns. Follow them exactly:

- **Hero:** `<hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />`
- **Breadcrumb:** `<breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />`
- **Auth gate:** `<div v-if="!isAuthenticated">` → UCard with lock icon + "Sign In" UButton to `/login` → `</div><div v-else>` → actual content
- **PatreonCard:** `<patreon-card size="large" />` at bottom of public pages
- **SEO:** `useHead()` for title/meta, `useSeoMeta()` for OG tags, `noindex nofollow` on auth-gated pages
- **i18n:** Inline `<i18n lang="json">` block with 10 locales: en, es, fr, it, de, pt, ru, ja, zh, ko. For pages in the archive section, some use: en, de, es, fr, it, pt, nl, sv, da, no. Match the pattern of sibling pages in the same directory.
- **Icons:** Font Awesome Duotone in templates (`<i class="fad fa-*">`), Iconify in Nuxt UI props (`icon="i-fa6-solid-*"`)
- **Imports:** `import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../data/models/generic'` (adjust path depth)
- **Analytics:** `const { capture } = usePostHog()` for user actions

---

## Task 1: Add 301 Redirects in nuxt.config.ts

**Files:**
- Modify: `nuxt.config.ts` (routeRules section, around line 127)

**Step 1: Add redirect rules**

Add these 3 redirects to the `routeRules` object in `nuxt.config.ts`, alongside the existing archive redirects:

```ts
'/archive/documents/submit': { redirect: { to: '/contribute/document', statusCode: 301 } },
'/archive/colors/contribute': { redirect: { to: '/contribute/color', statusCode: 301 } },
'/archive/wheels/submit': { redirect: { to: '/contribute/wheel', statusCode: 301 } },
```

**Step 2: Update sitemap excludes**

In the sitemap config section, replace these excludes:
- `/archive/colors/contribute` → `/contribute/**`
- `/archive/wheels/submit` → (already covered by above glob)

Add `/welcome`, `/profile/**` to sitemap excludes as well (auth-gated pages).

**Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "feat: add 301 redirects for old submission routes to /contribute/*"
```

---

## Task 2: Create Welcome Page

**Files:**
- Create: `app/pages/welcome.vue`

**Step 1: Create the welcome page**

Create `app/pages/welcome.vue`. This page:
- Requires authentication (redirect to `/login` if not)
- Shows unified account explanation (classicminidiy.com + theminiexchange.com)
- Optional profile setup form (display_name, avatar_url, bio)
- "Get Started" button redirects to `/` (or stored redirect from query param `?redirect=`)
- Uses `useAuth()` for `isAuthenticated`, `userProfile`, `fetchUserProfile`
- Uses `useSupabase()` to update the profile
- SEO: noindex, nofollow

Key template structure:
```
<div class="min-h-screen flex items-center justify-center bg-muted">
  <div class="w-full max-w-2xl mx-auto p-4">
    <!-- Not authenticated state -->
    <UCard v-if="!isAuthenticated">
      redirect to /login
    </UCard>

    <!-- Welcome content -->
    <div v-else class="space-y-6">
      <UCard>
        <!-- Welcome header -->
        <div class="text-center mb-6">
          <div class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fad fa-hand-wave text-4xl text-primary"></i>
          </div>
          <h1 class="text-3xl font-bold">Welcome to Classic Mini DIY</h1>
          <p class="opacity-70 mt-2">Your account works across both sites</p>
        </div>

        <!-- Unified account explanation -->
        <div class="bg-base-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-3 mb-2">
            <i class="fad fa-link text-primary"></i>
            <span class="font-semibold">One Account, Two Sites</span>
          </div>
          <ul class="space-y-2 ml-8">
            <li>classicminidiy.com — archive & tools</li>
            <li>theminiexchange.com — marketplace</li>
          </ul>
        </div>

        <!-- Profile setup form -->
        <form @submit.prevent="saveProfile" class="space-y-4">
          <h2 class="text-xl font-semibold">Set Up Your Profile</h2>
          <p class="text-sm opacity-70">Optional — you can always do this later.</p>

          <UFormField label="Display Name">
            <UInput v-model="displayName" placeholder="How should we call you?" class="w-full" />
          </UFormField>

          <UFormField label="Bio">
            <UTextarea v-model="bio" placeholder="Tell us about your Mini..." :rows="3" class="w-full" />
          </UFormField>
        </form>

        <!-- What you can do section -->
        <USeparator class="my-6" />
        <h2 class="text-xl font-semibold mb-4">What You Can Do</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center p-4">
            <i class="fad fa-books text-2xl text-primary mb-2"></i>
            <p class="font-medium">Browse the Archive</p>
            <p class="text-sm opacity-70">Manuals, colors, wheels, registry</p>
          </div>
          <div class="text-center p-4">
            <i class="fad fa-toolbox text-2xl text-primary mb-2"></i>
            <p class="font-medium">Use Technical Tools</p>
            <p class="text-sm opacity-70">Calculators, decoders, specs</p>
          </div>
          <div class="text-center p-4">
            <i class="fad fa-paper-plane text-2xl text-primary mb-2"></i>
            <p class="font-medium">Contribute</p>
            <p class="text-sm opacity-70">Help grow the archive</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 mt-6">
          <UButton variant="ghost" @click="skip">Skip for Now</UButton>
          <UButton color="primary" @click="saveAndContinue">
            <i class="fad fa-arrow-right mr-2"></i>
            Get Started
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</div>
```

Script logic:
```ts
const { isAuthenticated, userProfile, fetchUserProfile } = useAuth();
const supabase = useSupabase();
const route = useRoute();

const displayName = ref(userProfile.value?.display_name || '');
const bio = ref('');
const saving = ref(false);

const redirectTo = computed(() => (route.query.redirect as string) || '/');

async function saveProfile() {
  if (!displayName.value.trim()) return;
  saving.value = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        display_name: displayName.value.trim(),
        bio: bio.value.trim() || null,
      }).eq('id', user.id);
      await fetchUserProfile(user.id);
    }
  } finally {
    saving.value = false;
  }
}

function skip() {
  navigateTo(redirectTo.value, { replace: true });
}

async function saveAndContinue() {
  if (displayName.value.trim()) {
    await saveProfile();
  }
  navigateTo(redirectTo.value, { replace: true });
}

// Redirect if not authenticated
onMounted(async () => {
  const { initAuth } = useAuth();
  await initAuth();
  if (!isAuthenticated.value) {
    navigateTo('/login', { replace: true });
  }
});
```

Add full i18n block with 10 locales (en, es, fr, it, de, pt, ru, ja, zh, ko) — match the pattern in `login.vue`.

**Step 2: Commit**

```bash
git add app/pages/welcome.vue
git commit -m "feat: add welcome page with unified account onboarding"
```

---

## Task 3: Update Auth Callback for First-Time Detection

**Files:**
- Modify: `app/pages/auth/callback.vue`

**Step 1: Add first-time user detection**

In `auth/callback.vue`, update the `onMounted` handler. After `initAuth()` and the 500ms wait, check the user's profile for null `display_name`:

Replace the current redirect logic (lines 33-38):
```ts
if (isAuthenticated.value) {
  if (isAdmin.value) {
    navigateTo('/admin', { replace: true });
  } else {
    navigateTo('/', { replace: true });
  }
}
```

With:
```ts
if (isAuthenticated.value) {
  // Wait for profile to be fetched
  await waitForAuth();

  // First-time user detection: null display_name means they haven't onboarded
  if (!userProfile.value?.display_name) {
    const redirect = isAdmin.value ? '/admin' : '/';
    navigateTo(`/welcome?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  } else if (isAdmin.value) {
    navigateTo('/admin', { replace: true });
  } else {
    navigateTo('/', { replace: true });
  }
}
```

Update the destructured imports at line 24 to include `userProfile` and `waitForAuth`:
```ts
const { initAuth, isAuthenticated, isAdmin, userProfile, waitForAuth } = useAuth();
```

**Step 2: Commit**

```bash
git add app/pages/auth/callback.vue
git commit -m "feat: redirect first-time users to /welcome after auth callback"
```

---

## Task 4: Update Login Page Messaging

**Files:**
- Modify: `app/pages/login.vue`

**Step 1: Update subtitle and add unified account note**

In `login.vue`, make these changes:

1. Update the subtitle i18n key from "Access Classic Mini DIY admin panel" to something more welcoming for all users: "Sign in to contribute, track submissions, and more"

2. Add a unified account info note below the "Back to Site" button. After the closing `</div>` of the back-to-site section (line 88), add:

```html
<div class="text-center mt-4 p-3 bg-base-200 rounded-lg">
  <p class="text-xs opacity-70">
    <i class="fad fa-link mr-1"></i>
    {{ $t('unified_account_note') }}
  </p>
</div>
```

3. Add i18n keys for all 10 locales:
- `subtitle` → update from "Access Classic Mini DIY admin panel" to "Sign in to contribute, track submissions, and more" (and translations)
- `unified_account_note` → "Your account works on both classicminidiy.com and theminiexchange.com" (and translations)

Also update `page_description` meta to not reference "admin panel".

**Step 2: Fix the Russian locale bug**

The Russian locale has Japanese text for `sign_in_google` and `sign_in_apple` (lines 324-325). Fix:
```json
"sign_in_google": "Продолжить с Google",
"sign_in_apple": "Продолжить с Apple",
```

**Step 3: Commit**

```bash
git add app/pages/login.vue
git commit -m "feat: update login page with unified account messaging"
```

---

## Task 5: Create Profile Edit Page

**Files:**
- Create: `app/pages/profile/edit.vue`

**Step 1: Create the profile edit page**

Create `app/pages/profile/edit.vue`. This page:
- Requires authentication
- Edits shared `profiles` table fields: display_name, avatar_url, bio
- Uses `useAuth()` for state, `useSupabase()` for updates
- Pre-populates from `userProfile`
- Success toast on save
- SEO: noindex, nofollow

Template structure:
```
<hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
<div class="container mx-auto px-4 py-6">
  <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />

  <!-- Auth gate -->
  <div v-if="!isAuthenticated" class="max-w-md mx-auto mt-8">
    <UCard class="text-center">
      <i class="fad fa-lock text-4xl opacity-30 mb-4"></i>
      <p>Sign in to edit your profile</p>
      <UButton to="/login" color="primary" class="mt-4">Sign In</UButton>
    </UCard>
  </div>

  <!-- Profile form -->
  <div v-else class="max-w-2xl mx-auto mt-8">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <i class="fad fa-user-pen text-xl text-primary"></i>
          <h2 class="text-xl font-bold">Edit Profile</h2>
        </div>
      </template>

      <!-- Success state -->
      <UAlert v-if="saved" color="success" title="Profile updated" class="mb-4" />

      <form @submit.prevent="save" class="space-y-4">
        <UFormField label="Display Name">
          <UInput v-model="displayName" placeholder="Your display name" class="w-full" />
        </UFormField>

        <UFormField label="Bio">
          <UTextarea v-model="bio" placeholder="Tell us about yourself and your Mini..." :rows="4" class="w-full" />
        </UFormField>

        <!-- Info note -->
        <div class="bg-base-200 rounded-lg p-3">
          <p class="text-sm opacity-70">
            <i class="fad fa-circle-info mr-1"></i>
            Your profile is shared across classicminidiy.com and theminiexchange.com.
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <UButton variant="ghost" to="/">Cancel</UButton>
          <UButton type="submit" color="primary" :loading="saving">Save Profile</UButton>
        </div>
      </form>
    </UCard>
  </div>
</div>
<patreon-card size="large" />
```

Script:
```ts
import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

const { isAuthenticated, userProfile, fetchUserProfile } = useAuth();
const supabase = useSupabase();

const displayName = ref('');
const bio = ref('');
const saving = ref(false);
const saved = ref(false);

// Pre-populate from profile
watch(userProfile, (profile) => {
  if (profile) {
    displayName.value = profile.display_name || '';
    // bio is not in UserProfile interface yet, may need to fetch separately or add to interface
  }
}, { immediate: true });

async function save() {
  saving.value = true;
  saved.value = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        display_name: displayName.value.trim() || null,
        bio: bio.value.trim() || null,
      }).eq('id', user.id);
      await fetchUserProfile(user.id);
      saved.value = true;
    }
  } finally {
    saving.value = false;
  }
}

useHead({ title: $t('page_title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] });
```

Add i18n block with 10 locales.

**Step 2: Commit**

```bash
git add app/pages/profile/edit.vue
git commit -m "feat: add profile edit page for shared profile fields"
```

---

## Task 6: Update MainNav Profile Dropdown

**Files:**
- Modify: `app/components/MainNav.vue`

**Step 1: Update dropdown items**

In MainNav.vue, the profile dropdown (when authenticated) currently has these items:
- Admin (if admin)
- Submissions → `/submissions`
- Contribute Color → `/archive/colors/contribute`
- Submit Wheel → `/archive/wheels/submit`
- Sign Out

Replace "Contribute Color" and "Submit Wheel" with:
- Edit Profile → `/profile/edit`
- Contribute → `/contribute`

Keep "Submissions" and "Admin" (if admin) as-is.

Find the desktop dropdown items section and the mobile slideover account section. Update both to use the new routes.

For the desktop profile dropdown `items` array, replace the "Contribute Color" and "Submit Wheel" entries with:
```ts
{
  label: t('nav.edit_profile'),
  icon: 'i-fa6-solid-user-pen',
  to: '/profile/edit',
},
{
  label: t('nav.contribute'),
  icon: 'i-fa6-solid-paper-plane',
  to: '/contribute',
},
```

Do the same for the mobile slideover section.

**Step 2: Update i18n keys**

Add new i18n keys and remove old ones:
- Add: `nav.edit_profile` → "Edit Profile" (10 locales)
- Add: `nav.contribute` → "Contribute" (10 locales)
- Remove: old contribute color / submit wheel keys if they exist

**Step 3: Commit**

```bash
git add app/components/MainNav.vue
git commit -m "feat: update nav dropdown with profile edit and contribute links"
```

---

## Task 7: Create Contribute Hub Page

**Files:**
- Create: `app/pages/contribute/index.vue`

**Step 1: Create the hub page**

Create `app/pages/contribute/index.vue`. This page:
- Requires authentication (auth gate pattern)
- Shows 4 contribution type cards in a grid
- Shows user's contribution stats at the bottom
- Links to `/submissions` for full history

Template structure:
```
<hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
<div class="container mx-auto px-4 py-6">
  <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />

  <!-- Auth gate -->
  <div v-if="!isAuthenticated" class="max-w-md mx-auto mt-8">
    <UCard class="text-center">
      <i class="fad fa-lock text-4xl opacity-30 mb-4"></i>
      <h2 class="text-xl font-semibold mb-2">Sign In to Contribute</h2>
      <p class="opacity-70 mb-4">Help preserve Classic Mini history by contributing to the archive.</p>
      <UButton to="/login" color="primary">Sign In</UButton>
    </UCard>
  </div>

  <div v-else>
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold">Contribute to the Archive</h1>
      <p class="opacity-70 mt-2">Help preserve Classic Mini history</p>
    </div>

    <!-- Contribution type grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
      <NuxtLink to="/contribute/document" class="block">
        <UCard class="h-full hover:shadow-xl transition-shadow text-center p-6">
          <i class="fad fa-books text-4xl text-primary mb-3"></i>
          <h3 class="text-lg font-semibold">Document</h3>
          <p class="text-sm opacity-70 mt-1">Manuals, adverts, catalogues, tuning guides</p>
        </UCard>
      </NuxtLink>

      <NuxtLink to="/contribute/color" class="block">
        <UCard class="h-full hover:shadow-xl transition-shadow text-center p-6">
          <i class="fad fa-brush text-4xl text-primary mb-3"></i>
          <h3 class="text-lg font-semibold">Color</h3>
          <p class="text-sm opacity-70 mt-1">Paint colors and swatches</p>
        </UCard>
      </NuxtLink>

      <NuxtLink to="/contribute/wheel" class="block">
        <UCard class="h-full hover:shadow-xl transition-shadow text-center p-6">
          <i class="fad fa-tire text-4xl text-primary mb-3"></i>
          <h3 class="text-lg font-semibold">Wheel</h3>
          <p class="text-sm opacity-70 mt-1">Fitment data and photos</p>
        </UCard>
      </NuxtLink>

      <NuxtLink to="/contribute/registry" class="block">
        <UCard class="h-full hover:shadow-xl transition-shadow text-center p-6">
          <i class="fad fa-clipboard-list text-4xl text-primary mb-3"></i>
          <h3 class="text-lg font-semibold">Registry</h3>
          <p class="text-sm opacity-70 mt-1">Register your Classic Mini</p>
        </UCard>
      </NuxtLink>
    </div>

    <!-- User stats -->
    <div v-if="userProfile" class="max-w-3xl mx-auto mt-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">Your Contributions</p>
            <p class="text-sm opacity-70">
              {{ userProfile.total_submissions }} submitted, {{ userProfile.approved_submissions }} approved
            </p>
          </div>
          <div class="flex items-center gap-3">
            <UBadge color="info">{{ userProfile.trust_level }}</UBadge>
            <UButton to="/submissions" variant="outline" size="sm">View All</UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</div>
<patreon-card size="large" />
```

Script:
```ts
import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

const { isAuthenticated, userProfile } = useAuth();

useHead({ title: $t('page_title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] });
```

Add i18n block with 10 locales.

**Step 2: Commit**

```bash
git add app/pages/contribute/index.vue
git commit -m "feat: add /contribute hub page with type selection grid"
```

---

## Task 8: Migrate Document Submission Form

**Files:**
- Create: `app/pages/contribute/document.vue`

**Step 1: Create the document contribution page**

Copy the content from `app/pages/archive/documents/submit.vue` to `app/pages/contribute/document.vue`. Make these adjustments:

1. Update import paths (one level shallower now — `../../../data/models/generic` → `../../../data/models/generic`, verify the relative path is correct from `pages/contribute/`)
2. Update breadcrumb to show: Home > Archive > Contribute > Document
3. Update canonical URL in SEO from `/archive/documents/submit` to `/contribute/document`
4. Update the PostHog capture event to include `{ source: 'contribute_hub' }`
5. After successful submission, show a link to `/submissions` AND a "Submit Another" button

The form logic, fields, type selector, and validation stay exactly the same. The `useSubmissions().submitNewItem('document', data)` call is unchanged.

**Step 2: Commit**

```bash
git add app/pages/contribute/document.vue
git commit -m "feat: add /contribute/document page (migrated from archive submit)"
```

---

## Task 9: Migrate Color Contribution Form

**Files:**
- Create: `app/pages/contribute/color.vue`

**Step 1: Create the color contribution page**

Copy from `app/pages/archive/colors/contribute.vue` to `app/pages/contribute/color.vue`. Adjustments:

1. Fix import paths for the new location
2. Update breadcrumb: Home > Archive > Contribute > Color
3. Update canonical URL to `/contribute/color`
4. The `?color=` query param for pre-populating an existing color should still work (used by the "Contribute" button on color detail pages)
5. Update the PostHog capture event

The two-column layout (current color data on left, form on right) and all form logic stay the same. The `useColors().submitColor()` call is unchanged.

**Step 2: Commit**

```bash
git add app/pages/contribute/color.vue
git commit -m "feat: add /contribute/color page (migrated from archive contribute)"
```

---

## Task 10: Create Wheel Contribution Page

**Files:**
- Create: `app/pages/contribute/wheel.vue`

**Step 1: Create the wheel contribution page**

Create `app/pages/contribute/wheel.vue` as an auth-gated page that wraps the existing `WheelSubmit` component. Model it after `app/pages/archive/wheels/submit.vue` but add the auth gate.

```vue
<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const route = useRoute();
  const { isAuthenticated } = useAuth();
  const uuid = ref(route.query.uuid?.toString());
  const newWheel = route.query.newWheel === 'true' ? true : false;

  useHead({ title: $t('page_title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] });
</script>

<template>
  <div>
    <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
    <section class="py-4">
      <div class="container mx-auto px-4">
        <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />

        <!-- Auth gate -->
        <div v-if="!isAuthenticated" class="max-w-md mx-auto mt-8">
          <UCard class="text-center">
            <i class="fad fa-lock text-4xl opacity-30 mb-4"></i>
            <p class="mb-4">{{ $t('sign_in_message') }}</p>
            <UButton to="/login" color="primary">{{ $t('sign_in') }}</UButton>
          </UCard>
        </div>

        <div v-else class="mt-4">
          <WheelSubmit v-if="!newWheel" :uuid="uuid" />
          <WheelSubmit v-else :newWheel="true" />
        </div>
      </div>
    </section>
  </div>
</template>
```

Add i18n block with 10 locales matching the existing wheel submit page pattern.

**Step 2: Commit**

```bash
git add app/pages/contribute/wheel.vue
git commit -m "feat: add /contribute/wheel page wrapping WheelSubmit component"
```

---

## Task 11: Create Registry Contribution Page

**Files:**
- Create: `app/pages/contribute/registry.vue`

**Step 1: Create the registry contribution page**

Create `app/pages/contribute/registry.vue` as an auth-gated page that wraps the existing `RegistrySubmission` component. The registry previously had no dedicated page — the component was embedded inline on the registry listing page.

```vue
<script lang="ts" setup>
  import { HERO_TYPES, BREADCRUMB_VERSIONS } from '../../../data/models/generic';

  const { isAuthenticated } = useAuth();

  useHead({ title: $t('page_title'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] });
</script>

<template>
  <div>
    <hero :navigation="true" :title="$t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" />
    <section class="py-4">
      <div class="container mx-auto px-4">
        <breadcrumb :version="BREADCRUMB_VERSIONS.ARCHIVE" :page="$t('breadcrumb_title')" />

        <!-- Auth gate -->
        <div v-if="!isAuthenticated" class="max-w-md mx-auto mt-8">
          <UCard class="text-center">
            <i class="fad fa-lock text-4xl opacity-30 mb-4"></i>
            <p class="mb-4">{{ $t('sign_in_message') }}</p>
            <UButton to="/login" color="primary">{{ $t('sign_in') }}</UButton>
          </UCard>
        </div>

        <div v-else class="grid grid-cols-12 gap-4 mt-4">
          <div class="col-span-12 md:col-span-8 md:col-start-3">
            <RegistrySubmission />
          </div>
        </div>
      </div>
    </section>
    <patreon-card size="large" />
  </div>
</template>
```

Add i18n block with 10 locales.

**Step 2: Commit**

```bash
git add app/pages/contribute/registry.vue
git commit -m "feat: add /contribute/registry page wrapping RegistrySubmission component"
```

---

## Task 12: Remove Old Submission Pages

**Files:**
- Delete: `app/pages/archive/documents/submit.vue`
- Delete: `app/pages/archive/colors/contribute.vue`
- Delete: `app/pages/archive/wheels/submit.vue`
- Delete: `app/pages/archive/documents/[slug]/suggest-edit.vue`

**Step 1: Verify redirects are in place**

Before deleting, verify the 301 redirects added in Task 1 are present in `nuxt.config.ts`.

**Step 2: Delete old files**

```bash
rm app/pages/archive/documents/submit.vue
rm app/pages/archive/colors/contribute.vue
rm app/pages/archive/wheels/submit.vue
rm app/pages/archive/documents/[slug]/suggest-edit.vue
```

If the `[slug]/` directory is now empty, remove it too. Check if there are other files in `app/pages/archive/documents/[slug]/` first.

**Step 3: Update any internal links**

Search the codebase for references to the old routes and update them:

```bash
grep -r "archive/documents/submit" app/ --include="*.vue" --include="*.ts"
grep -r "archive/colors/contribute" app/ --include="*.vue" --include="*.ts"
grep -r "archive/wheels/submit" app/ --include="*.vue" --include="*.ts"
grep -r "suggest-edit" app/ --include="*.vue" --include="*.ts"
```

Update any found references to point to the new `/contribute/*` routes.

Key files likely to contain old links:
- `app/pages/archive/documents/[slug].vue` — may have a "Contribute" or download button
- `app/pages/archive/colors/[...color].vue` — has "Contribute" button linking to `/archive/colors/contribute?color=`
- `app/pages/archive/wheels/[...wheel].vue` — has "Edit/Contribute" button linking to `/archive/wheels/submit?uuid=`
- `app/pages/submissions/index.vue` — empty state links to `/archive/documents/submit`

Update these links:
- `/archive/colors/contribute?color=X` → `/contribute/color?color=X`
- `/archive/wheels/submit?uuid=X` → `/contribute/wheel?uuid=X`
- `/archive/documents/submit` → `/contribute/document`

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove old submission pages, update internal links to /contribute/*"
```

---

## Task 13: Create SuggestEditModal Component

**Files:**
- Create: `app/components/SuggestEditModal.vue`

**Step 1: Create the reusable suggest-edit modal**

Create `app/components/SuggestEditModal.vue`. This is a generic modal that works across all archive types. It accepts the current item's data, shows editable fields, detects changes, and submits via `useSubmissions().submitEditSuggestion()`.

Props:
- `modelValue` (boolean) — v-model for open/close
- `targetType` (string) — 'document' | 'color' | 'wheel' | 'registry'
- `targetId` (string) — the item's UUID
- `currentData` (Record<string, any>) — current field values to pre-populate
- `editableFields` (Array<{ key: string, label: string, type?: 'text' | 'number' | 'textarea' }>) — which fields are editable

Emits:
- `update:modelValue` — for v-model
- `submitted` — after successful submission

Template structure:
```
<UModal v-model="isOpen">
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Suggest an Edit</h3>
        <UButton icon="i-fa6-solid-xmark" variant="ghost" size="sm" @click="close" />
      </div>
    </template>

    <!-- Success state -->
    <div v-if="submitted" class="text-center py-6">
      <i class="fad fa-circle-check text-4xl text-success mb-3"></i>
      <h4 class="text-lg font-semibold">Edit Suggestion Submitted</h4>
      <p class="text-sm opacity-70 mt-2">A moderator will review your changes.</p>
      <UButton @click="close" class="mt-4">Close</UButton>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submit" class="space-y-4">
      <p class="text-sm opacity-70">Propose changes to this item. Only modified fields will be submitted.</p>

      <div v-for="field in editableFields" :key="field.key">
        <UFormField :label="field.label">
          <div class="flex items-center gap-2 text-xs opacity-50 mb-1" v-if="currentData[field.key]">
            Current: {{ currentData[field.key] }}
          </div>
          <UTextarea v-if="field.type === 'textarea'" v-model="formData[field.key]" :rows="3" class="w-full" />
          <UInput v-else v-model="formData[field.key]" :type="field.type || 'text'" class="w-full" />
        </UFormField>
      </div>

      <UFormField label="Reason for change" required>
        <UTextarea v-model="reason" placeholder="Why should this be changed?" :rows="2" class="w-full" required />
      </UFormField>

      <UAlert v-if="error" color="error" :title="error" />
      <UAlert v-if="!hasChanges && !error" color="warning" title="No changes detected" description="Modify at least one field to submit." />

      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="close">Cancel</UButton>
        <UButton type="submit" color="primary" :loading="processing" :disabled="!hasChanges || !reason.trim()">
          Submit Edit Suggestion
        </UButton>
      </div>
    </form>
  </UCard>
</UModal>
```

Script:
```ts
const props = defineProps<{
  modelValue: boolean;
  targetType: 'document' | 'color' | 'wheel' | 'registry';
  targetId: string;
  currentData: Record<string, any>;
  editableFields: Array<{ key: string; label: string; type?: 'text' | 'number' | 'textarea' }>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'submitted': [];
}>();

const { submitEditSuggestion } = useSubmissions();
const { capture } = usePostHog();

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const formData = reactive<Record<string, any>>({});
const reason = ref('');
const processing = ref(false);
const error = ref('');
const submitted = ref(false);

// Initialize form data from current values
watch(() => props.currentData, (data) => {
  for (const field of props.editableFields) {
    formData[field.key] = data[field.key] || '';
  }
}, { immediate: true });

const hasChanges = computed(() => {
  return props.editableFields.some((field) => {
    const current = String(props.currentData[field.key] || '');
    const proposed = String(formData[field.key] || '');
    return current !== proposed;
  });
});

async function submit() {
  if (!hasChanges.value || !reason.value.trim()) return;
  processing.value = true;
  error.value = '';

  try {
    const changes: Record<string, { from: any; to: any }> = {};
    for (const field of props.editableFields) {
      const current = props.currentData[field.key] || '';
      const proposed = formData[field.key] || '';
      if (String(current) !== String(proposed)) {
        changes[field.key] = { from: current, to: proposed };
      }
    }

    await submitEditSuggestion(props.targetType, props.targetId, changes, reason.value.trim());
    submitted.value = true;
    capture('edit_suggestion_submitted', {
      target_type: props.targetType,
      target_id: props.targetId,
      changed_fields: Object.keys(changes),
    });
    emit('submitted');
  } catch (e: any) {
    error.value = e.message || 'Failed to submit edit suggestion';
  } finally {
    processing.value = false;
  }
}

function close() {
  isOpen.value = false;
  // Reset state after modal closes
  setTimeout(() => {
    submitted.value = false;
    reason.value = '';
    error.value = '';
  }, 300);
}
```

Add i18n block with 10 locales.

**Step 2: Commit**

```bash
git add app/components/SuggestEditModal.vue
git commit -m "feat: add reusable SuggestEditModal component for all archive types"
```

---

## Task 14: Add Suggest Edit to Document Detail Page

**Files:**
- Modify: `app/pages/archive/documents/[slug].vue`

**Step 1: Add suggest-edit trigger and modal**

In the document detail page, add:

1. Import and state for the modal:
```ts
const { isAuthenticated } = useAuth();
const showSuggestEdit = ref(false);
```

2. A "Suggest Edit" button near the existing action buttons (Share, Contribute, Download area). Only show when authenticated:
```html
<UButton v-if="isAuthenticated" variant="outline" size="sm" @click="showSuggestEdit = true">
  <i class="fad fa-pen-to-square mr-2"></i>
  {{ $t('suggest_edit') }}
</UButton>
```

3. The modal at the bottom of the template:
```html
<SuggestEditModal
  v-if="document"
  v-model="showSuggestEdit"
  target-type="document"
  :target-id="document.id"
  :current-data="{ title: document.title, description: document.description, code: document.code }"
  :editable-fields="[
    { key: 'title', label: $t('field_title'), type: 'text' },
    { key: 'code', label: $t('field_code'), type: 'text' },
    { key: 'description', label: $t('field_description'), type: 'textarea' },
  ]"
/>
```

4. Add i18n keys: `suggest_edit`, `field_title`, `field_code`, `field_description` in all 10 locales.

**Step 2: Commit**

```bash
git add app/pages/archive/documents/[slug].vue
git commit -m "feat: add inline suggest-edit modal to document detail page"
```

---

## Task 15: Add Suggest Edit to Color, Wheel, and Registry Detail Pages

**Files:**
- Modify: `app/pages/archive/colors/[...color].vue`
- Modify: `app/pages/archive/wheels/[...wheel].vue`
- Modify: `app/pages/archive/registry/index.vue`

**Step 1: Add suggest-edit to color detail page**

In `archive/colors/[...color].vue`, add the same pattern as Task 14:
- "Suggest Edit" button (auth-gated)
- `SuggestEditModal` with color-specific fields:
  ```ts
  :current-data="{ name: color.pretty.Name, code: color.pretty.Code, years: color.pretty.Years }"
  :editable-fields="[
    { key: 'name', label: 'Color Name' },
    { key: 'code', label: 'BMC Code' },
    { key: 'years', label: 'Years Used' },
  ]"
  ```

Also update the existing "Contribute" button link from `/archive/colors/contribute?color=` to `/contribute/color?color=`.

**Step 2: Add suggest-edit to wheel detail page**

In `archive/wheels/[...wheel].vue`:
- "Suggest Edit" button (auth-gated)
- `SuggestEditModal` with wheel-specific fields (name, width, size, offset)

Also update the existing "Edit/Contribute" button link from `/archive/wheels/submit?uuid=` to `/contribute/wheel?uuid=`.

**Step 3: Add suggest-edit to registry page**

The registry page (`archive/registry/index.vue`) shows a table of entries. Add a "Suggest Edit" action for individual entries — this may be a button per row or a selected-entry modal. Since registry entries are displayed in a `RegistryTable` component, the suggest-edit button may need to be added to the table component or as a separate interaction. Check the `RegistryTable` component for how individual entries are rendered and add the suggest-edit trigger appropriately.

**Step 4: Commit**

```bash
git add app/pages/archive/colors/[...color].vue app/pages/archive/wheels/[...wheel].vue app/pages/archive/registry/index.vue
git commit -m "feat: add suggest-edit modal to color, wheel, and registry detail pages"
```

---

## Task 16: Add Contribute CTAs to Archive Pages

**Files:**
- Modify: `app/pages/archive/index.vue`
- Modify: `app/pages/archive/documents/index.vue`
- Modify: `app/pages/archive/colors/index.vue`
- Modify: `app/pages/archive/wheels/index.vue`
- Modify: `app/pages/archive/registry/index.vue`

**Step 1: Update archive hub page**

In `archive/index.vue`:

1. Replace the existing "Add to Archive" button (which calls `submitArchiveFile(ARCHIVE_TYPES.GENERIC)`) with a link to `/contribute`:

```html
<UButton class="mr-3 text-lg" color="primary" to="/contribute">
  <i class="fa-duotone fa-paper-plane mr-2"></i>
  {{ $t('contribute_to_archive') }}
</UButton>
```

2. Add a contribute card to the grid alongside the existing archive section cards. After the `v-for` loop over `ArchiveItems`, add:

```html
<div class="col-span-1">
  <NuxtLink to="/contribute" class="block h-full">
    <UCard class="text-center p-5 h-full hover:shadow-xl transition-shadow bg-primary/5 border-primary/20">
      <i class="fad fa-hand-holding-heart text-4xl text-primary"></i>
      <p class="text-lg mt-2 font-semibold">{{ $t('contribute') }}</p>
      <p class="text-sm opacity-70 mt-1">{{ $t('contribute_description') }}</p>
    </UCard>
  </NuxtLink>
</div>
```

3. Update i18n: add `contribute_to_archive`, `contribute`, `contribute_description` keys.

4. Remove the `submitArchiveFile` import and `ARCHIVE_TYPES` import if no longer used elsewhere on this page.

**Step 2: Add contribute banners to section listing pages**

For each archive section listing page (documents, colors, wheels, registry), add a banner above the grid/table:

```html
<UCard class="mb-6 bg-primary/5 border-primary/20">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <i class="fad fa-hand-holding-heart text-xl text-primary"></i>
      <div>
        <p class="font-medium">{{ $t('contribute_banner_title') }}</p>
        <p class="text-sm opacity-70">{{ $t('contribute_banner_description') }}</p>
      </div>
    </div>
    <UButton :to="contributeLink" color="primary" variant="outline" size="sm">
      {{ $t('contribute_banner_button') }}
    </UButton>
  </div>
</UCard>
```

Where `contributeLink` is:
- `/contribute/document` for documents page
- `/contribute/color` for colors page
- `/contribute/wheel` for wheels page
- `/contribute/registry` for registry page

Add i18n keys: `contribute_banner_title` → "Know something we're missing?", `contribute_banner_description` → "Help grow the archive with your knowledge.", `contribute_banner_button` → "Contribute"

**Step 3: Commit**

```bash
git add app/pages/archive/index.vue app/pages/archive/documents/index.vue app/pages/archive/colors/index.vue app/pages/archive/wheels/index.vue app/pages/archive/registry/index.vue
git commit -m "feat: add contribute CTAs to archive hub and section listing pages"
```

---

## Task 17: Update Submissions Page Empty State

**Files:**
- Modify: `app/pages/submissions/index.vue`

**Step 1: Update empty state link**

The submissions page empty state currently links to `/archive/documents/submit`. Update it to link to `/contribute`:

Find the empty state section and change the `UButton` `to` prop from `/archive/documents/submit` to `/contribute`.

**Step 2: Commit**

```bash
git add app/pages/submissions/index.vue
git commit -m "fix: update submissions empty state link to /contribute"
```

---

## Task 18: Final Verification

**Step 1: Run the dev server**

```bash
bun run dev
```

**Step 2: Verify routes**

- [ ] `/contribute` → shows hub with 4 cards (requires auth)
- [ ] `/contribute/document` → document submission form (requires auth)
- [ ] `/contribute/color` → color submission form (requires auth)
- [ ] `/contribute/wheel` → wheel submission form (requires auth)
- [ ] `/contribute/registry` → registry submission form (requires auth)
- [ ] `/welcome` → onboarding page (requires auth)
- [ ] `/profile/edit` → profile editing (requires auth)

**Step 3: Verify redirects**

- [ ] `/archive/documents/submit` → 301 to `/contribute/document`
- [ ] `/archive/colors/contribute` → 301 to `/contribute/color`
- [ ] `/archive/wheels/submit` → 301 to `/contribute/wheel`

**Step 4: Verify suggest-edit modals**

- [ ] Document detail page shows "Suggest Edit" button (when logged in)
- [ ] Color detail page shows "Suggest Edit" button (when logged in)
- [ ] Wheel detail page shows "Suggest Edit" button (when logged in)
- [ ] Modal opens, shows current values, detects changes, submits diff

**Step 5: Verify navigation**

- [ ] Nav dropdown shows "Edit Profile" and "Contribute" links
- [ ] Archive hub has "Contribute" card
- [ ] Archive section pages have contribute banners

**Step 6: Verify onboarding**

- [ ] New user (null display_name) redirected to `/welcome` after auth callback
- [ ] Welcome page shows unified account messaging
- [ ] Profile can be set and saved
- [ ] "Get Started" redirects to intended destination

**Step 7: Build check**

```bash
bun run build
```

Verify no build errors.

**Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
