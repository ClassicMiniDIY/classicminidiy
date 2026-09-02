# Font Awesome icon rules

Moved verbatim out of `CLAUDE.md` on 2026-09-02 to keep the per-session context budget down. The enforced contract is the `Icons` bullet in `CLAUDE.md`, which loads in every session; this file keeps the reasoning and the incident history behind it. Update both when a rule changes.

#### Icons (Font Awesome 6 - EXCLUSIVE)

**IMPORTANT**: This project uses Font Awesome 6 as the ONLY icon library. Do NOT use Heroicons, Lucide, or any other icon libraries.

Font Awesome is loaded via a **Font Awesome Kit** (CDN script configured in `nuxt.config.ts`), not via an npm package.

##### Always use the class form — the Iconify `i-fa6-*` form does NOT render

The FA Kit works by scanning the DOM for `fa-` class tokens and swapping the element for an
inline `<svg class="svg-inline--fa">`. A single hyphenated class like `i-fa6-solid-house` has
no `fa-` token, there is no Iconify Tailwind plugin in `main.css`, and nothing renders `<Icon>`
components — so an `i-fa6-*` string used as a class produces a **silently empty element**.

The Iconify format only ever worked as a Nuxt UI `icon` prop, and Nuxt UI is gone (see above).
Any `i-fa6-*` you find is a leftover. Eleven of them were live toast icons rendering nothing
(`toast.add({ icon })` flows into `:class` in `Toaster.vue`) — fixed 2026-07-31.

```vue
<!-- Correct, everywhere: solid / regular / brands -->
<i class="fas fa-house"></i>
<i class="far fa-heart"></i>
<i class="fab fa-github"></i>
```

Pass the same class string wherever a component takes an `icon` option — `Toaster.vue` binds it
straight into `:class`, so it must be `'fas fa-circle-check'`, never `'i-fa6-solid-circle-check'`.

**Two deliberate exceptions** — do not "clean these up":

- `app/pages/models/index.vue` parses `^i-fa6-(solid|regular|brands)-(.+)$` on purpose, because
  3D-model **category icons are stored in the database in Iconify form** and converted on read.
- `app/components/Breadcrumb.vue` uses the string as a sentinel value and renders
  `<i class="fas fa-house">` explicitly.

Both exceptions are **pure string manipulation** — they emit an FA class for the Kit to swap and
never resolve Iconify icon _data_. That is why the `@iconify-json/*` collections could be dropped
along with `@nuxt/icon` (the transition-only module for the TME merge) once the last `<Icon>` tag
was converted. Nothing in `app/` renders `<Icon>` or needs an Iconify collection; don't re-add one
to "support" these two files.

**Gotcha:** `@nuxt/icon` and `@iconify-json/carbon` are still physically present in
`node_modules` as transitive deps of `nuxtseo-layer-devtools` → `@nuxt/ui` (the `@nuxtjs/seo`
devtools layer). Their presence on disk is **not** evidence the site uses them — the module is not
in `nuxt.config.ts`'s `modules` array, so it never runs, and `@nuxt/ui` being reachable in
`node_modules` still does not mean `<U*>` components exist here.

##### Inline Icons

For inline icons in templates, use the traditional Font Awesome class syntax:

```vue
<i class="fas fa-house"></i>
<!-- Solid -->
<i class="far fa-heart"></i>
<!-- Regular -->
<i class="fab fa-github"></i>
<!-- Brands -->
<i class="fad fa-spinner"></i>
<!-- Duotone -->
```

##### Common Icon Mappings

| Purpose     | Iconify Format                     | Class Format                  |
| ----------- | ---------------------------------- | ----------------------------- |
| Home        | `i-fa6-solid-house`                | `fas fa-house`                |
| Search      | `i-fa6-solid-magnifying-glass`     | `fas fa-magnifying-glass`     |
| Settings    | `i-fa6-solid-gear`                 | `fas fa-gear`                 |
| User        | `i-fa6-solid-user`                 | `fas fa-user`                 |
| Info        | `i-fa6-solid-circle-info`          | `fas fa-circle-info`          |
| Warning     | `i-fa6-solid-triangle-exclamation` | `fas fa-triangle-exclamation` |
| Error       | `i-fa6-solid-circle-xmark`         | `fas fa-circle-xmark`         |
| Plus        | `i-fa6-solid-plus`                 | `fas fa-plus`                 |
| Close       | `i-fa6-solid-xmark`                | `fas fa-xmark`                |
| Arrow Right | `i-fa6-solid-arrow-right`          | `fas fa-arrow-right`          |
| File        | `i-fa6-solid-file-lines`           | `fas fa-file-lines`           |
| Car         | `i-fa6-solid-car`                  | `fas fa-car`                  |
