#!/usr/bin/env bash
# Push classicminidiy's RUNTIME secrets into the Cloudflare Worker.
#
# Why this exists: Nuxt bakes private `runtimeConfig` defaults into the JS
# bundle at build time. Before this split the runtime half did not exist, so
# production ran entirely on whatever the CI build happened to supply. That env
# carried only a SUBSET of the keys, and every key outside it silently resolved
# to an empty string — a green build, a green deploy, a green smoke test, and
# dead chat / dead S3 uploads / dead /mcp.
#
# With the values here, Nitro's env override replaces the baked default at
# request time, so a missing secret is a visible runtime failure instead of an
# invisible empty string.
#
# NAMING: Nitro derives a runtimeConfig key's env-override name as
#   NUXT_ + snakeCase(key).toUpperCase()
# so every private key in nuxt.config.ts is set here as NUXT_<KEY>. The keys are
# all UPPER_SNAKE precisely so that mapping is mechanical. NUXT_OG_IMAGE_SECRET
# is the one exception: nuxt-og-image reads the Cloudflare env binding by that
# literal name, not through runtimeConfig.
#
# This script NEVER prints a secret value. It reads them from your local .env
# and pipes each one straight into `wrangler secret put` on stdin.
#
#   Usage:  ./scripts/set-cf-secrets.sh [--dry-run] [path/to/.env]
#
# --dry-run reports which names would be set or skipped, and touches nothing.
#
# Run it from a checkout of this repo (any checkout — a git worktree is fine):
# wrangler reads the worker name from wrangler.jsonc in the working directory.
# The .env argument is separate and may point anywhere, so a worktree whose
# own .env is stale can still use the main checkout's:
#
#   ./scripts/set-cf-secrets.sh --dry-run ~/Development/classicminidiy/.env
#
# Cloudflare auth comes from CLOUDFLARE_API_TOKEN in that same file if present;
# otherwise an existing `wrangler login` session is used.

set -uo pipefail

DRY_RUN=0
ENV_FILE=".env"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *)         ENV_FILE="$arg" ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found. Pass the path as an argument." >&2
  exit 1
fi

# Read a key from the env file without echoing it or exporting the whole file.
# Handles `KEY=value`, optional surrounding quotes, and ignores comments.
read_env() {
  local key="$1"
  sed -n "s/^[[:space:]]*${key}=//p" "$ENV_FILE" \
    | head -1 \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# put <cloudflare-secret-name> <local .env key> [fallback .env key]
#
# Required by default. Append the literal word OPTIONAL as a final argument for
# secrets whose feature degrades gracefully when unset.
SET=(); SKIPPED=(); MISSING=()
put() {
  local name="$1"; shift
  local optional=0
  local keys=()
  for a in "$@"; do
    if [ "$a" = "OPTIONAL" ]; then optional=1; else keys+=("$a"); fi
  done

  local value=""
  for k in "${keys[@]}"; do
    value="$(read_env "$k")"
    [ -n "$value" ] && break
  done

  if [ -z "$value" ]; then
    if [ "$optional" = "1" ]; then
      SKIPPED+=("$name")
    else
      MISSING+=("$name (looked for ${keys[*]} in $ENV_FILE)")
    fi
    return
  fi

  if [ "$DRY_RUN" = "1" ]; then
    SET+=("$name")
    return
  fi

  if printf '%s' "$value" | bunx wrangler secret put "$name" >/dev/null 2>&1; then
    SET+=("$name")
  else
    MISSING+=("$name (wrangler secret put failed)")
  fi
}

# Authenticate from the same file rather than requiring `wrangler login`.
# The env file carries CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID; exporting
# them here means this script works from a git worktree, a fresh clone, or any
# checkout, without touching the machine's global wrangler credentials.
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  CLOUDFLARE_API_TOKEN="$(read_env CLOUDFLARE_API_TOKEN)"
  [ -n "$CLOUDFLARE_API_TOKEN" ] && export CLOUDFLARE_API_TOKEN
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  CLOUDFLARE_ACCOUNT_ID="$(read_env CLOUDFLARE_ACCOUNT_ID)"
  [ -n "$CLOUDFLARE_ACCOUNT_ID" ] && export CLOUDFLARE_ACCOUNT_ID
fi

if [ "$DRY_RUN" != "1" ] && [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if ! bunx wrangler whoami >/dev/null 2>&1; then
    echo "error: not authenticated to Cloudflare." >&2
    echo "  Either add CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID) to $ENV_FILE," >&2
    echo "  or run: bunx wrangler login" >&2
    exit 1
  fi
fi

echo "Reading from $ENV_FILE; values are never printed."
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && echo "Authenticating with CLOUDFLARE_API_TOKEN from $ENV_FILE."
[ "$DRY_RUN" = "1" ] && echo "DRY RUN — nothing will be written."
echo

# --- Supabase service role -------------------------------------------------
# Also stays in the CI build env: the sitemap sources prerender through
# getServiceClient(), so the build needs it too.
put NUXT_SUPABASE_SERVICE_KEY SUPABASE_SERVICE_KEY

# --- AI chat ---------------------------------------------------------------
# The agent runs in this Worker. NUXT_LANGGRAPH_API_URL / NUXT_LANGSMITH_API_KEY
# were removed on 2026-08-31 with the LangGraph proxy — DELETE those two secrets
# from the Worker; nothing reads them, and a stale LangSmith key left in place is
# a live credential for a third-party account with no consumer.
#
# The in-Worker agent (server/api/chat.post.ts). ANTHROPIC_API_KEY is the only
# required one — without it /api/chat answers 503 rather than failing silently,
# which is the whole point of the 2026-08-26 lesson above.
#
# AI_GATEWAY_ANTHROPIC_URL is optional and must NOT carry a trailing /v1:
#   https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic
# @ai-sdk/anthropic appends /v1/messages itself. CHAT_MODEL is optional too and
# exists so the model can be changed without a rebuild.
put NUXT_ANTHROPIC_API_KEY NUXT_ANTHROPIC_API_KEY ANTHROPIC_API_KEY
put NUXT_AI_GATEWAY_ANTHROPIC_URL NUXT_AI_GATEWAY_ANTHROPIC_URL OPTIONAL
put NUXT_CHAT_MODEL NUXT_CHAT_MODEL OPTIONAL

# --- Shopify storefront ----------------------------------------------------
# The chat agent's `store-search` tool (server/utils/shopifyCatalog.ts).
#
# THIS MUST BE A STOREFRONT API TOKEN, NEVER AN ADMIN API TOKEN. /api/chat is
# unauthenticated by documented invariant and the model decides when the tool
# fires; an Admin token there can read customers and orders. The Storefront
# token is public-scoped, read-only, published products only.
#
# Optional: unset makes every store lookup report `store-search:not-configured`
# in `tools_called` and tells the model it could not check the shop. The chat
# keeps working — the tool just never returns a product, which is why that
# marker exists rather than a silent empty list.
#
# The domain defaults to store.classicminidiy.com in nuxt.config.ts and only
# needs setting if the storefront ever moves.
put NUXT_SHOPIFY_STOREFRONT_TOKEN SHOPIFY_STOREFRONT_TOKEN NUXT_SHOPIFY_STOREFRONT_TOKEN OPTIONAL
put NUXT_SHOPIFY_STORE_DOMAIN SHOPIFY_STORE_DOMAIN OPTIONAL

# --- Content APIs ----------------------------------------------------------
# Also build-time: prerendered pages fetch /api/{github,youtube}/* during the
# crawl, so an unset key at build time bakes an empty widget into static HTML.
put NUXT_GITHUB_API_KEY GITHUB_API_KEY githubAPIKey
put NUXT_YOUTUBE_API_KEY YOUTUBE_API_KEY youtubeAPIKey

# --- MCP server ------------------------------------------------------------
# Fails closed: unset means /mcp rejects every request rather than accepting a
# baked-in default.
put NUXT_MCP_API_KEY MCP_API_KEY
put NUXT_MCP_API_KEYS MCP_API_KEYS OPTIONAL

# --- Marketing email -------------------------------------------------------
# Unset MARKETING_UNSUB_SECRET makes the unsubscribe endpoints 503 rather than
# accept unsigned links, so a missing value is safe but breaks one-click
# unsubscribe — which is a deliverability obligation, not an optional feature.
put NUXT_MARKETING_UNSUB_SECRET MARKETING_UNSUB_SECRET
put NUXT_MARKETING_ADMIN_EMAILS MARKETING_ADMIN_EMAILS

# --- 3D model library S3 ---------------------------------------------------
put NUXT_S3_MODELS_BUCKET S3_MODELS_BUCKET
put NUXT_S3_MODELS_REGION S3_MODELS_REGION
put NUXT_S3_MODELS_ACCESS_KEY_ID S3_MODELS_ACCESS_KEY_ID
put NUXT_S3_MODELS_SECRET_ACCESS_KEY S3_MODELS_SECRET_ACCESS_KEY

# --- Optional third-party --------------------------------------------------
put NUXT_MICROLINK_API_KEY MICROLINK_API_KEY OPTIONAL
put NUXT_CAMINO_API_KEY CAMINO_API_KEY OPTIONAL

# --- nuxt-og-image ---------------------------------------------------------
# NOT a runtimeConfig key. nuxt-og-image reads `cloudflare.env.NUXT_OG_IMAGE_SECRET`
# directly (dist/runtime/server/utils.js), so the name here is literal, with no
# snakeCase derivation involved.
#
# It must ALSO be in the CI build env, and be the SAME value: the module
# resolves its signing secret at build time and generates a random one when
# unset, so build-signed og:image URLs would fail the worker's verification.
put NUXT_OG_IMAGE_SECRET NUXT_OG_IMAGE_SECRET

echo "set (${#SET[@]}):"
for n in "${SET[@]:-}"; do [ -n "$n" ] && echo "  + $n"; done
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo
  echo "skipped, optional and absent from $ENV_FILE (${#SKIPPED[@]}):"
  for n in "${SKIPPED[@]}"; do echo "  . $n"; done
fi
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo
  echo "MISSING (${#MISSING[@]}):"
  for n in "${MISSING[@]}"; do echo "  ! $n"; done
  echo
  echo "Each of these is required. Add it to $ENV_FILE and re-run;"
  echo "an unset one resolves to an empty string in production."
  exit 1
fi

echo
echo "Done. Confirm the names (never the values) with:  bunx wrangler secret list"
