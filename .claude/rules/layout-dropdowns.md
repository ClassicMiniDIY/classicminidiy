---
paths:
  - 'app/assets/css/main.css'
  - 'app/components/MainNav.vue'
  - 'app/components/Hero*.vue'
  - 'app/components/HomeSearchBar.vue'
  - 'app/components/LanguageSwitcher.vue'
  - 'app/components/admin/**'
  - 'app/plugins/dropdown-dismiss.client.ts'
  - 'tests/unit/components/main-nav-hydration.test.ts'
---

# Layout and dropdown rules

Detail and measurements: `docs/invariants/layout-and-dropdowns.md`.

## Hero and header

- `hero-content` is a daisyUI class carrying `max-width: 80rem; padding: 1rem`. `Hero.vue`/`HeroPromo.vue` neutralise it (`w-full max-w-none p-0`) and lay the column out in `container mx-auto px-4`, the same container every page body uses. Hero H1 `x` must equal a body `section.container` child's `x` at a wide viewport.
- Do not reintroduce per-component viewport clamps (`max-width: calc(100vw - …)`) to compensate for hero padding.
- Never size an avatar or fixed chrome image with `h-full w-full`; use explicit px on the `<img>` so a missing parent rule yields an unrounded avatar, not a wrecked header.

## Dropdowns

- **"Dropdown always visible / off-screen" is a HYDRATION bug until proven otherwise.** `isAuthenticated`/`isAdmin` are false during SSR (session is in localStorage). Gate structural auth branches on a `hasMounted` ref (`isSignedIn`/`showAdminLink` in `MainNav.vue`), never on the raw flags. `KNOWN_UNGATED` in `tests/static/hydration-auth-gates.test.ts` is empty and shrink-only.
- **Verify dropdown fixes in Firefox**, not only the Chromium preview; the bug never reproduced in Chromium.
- **Dropdown behaviour is global in `main.css`, not per component**, and every rule in that block stays UNLAYERED: daisyUI ships `.dropdown` inside `@layer utilities`, so anything in `@layer components` is outranked regardless of specificity. Directional variants win by selector exclusion (`:not(.dropdown-top, …)`), not layer order.
- `.dropdown { position: relative }` is restated unlayered and is load-bearing; `[popover]` dropdowns are excluded on purpose.
- A clipping ancestor beats any z-index. The global rule unclips `.overflow-x-auto`/`.card` only while a menu inside is open (`:has(.dropdown:focus-within)`). **Never unclip a vertical scroll container** (`.overflow-y-auto`), it resets the scroll offset.
- Escape-to-dismiss lives in `app/plugins/dropdown-dismiss.client.ts` and acts only when focus is inside a `.dropdown`.
- In a backgrounded/headless pane assert on `:focus-within`, not `display`; daisyUI's discrete display transition never advances when the animation clock is stuck.
