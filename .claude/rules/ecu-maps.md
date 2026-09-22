---
paths:
  - 'app/pages/maps.vue'
  - 'app/components/maps/**'
  - 'server/api/github/**'
  - 'data/models/github.ts'
---

# /maps (ECU maps)

- **The support table is not in this repo.** It is `maps.json` on `main` of
  `ClassicMiniDIY/MiniECUMaps` (local: `~/Development/BadWolfTurboMap`), read through
  `server/api/github/maps-manifest.ts`. Never hardcode the matrix here again — it drifted
  from the repo README when it was. Contract: that repo's
  `docs/plans/2026-09-22-maps-manifest.md`.
- **`schemaVersion` is checked.** The route accepts only `1`; anything else returns 502 and
  the page shows `table.error`. A breaking manifest change ships with a site change.
- **Feature labels come from this page's `table.<featureId>` i18n keys**, falling back to the
  manifest's English `label`. A new upstream feature needs a key in all ten locales.
- **Repo coordinates live in `ECU_MAPS_REPO` (`data/models/github.ts`).** The repo moved from
  `SomethingNew71` / `master` to `ClassicMiniDIY` / `main`; GitHub redirects are not a
  contract.
- **Releases:** draft releases are filtered out and `latestRelease` is `null` when none are
  published — the page hides the "Latest Release" line on `null`.
- **The disclaimer is load-bearing.** The page must keep the "Not plug and play" alert and
  must not call the maps "professionally tuned" or ready to flash.
