# Homepage Promo Hero - Design Doc

**Date:** 2026-02-20
**Status:** Approved

## Problem

The classicminidiy.com homepage has a static hero section. We want to run promotional banners (e.g., The Mini Exchange launch, engine giveaway) that rotate randomly for visitors, with expiry dates so they auto-remove themselves.

## Decision

**Approach 2: New `HeroPromo` wrapper component** - a new component that wraps promo logic and falls back to the original `<hero>` when no active promos exist. Clean separation, easy to remove later.

## Data Model

Hardcoded array of promotions:

```ts
interface Promotion {
  id: string;
  title: string; // Bold headline
  subtitle: string; // Supporting text
  ctaText: string; // Button label
  ctaUrl: string; // Link destination
  backgroundImage: string; // Full S3 URL for hero background
  expiresAt: string; // ISO date string (e.g. '2026-03-06')
  external?: boolean; // Opens in new tab if true
}
```

### Initial Promotions

1. **The Mini Exchange Launch**

   - Title: "The Mini Exchange is Live!"
   - Subtitle: "Buy and sell Classic Minis on the brand new marketplace from Classic Mini DIY"
   - CTA: "Visit The Mini Exchange" -> https://theminiexchange.com
   - Expiry: far future (2027-01-01)
   - External: true

2. **Turbo A-Series Engine Giveaway**
   - Title: "Win a Turbocharged A-Series Engine"
   - Subtitle: "Enter the Classic Mini DIY giveaway - drawing March 6th!"
   - CTA: "Enter the Giveaway" -> https://raffall.com/404519/enter-raffle-to-win-turbocharged-classic-mini-a-series-engine-hosted-by-cole-gentry
   - Expiry: 2026-03-06
   - External: true

## Component: `HeroPromo.vue`

### Behavior

1. On mount, filter promotions where `expiresAt > today`
2. If active promos exist: pick one at random, render as full-width hero banner
3. If no active promos: render original `<hero>` with existing props

### Visual

- Same dimensions as current home hero: `md:h-144 sm:h-96`
- Background: `bg-cover bg-center bg-no-repeat` with `#242424` fallback
- Content: left-aligned white text (matching current hero style), with CTA button
- Dot indicators at bottom if multiple promos are active (visual cue)
- Randomization happens once on page load (client-side)

### No i18n

Short-lived hardcoded promos are English-only. Fallback hero retains full i18n.

## Page Change: `index.vue`

Replace `<hero ... />` with `<HeroPromo />`. The wrapper handles fallback internally.

## Files Changed

1. **New:** `app/components/HeroPromo.vue` - promo wrapper component with hardcoded data
2. **Modified:** `app/pages/index.vue` - swap `<hero>` for `<HeroPromo>`

## Background Images

Two promo background images needed on S3. Placeholder URLs used until uploaded.
