# Layout and dropdown invariants

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract lives in `.claude/rules/layout-dropdowns.md` (path-scoped, loads when you touch the matching files); this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Layout invariants

- **`hero-content` is a daisyUI class, and it carries `max-width: 80rem; padding: 1rem`.**
  `Hero.vue`/`HeroPromo.vue` are not daisyUI `hero`s — they're custom `.hero-section`
  banners — so picking up `.hero-content` was accidental, and its max-width pinned the
  hero text column to the LEFT EDGE of the viewport (capped at 1280px starting at x=0)
  rather than centring it. Combined with a left-only `pl-6 md:pl-20`, the homepage H1
  sat ~250px left of every other section at 2000px wide, and got worse the wider the
  screen. Both files now neutralise it (`w-full max-w-none p-0`) and lay the column out
  in `container mx-auto px-4` — **the same container every page body uses**. Hero text
  must line up with the content beneath it; if you touch either file, verify the H1's
  `x` equals a body `section.container` child's `x` at a wide viewport.

- **Don't reintroduce per-component viewport clamps to compensate for hero padding.**
  `HomeSearchBar`'s `max-width: calc(100vw - 5rem)` existed only because the old column
  was padded on one side and overflowed right on phones. With a symmetric container that
  clamp pulls the field _off_ the grid. Same reasoning for anything else placed in a hero.

- **Never size an avatar (or any fixed chrome image) with `h-full w-full`.** A percentage
  height against an auto-height parent resolves to `auto` — the image's INTRINSIC size. If
  the parent's sizing rule is ever missing or late (scoped CSS not yet applied, style block
  dropped), a 1024px avatar renders at 1024px, overflows the header flex row, shrink-crushes
  the omnisearch field (it has `flex-shrink: 1`) and drags the account dropdown off-screen.
  `MainNav.vue` uses explicit px on the `<img>` so the worst case is a merely-unrounded
  avatar, not a wrecked header.

#### Dropdown invariants

- **A "dropdown is always visible and off-screen" report is a HYDRATION bug until proven
  otherwise — do not start in the CSS.** The Supabase session lives in localStorage, so
  `useAuth().isAuthenticated` is ALWAYS false during SSR and flips true on the client after
  `initAuth()`. `MainNav` branched a `v-if`/`v-else` pair straight off it, so the server
  emitted the signed-OUT subtree while the client's first render wanted the signed-IN one.
  Vue's hydration repair merged them: the signed-out wrapper survived and the account
  `<ul class="dropdown-content">` was patched INTO it, orphaned from any `.dropdown`.
  Because every rule that places or hides a menu is scoped `.dropdown … .dropdown-content`,
  an orphan loses `position: absolute` (lays out in the header flex row, spills right) AND
  its closed-state `display: none` (never hides) — one defect, both symptoms. The adjacent
  language dropdown lost its own menu as collateral, which is the tell that this is
  structural corruption rather than styling. Fix: gate structural auth branches on a
  `hasMounted` ref (`isSignedIn`/`showAdminLink` in `MainNav.vue`), never on
  `isAuthenticated`/`isAdmin` directly — same rule as `/chat` and the passkey UI.
  `tests/unit/components/main-nav-hydration.test.ts` enforces both halves.

  **That backlog is CLEARED.** This note used to say ~19 other call sites in `app/`
  still branched structurally on ungated `isAuthenticated`/`isAdmin`. They have all
  been gated: `KNOWN_UNGATED` in `tests/static/hydration-auth-gates.test.ts` is
  empty and the check passes, and that allowlist is shrink-only, so the count
  cannot quietly grow again — a new ungated branch fails the build.

  Do not reason from the old number. It sent me hunting the wrong cause for a
  hydration mismatch that turned out to be a test-harness bug, which is exactly
  the cost of a stale invariant in this file.

- **Verify dropdown fixes in FIREFOX, not only the Chromium preview pane.** This bug was
  reported on Firefox 154 and every prior verification ran in Chromium, which is why it
  survived being "fixed" repeatedly. Hydration-mismatch repair is browser- and
  timing-dependent, so a clean Chromium check is not evidence.

- **Dropdown behaviour is global, in `app/assets/css/main.css`, not per component.** daisyUI 5's
  `.dropdown .dropdown-content` sets ONLY `position: absolute` — no `top`, no `bottom`, no size
  limit — so placement falls out of the static position and a menu taller than the window has no
  way to reach its own last item (`position-area`, which daisyUI puts on `.dropdown`, is inert on
  a `position: relative` box with no anchor-name). The global block states the default placement,
  caps every menu at `calc(100dvh - 5rem)` and lets it scroll. **Fix dropdown problems there, not
  in one component** — this was first patched in `MainNav` alone, which left the admin tables,
  `ReviewDrawer` and `LanguageSwitcher` still broken.

- **A clipping ancestor beats any z-index.** An admin row kebab sits inside `.overflow-x-auto`
  (which computes to `overflow: auto auto` — a non-`visible` axis forces the other to `auto`)
  nested in `.card` (`overflow: hidden`). Measured on the listings table: 204px of menu cut off,
  last action unclickable, and the `z-[9999]` already on it did nothing, because clipping is not
  stacking. The global rule unclips those containers only while a menu inside is open
  (`:has(.dropdown:focus-within)`).

- **EVERY rule in that block must stay unlayered — placement and sizing included.** The
  unclip rule overrides `.overflow-x-auto`, a Tailwind _utility_. But the same reasoning
  applies to all of them, because **daisyUI 5 ships the whole `.dropdown` component inside
  `@layer utilities`** (see `node_modules/daisyui/components/dropdown.css`), not `components`.
  Utilities sort after `components`, so anything we put in `@layer components` is structurally
  outranked by daisyUI's own declarations no matter how specific it is — layer order beats
  specificity, and unlayered beats every layer. The placement/size defaults _were_ in
  `@layer components`, which happened to work only because daisyUI sets no `top`/`max-height`
  on `.dropdown-content` for the default case; it was one upstream declaration away from being
  silently overridden. Directional variants (`.dropdown-top` et al) still win because the
  placement rule **excludes them by selector** (`:not(.dropdown-top, …)`) rather than relying
  on layer order — verify that when touching it, since nothing else protects them now.
  Nothing in `app/` sets `top`/`bottom`/`max-height`/`overflow` on a `.dropdown-content` via a
  Tailwind utility, so unlayering tramples nothing; re-check that before adding one.

- **`.dropdown { position: relative }` is restated unlayered, and it is load-bearing.** Every
  other rule positions the menu against `.dropdown`. If that declaration ever fails to apply,
  the menu resolves against the _initial containing block_ instead — which pins it to the
  VIEWPORT edges rather than the trigger: hard against the right edge of the window, and
  vertically wherever the static position lands. daisyUI does set it, but in `utilities`, where
  a stray utility outranks it. `[popover]` dropdowns are excluded because daisyUI deliberately
  makes those `position: fixed`.

- **Never unclip a vertical scroll container.** `.overflow-y-auto` / `.overflow-auto` are
  deliberately excluded: switching a scrolled container to `overflow: visible` resets its scroll
  offset, so the region would jump to the top the moment a menu opened inside it.
  `ReviewDrawer`'s scrolling body is exactly that shape.

- **Escape-to-dismiss lives in `app/plugins/dropdown-dismiss.client.ts`.** These menus are pure
  CSS opened on `:focus-within`, so there is no state to clear — closing one means blurring out
  of it. It acts only when focus is genuinely inside a `.dropdown`, so it never swallows an
  Escape meant for the omnisearch palette, the contribute wizard or a `<dialog class="modal">`.

- **Verifying dropdowns in a headless/background pane: assert on `:focus-within`, not on
  `display`.** daisyUI transitions `display` with `transition-behavior: allow-discrete`. When the
  pane is backgrounded (`document.visibilityState === 'hidden'`, `document.timeline.currentTime`
  stuck at 0) the animation clock never advances, so a closed menu reads as `display: flex;
opacity: 0` forever and looks like a stuck-open bug that does not exist.
