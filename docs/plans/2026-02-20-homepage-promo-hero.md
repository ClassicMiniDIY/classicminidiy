# Homepage Promo Hero Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static homepage hero with a promotional banner system that randomly shows active promotions (with expiry dates) and falls back to the original hero when none are active.

**Architecture:** New `HeroPromo.vue` wrapper component with a hardcoded promotions array. Filters by expiry date, picks one at random on page load, renders it as a full-width hero-sized banner. Falls back to the existing `<hero>` component when no promos are active. The homepage `index.vue` swaps `<hero>` for `<HeroPromo>`.

**Tech Stack:** Vue 3, Nuxt 4, Nuxt UI (`UButton`), Luxon (already in project for date handling)

---

### Task 1: Create `HeroPromo.vue` component

**Files:**

- Create: `app/components/HeroPromo.vue`

**Context:**

- The existing hero component is at `app/components/Hero.vue`
- It uses `HERO_TYPES` from `data/models/generic.ts`
- The homepage hero uses props: `titleKey="'home_title'"`, `subtitleKey="'home_subtitle'"`, `size="'is-medium'"`, `special=true`, `heroType=HERO_TYPES.HOME`, `background="'/backdrop2'"`, `navigation=true`
- Hero sizing for HOME type: `md:h-144 sm:h-96`
- Background image pattern: `https://classicminidiy.s3.amazonaws.com/misc${background}.webp`
- The site uses Nuxt UI components (`UButton`) and Font Awesome icons
- Luxon is available globally for date comparison

**Step 1: Create the HeroPromo component**

```vue
<script setup lang="ts">
  import { DateTime } from 'luxon';
  import { HERO_TYPES } from '../../data/models/generic';

  interface Promotion {
    id: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaUrl: string;
    backgroundImage: string;
    expiresAt: string;
    external?: boolean;
  }

  const promotions: Promotion[] = [
    {
      id: 'mini-exchange-launch',
      title: 'The Mini Exchange is Live!',
      subtitle: 'Buy and sell Classic Minis on the brand new marketplace from Classic Mini DIY',
      ctaText: 'Visit The Mini Exchange',
      ctaUrl: 'https://theminiexchange.com',
      backgroundImage: 'https://classicminidiy.s3.amazonaws.com/misc/promo-mini-exchange.webp',
      expiresAt: '2027-01-01',
      external: true,
    },
    {
      id: 'turbo-engine-giveaway',
      title: 'Win a Turbocharged A-Series Engine',
      subtitle: 'Enter the Classic Mini DIY giveaway — drawing March 6th!',
      ctaText: 'Enter the Giveaway',
      ctaUrl:
        'https://raffall.com/404519/enter-raffle-to-win-turbocharged-classic-mini-a-series-engine-hosted-by-cole-gentry',
      backgroundImage: 'https://classicminidiy.s3.amazonaws.com/misc/promo-engine-giveaway.webp',
      expiresAt: '2026-03-06',
      external: true,
    },
  ];

  const today = DateTime.now();
  const activePromos = promotions.filter((p) => DateTime.fromISO(p.expiresAt) > today);

  // Pick one at random (stable for this page load)
  const selectedPromo = activePromos.length > 0 ? activePromos[Math.floor(Math.random() * activePromos.length)] : null;

  const promoStyle = selectedPromo
    ? {
        backgroundImage: `url(${selectedPromo.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};
</script>

<template>
  <!-- Active promo: render as hero-sized banner -->
  <section
    v-if="selectedPromo"
    class="hero-section flex bg-[#242424] bg-cover bg-center bg-no-repeat md:h-144 sm:h-96"
    :style="promoStyle"
  >
    <div class="hero-content flex flex-col items-start justify-center w-full">
      <div class="pl-20">
        <p class="text-white text-sm uppercase tracking-wide">
          {{ selectedPromo.subtitle }}
        </p>
        <h1 class="fancy-font-bold text-white text-4xl lg:text-5xl mt-2 special-title">
          {{ selectedPromo.title }}
        </h1>
        <UButton
          :to="selectedPromo.ctaUrl"
          :target="selectedPromo.external ? '_blank' : undefined"
          :external="selectedPromo.external"
          color="primary"
          size="lg"
          class="mt-6"
        >
          {{ selectedPromo.ctaText }}
          <i v-if="selectedPromo.external" class="fas fa-external-link-alt ml-2 text-sm"></i>
        </UButton>

        <!-- Dot indicators when multiple promos are active -->
        <div v-if="activePromos.length > 1" class="flex gap-2 mt-6">
          <span
            v-for="promo in activePromos"
            :key="promo.id"
            class="w-2.5 h-2.5 rounded-full"
            :class="promo.id === selectedPromo.id ? 'bg-white' : 'bg-white/40'"
          />
        </div>
      </div>
    </div>
  </section>

  <!-- No active promos: fall back to original hero -->
  <hero
    v-else
    :titleKey="'home_title'"
    :subtitleKey="'home_subtitle'"
    :size="'is-medium'"
    :special="true"
    :heroType="HERO_TYPES.HOME"
    :background="'/backdrop2'"
    :navigation="true"
  />
</template>

<style lang="scss" scoped>
  .hero-section {
    .special-title {
      font-size: 100px;
    }

    @media screen and (max-width: 1023px) {
      .special-title {
        font-size: 2rem;
      }
    }
  }
</style>
```

**Step 2: Verify component renders without errors**

Run: `cd /Users/colegentry/Development/classicminidiy && bun run dev`

Open http://localhost:3000 — but the component isn't used yet. Just confirm dev server starts cleanly.

**Step 3: Commit**

```bash
git add app/components/HeroPromo.vue
git commit -m "feat: add HeroPromo component with promotional banner support"
```

---

### Task 2: Wire `HeroPromo` into the homepage

**Files:**

- Modify: `app/pages/index.vue:1-3` (remove Hero import/enum), `app/pages/index.vue:86-94` (replace hero tag)

**Context:**

- Current `index.vue` imports `HERO_TYPES` from `../../data/models/generic` at line 3
- The hero is rendered at lines 86-94: `<hero :titleKey="'home_title'" ... />`
- `HeroPromo` is auto-imported by Nuxt (it's in `app/components/`)

**Step 1: Remove the `HERO_TYPES` import (no longer needed on this page)**

In `app/pages/index.vue`, remove line 3:

```
  import { HERO_TYPES } from '../../data/models/generic';
```

**Step 2: Replace the hero tag**

Replace lines 86-94:

```vue
<hero
  :titleKey="'home_title'"
  :subtitleKey="'home_subtitle'"
  :size="'is-medium'"
  :special="true"
  :heroType="HERO_TYPES.HOME"
  :background="'/backdrop2'"
  :navigation="true"
/>
```

With:

```vue
<HeroPromo />
```

**Step 3: Test in browser**

Run: `cd /Users/colegentry/Development/classicminidiy && bun run dev`

Open http://localhost:3000 and verify:

1. A promotional banner appears (one of the two, randomly)
2. The banner has the title, subtitle, and CTA button
3. Dot indicators appear at bottom (since both promos should be active)
4. Clicking the CTA opens the correct link in a new tab
5. The rest of the page below (spacer, mission section, etc.) still renders correctly

**Step 4: Test fallback behavior**

Temporarily change both `expiresAt` dates in `HeroPromo.vue` to a past date (e.g., `'2020-01-01'`). Reload the page and verify the original hero ("Classic Mini DIY" with backdrop image) appears. Then revert the dates.

**Step 5: Commit**

```bash
git add app/pages/index.vue
git commit -m "feat: replace static homepage hero with HeroPromo promotional banners"
```

---

### Task 3: Upload placeholder images and finalize

**Files:**

- Modify: `app/components/HeroPromo.vue` (update image URLs if needed)

**Step 1: Verify background images**

The two promo background images need to exist at:

- `https://classicminidiy.s3.amazonaws.com/misc/promo-mini-exchange.webp`
- `https://classicminidiy.s3.amazonaws.com/misc/promo-engine-giveaway.webp`

If these don't exist yet, the promos will render with the `#242424` dark background fallback (which still looks fine with white text). Upload images when ready.

**Step 2: Final visual check**

Verify the promos look good on:

- Desktop (wide screen)
- Tablet (medium)
- Mobile (narrow) — the `special-title` font size drops to `2rem` on screens < 1024px

**Step 3: Commit if any image URL changes were needed**

```bash
git add app/components/HeroPromo.vue
git commit -m "chore: finalize promo hero background image URLs"
```
