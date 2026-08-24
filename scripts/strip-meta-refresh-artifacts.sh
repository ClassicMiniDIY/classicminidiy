#!/usr/bin/env bash
# Remove prerendered meta-refresh artifacts from the Cloudflare build output.
#
# WHY THIS EXISTS
# ---------------
# `routeRules` redirects are prerendered by Nitro into HTML files containing a
# `<meta http-equiv="refresh">`. On Vercel that artifact is shadowed by the
# platform's own routing, so the real 301 is served. On Cloudflare Workers the
# STATIC ASSET LAYER WINS: the file is served directly, the worker never runs,
# and the redirect degrades from a 301 to a 200 carrying a meta-refresh.
#
# Measured on a live deployment before this script existed:
#   worker      /archive/manuals -> 200, meta-refresh HTML
#   production  /archive/manuals -> 301 -> /archive/documents?type=manual
#
# A meta-refresh is a weak soft-redirect: search engines may not pass authority
# through it, and it costs a render round-trip for users. Deleting the artifact
# makes the path fall through to the worker, which serves the real 301.
#
# The list is DERIVED, not hardcoded. Adding or removing a routeRules redirect
# changes which artifacts appear, and a hardcoded list would silently drift.
#
# Safe to run repeatedly. Prints what it removed so CI logs show the count.

set -euo pipefail

PUBLIC_DIR="${1:-.output/public}"

if [ ! -d "$PUBLIC_DIR" ]; then
  echo "strip-meta-refresh: no such directory: $PUBLIC_DIR" >&2
  exit 1
fi

count=0
while IFS= read -r file; do
  # Only ever delete a file whose ENTIRE purpose is the refresh. A real page
  # that happens to contain the string must not be touched, so require the
  # artifact to be small — Nitro's redirect stubs are a few hundred bytes.
  size=$(wc -c < "$file" | tr -d ' ')
  if [ "$size" -gt 4096 ]; then
    echo "  SKIP (too large to be a redirect stub, ${size}B): ${file#$PUBLIC_DIR/}"
    continue
  fi
  rm -f "$file"
  echo "  removed: ${file#$PUBLIC_DIR/}"
  count=$((count + 1))
done < <(grep -rlil 'http-equiv="refresh"' "$PUBLIC_DIR" --include='*.html' 2>/dev/null || true)

echo "strip-meta-refresh: removed $count artifact(s) so the worker serves real 301s"
