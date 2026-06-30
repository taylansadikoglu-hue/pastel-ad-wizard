#!/usr/bin/env bash
# Push Cloudflare + Resend secrets to production Worker.
#
# Usage (split tokens — recommended):
#   export CLOUDFLARE_API_TOKEN=cfat_...        # R2 read/write
#   export CLOUDFLARE_WORKERS_API_TOKEN=cfat_... # Workers Scripts edit
#   ./scripts/cloudflare-set-secrets.sh
#
# Or one token with both permission groups:
#   export CLOUDFLARE_API_TOKEN=cfat_...
#   ./scripts/cloudflare-set-secrets.sh

set -euo pipefail

WORKER_NAME="${CLOUDFLARE_WORKER_NAME:-taylansadikoglu-hue-pastel-ad-wizard}"

R2_TOKEN="${CLOUDFLARE_API_TOKEN_R2:-${CLOUDFLARE_API_TOKEN:-}}"
WRANGLER_TOKEN="${CLOUDFLARE_WORKERS_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"

if [[ -z "$WRANGLER_TOKEN" ]]; then
  echo "Set CLOUDFLARE_WORKERS_API_TOKEN or CLOUDFLARE_API_TOKEN (Workers Scripts Edit)"
  exit 1
fi

put_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "skip $name (empty)"
    return
  fi
  echo "Setting worker secret: $name"
  printf '%s' "$value" | CLOUDFLARE_API_TOKEN="$WRANGLER_TOKEN" npx wrangler secret put "$name" --name "$WORKER_NAME"
}

# Runtime worker uses R2-capable token
put_secret CLOUDFLARE_API_TOKEN "$R2_TOKEN"
put_secret CLOUDFLARE_ACCOUNT_ID "${CLOUDFLARE_ACCOUNT_ID:-7169638abf93eba4c8a9644d870c35fa}"
put_secret R2_BUCKET_NAME "${R2_BUCKET_NAME:-revenuead-creative-vault}"
put_secret R2_PUBLIC_URL "${R2_PUBLIC_URL:-https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev}"
put_secret R2_ACCESS_KEY_ID "${R2_ACCESS_KEY_ID:-}"
put_secret R2_SECRET_ACCESS_KEY "${R2_SECRET_ACCESS_KEY:-}"
put_secret R2_S3_ENDPOINT "${R2_S3_ENDPOINT:-https://7169638abf93eba4c8a9644d870c35fa.r2.cloudflarestorage.com}"
put_secret RESEND_API_KEY "${RESEND_API_KEY:-}"
put_secret RESEND_WEBHOOK_SECRET "${RESEND_WEBHOOK_SECRET:-}"
put_secret APP_URL "${APP_URL:-https://revenuad.com}"

echo "Done. Worker: $WORKER_NAME"
