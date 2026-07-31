# Giveaway photos

One folder per giveaway, named to match the `id` in `data/models/giveaways.ts`.
Files are numbered in carousel order (`01.jpg`, `02.jpg`, …) and referenced from
that file — the numbers and the `alt` text there are paired, so if you reorder
the photos, reorder the `images` array too.

Resize to roughly 1600px on the long edge before committing. These ship inside
the deployment rather than sitting on S3, so raw phone photos bloat every build.

Once a giveaway is over and removed from `GIVEAWAYS`, delete its folder.
