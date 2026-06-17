# Exchange migration — icon conversion reference (Heroicons/Lucide → Font Awesome 6)

The Mini Exchange renders icons with `@nuxt/icon` as `<Icon name="i-heroicons-*" />` (~609 uses) and a
few `<Icon name="i-lucide-*" />` (12). CMDIY is Font Awesome 6 only, rendered inline as
`<i class="fas fa-*"></i>` (solid), `far` (regular/outline), `fab` (brands) via the FA Kit CDN.

**Process:** `@nuxt/icon` + `@iconify-json/heroicons` are a TRANSITION dependency (registered in
`nuxt.config.ts`, flagged transition-only). As each component is migrated in stages 3–7, replace its
`<Icon name="...">` with the FA6 equivalent below. When the last `<Icon>` is gone, remove `@nuxt/icon`
+ `@iconify-json/heroicons` and grep-assert zero `<Icon name="i-heroicons`/`i-lucide` remain.

**Conversion:** `<Icon name="i-heroicons-photo" class="w-5 h-5" />` → `<i class="fas fa-image"></i>`
(size via FA classes / `text-*`, not `w-/h-`). Heroicons `-solid` suffix → `fas`; default (outline) →
also `fas` unless a true outline is wanted (`far`). Mappings marked **(approx)** have no exact FA free
glyph — confirm visually and adjust.

## Heroicons → FA6

| Heroicons | FA6 (`<i class="...">`) | Notes |
|---|---|---|
| archive-box | `fas fa-box-archive` | |
| arrow-down-circle | `fas fa-circle-arrow-down` | |
| arrow-left | `fas fa-arrow-left` | |
| arrow-path | `fas fa-arrows-rotate` | |
| arrow-right | `fas fa-arrow-right` | |
| arrow-right-circle | `fas fa-circle-arrow-right` | |
| arrow-right-on-rectangle | `fas fa-right-from-bracket` | sign-out |
| arrow-top-right-on-square | `fas fa-arrow-up-right-from-square` | external link |
| arrow-trending-down | `fas fa-arrow-trend-down` | |
| arrow-trending-up | `fas fa-arrow-trend-up` | |
| arrow-up-circle | `fas fa-circle-arrow-up` | |
| arrow-uturn-right | `fas fa-share` | FA share = u-turn-right arrow (approx) |
| arrows-pointing-out | `fas fa-up-right-and-down-left-from-center` | expand |
| arrows-right-left | `fas fa-right-left` | |
| banknotes | `fas fa-money-bill-wave` | |
| beaker | `fas fa-flask` | |
| bell | `fas fa-bell` | |
| bell-alert | `fas fa-bell` | no alert variant in free (approx) |
| bell-slash | `fas fa-bell-slash` | |
| bolt | `fas fa-bolt` | |
| bug-ant | `fas fa-bug` | |
| calculator | `fas fa-calculator` | |
| calendar | `fas fa-calendar` | |
| calendar-days | `fas fa-calendar-days` | |
| camera | `fas fa-camera` | |
| chart-bar | `fas fa-chart-column` | heroicons chart-bar = vertical bars |
| chart-bar-square | `fas fa-square-poll-vertical` | |
| chat-bubble-left | `fas fa-comment` | |
| chat-bubble-left-ellipsis | `fas fa-comment-dots` | |
| chat-bubble-left-right | `fas fa-comments` | |
| check | `fas fa-check` | |
| check-badge | `fas fa-circle-check` | "verified" (approx) |
| check-circle | `fas fa-circle-check` | |
| chevron-down | `fas fa-chevron-down` | |
| chevron-left | `fas fa-chevron-left` | |
| chevron-right | `fas fa-chevron-right` | |
| clipboard-document | `fas fa-clipboard` | |
| clipboard-document-check | `fas fa-clipboard-check` | |
| clock | `fas fa-clock` | |
| code-bracket | `fas fa-code` | |
| cog-6-tooth | `fas fa-gear` | |
| credit-card | `fas fa-credit-card` | |
| cube | `fas fa-cube` | |
| currency-dollar | `fas fa-dollar-sign` | (approx; or `fa-sack-dollar`) |
| device-phone-mobile | `fas fa-mobile-screen` | |
| document-check | `fas fa-file-circle-check` | |
| document-text | `fas fa-file-lines` | |
| ellipsis-vertical | `fas fa-ellipsis-vertical` | |
| envelope | `fas fa-envelope` | |
| exclamation-circle | `fas fa-circle-exclamation` | |
| exclamation-triangle | `fas fa-triangle-exclamation` | |
| eye | `fas fa-eye` | |
| fire | `fas fa-fire` | |
| flag | `fas fa-flag` | |
| funnel | `fas fa-filter` | |
| gift | `fas fa-gift` | |
| globe-alt | `fas fa-globe` | |
| hand-raised | `fas fa-hand` | |
| hashtag | `fas fa-hashtag` | |
| heart | `fas fa-heart` | outline = `far fa-heart` |
| home | `fas fa-house` | |
| identification | `fas fa-id-card` | |
| inbox | `fas fa-inbox` | |
| inbox-stack | `fas fa-boxes-stacked` | (approx) |
| information-circle | `fas fa-circle-info` | |
| light-bulb | `fas fa-lightbulb` | |
| link | `fas fa-link` | |
| list-bullet | `fas fa-list-ul` | |
| lock-closed | `fas fa-lock` | |
| magnifying-glass | `fas fa-magnifying-glass` | |
| map | `fas fa-map` | |
| map-pin | `fas fa-location-dot` | |
| megaphone | `fas fa-bullhorn` | |
| no-symbol | `fas fa-ban` | |
| paint-brush | `fas fa-paintbrush` | |
| paper-airplane | `fas fa-paper-plane` | |
| paper-clip | `fas fa-paperclip` | |
| pencil | `fas fa-pencil` | |
| pencil-square | `fas fa-pen-to-square` | |
| photo | `fas fa-image` | |
| plus | `fas fa-plus` | |
| puzzle-piece | `fas fa-puzzle-piece` | |
| queue-list | `fas fa-list` | |
| rss | `fas fa-rss` | |
| scale | `fas fa-scale-balanced` | |
| share | `fas fa-share-nodes` | |
| shield-check | `fas fa-shield-halved` | no shield-check in free (approx) |
| shield-exclamation | `fas fa-shield-halved` | (approx) |
| sparkles | `fas fa-wand-magic-sparkles` | (approx; or `fa-star`) |
| square-3-stack-3d | `fas fa-layer-group` | |
| squares-2x2 | `fas fa-table-cells-large` | grid |
| squares-plus | `fas fa-square-plus` | |
| star | `far fa-star` | outline |
| star-solid | `fas fa-star` | filled |
| tag | `fas fa-tag` | |
| trash | `fas fa-trash` | |
| truck | `fas fa-truck` | |
| user | `fas fa-user` | |
| user-circle | `fas fa-circle-user` | |
| user-plus | `fas fa-user-plus` | |
| users | `fas fa-users` | |
| wrench-screwdriver | `fas fa-screwdriver-wrench` | |
| x-circle | `fas fa-circle-xmark` | |
| x-mark | `fas fa-xmark` | |

## Lucide → FA6

| Lucide | FA6 | Notes |
|---|---|---|
| cloud | `fas fa-cloud` | (Bluesky/atproto context — consider `fab fa-bluesky`) |
| facebook | `fab fa-facebook` | brand |
| instagram | `fab fa-instagram` | brand |
